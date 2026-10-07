import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);


// server/mcp-remote-proxy.ts
import { createInterface } from "node:readline";

// server/mcp-http.ts
var McpHttpError = class extends Error {
  kind;
  status;
  /** The server's `WWW-Authenticate` challenge on a 401: where to sign in. */
  wwwAuthenticate;
  constructor(kind, message, status, wwwAuthenticate) {
    super(message);
    this.name = "McpHttpError";
    this.kind = kind;
    this.status = status;
    this.wwwAuthenticate = wwwAuthenticate;
  }
};
var MAX_BODY_BYTES = 1048576;
var PROTOCOL_VERSION = "2025-06-18";
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function remoteMcpSpec(value) {
  if (!isRecord(value) || value.type !== "http" && value.type !== "sse" || typeof value.url !== "string") return;
  try {
    const url = new URL(value.url);
    if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) return;
    const headers = value.headers ?? {};
    if (!isRecord(headers) || !Object.values(headers).every((header) => typeof header === "string")) return;
    new Headers(headers);
    return { type: value.type, url: value.url, headers };
  } catch {
    return;
  }
}
function unwrap(message) {
  if (message.error !== void 0) {
    const detail = isRecord(message.error) && typeof message.error.message === "string" ? message.error.message : "request failed";
    throw new McpHttpError("protocol", `MCP error: ${detail}`);
  }
  return message.result;
}
function parseMessage(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function parseSseBlock(block) {
  let event = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
async function readSse(response, signal, onEvent, maxBytes = MAX_BODY_BYTES) {
  const reader = response.body?.getReader();
  if (!reader) throw new McpHttpError("protocol", "empty event stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  const onAbort = () => void reader.cancel().catch(() => {
  });
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) return;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new McpHttpError("protocol", "event stream too large");
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
      let separator;
      while ((separator = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const event = parseSseBlock(block);
        if (event && onEvent(event) === "stop") {
          await reader.cancel().catch(() => {
          });
          return;
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
async function readBounded(response, maxBytes = MAX_BODY_BYTES) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (; ; ) {
    const { value, done } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {
      });
      throw new McpHttpError("protocol", "response too large");
    }
    text += decoder.decode(value, { stream: true });
  }
}
function drain(response) {
  void response.body?.cancel().catch(() => {
  });
}
var RemoteMcpClient = class {
  target;
  fetchImpl;
  maxBytes;
  onNotification;
  sessionId = null;
  protocolVersion = null;
  nextId = 1;
  closed = false;
  /** Legacy SSE: one long GET stream carries every response. */
  pending = /* @__PURE__ */ new Map();
  sseEndpoint = null;
  sseAbort = new AbortController();
  constructor(target, options = {}) {
    this.target = target;
    this.fetchImpl = options.fetch ?? fetch;
    this.maxBytes = options.maxBytes ?? MAX_BODY_BYTES;
    this.onNotification = options.onNotification;
  }
  /** The MCP handshake: initialize, then the initialized notification. */
  async initialize(clientName, signal) {
    const result = await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: clientName, version: "1" }
    }, signal);
    if (isRecord(result) && typeof result.protocolVersion === "string") this.protocolVersion = result.protocolVersion;
    await this.notify("notifications/initialized", void 0, signal);
    return result;
  }
  request(method, params, signal) {
    if (this.closed) return Promise.reject(new McpHttpError("protocol", "client closed"));
    if (signal.aborted) return Promise.reject(new McpHttpError("network", "aborted"));
    const id = this.nextId++;
    const frame = { jsonrpc: "2.0", id, method, ...params === void 0 ? {} : { params } };
    const onAbort = () => {
      void this.notify("notifications/cancelled", { requestId: id, reason: "Request cancelled" }, AbortSignal.timeout(2e3)).catch(() => {
      });
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const reply = this.target.type === "sse" ? this.sseRequest(id, frame, signal) : this.streamableRequest(id, frame, signal);
    return reply.finally(() => signal.removeEventListener("abort", onAbort));
  }
  async notify(method, params, signal) {
    if (this.closed) throw new McpHttpError("protocol", "client closed");
    const frame = { jsonrpc: "2.0", method, ...params === void 0 ? {} : { params } };
    if (this.target.type === "sse") {
      await this.ssePost(frame, signal);
      return;
    }
    const response = await this.post(this.target.url, frame, signal);
    drain(response);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    this.sseAbort.abort();
    for (const entry of this.pending.values()) entry.reject(new McpHttpError("network", "client closed"));
    this.pending.clear();
    if (this.sessionId && this.target.type !== "sse") {
      try {
        const headers = this.headers();
        headers.set("mcp-session-id", this.sessionId);
        const response = await this.fetchImpl(this.target.url, { method: "DELETE", headers, signal: AbortSignal.timeout(2e3) });
        drain(response);
      } catch {
      }
    }
  }
  headers() {
    const headers = new Headers();
    for (const [name, value] of Object.entries(this.target.headers)) headers.set(name, value);
    headers.set("accept", "application/json, text/event-stream");
    if (this.sessionId) headers.set("mcp-session-id", this.sessionId);
    if (this.protocolVersion) headers.set("mcp-protocol-version", this.protocolVersion);
    return headers;
  }
  async post(url, frame, signal) {
    const headers = this.headers();
    headers.set("content-type", "application/json");
    let response;
    try {
      response = await this.fetchImpl(url, { method: "POST", headers, body: JSON.stringify(frame), signal });
    } catch (error2) {
      if (signal.aborted) throw error2;
      throw new McpHttpError("network", "request failed");
    }
    if (!response.ok) {
      drain(response);
      throw new McpHttpError("status", `HTTP ${response.status}`, response.status, response.headers.get("www-authenticate") ?? void 0);
    }
    const session = response.headers.get("mcp-session-id");
    if (session) this.sessionId = session;
    return response;
  }
  // ── streamable HTTP: each request is one POST; the answer is JSON or a
  //    short event stream that carries the response among server messages ──
  async streamableRequest(id, frame, signal) {
    const response = await this.post(this.target.url, frame, signal);
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.startsWith("application/json")) {
      const parsed = parseMessage(await readBounded(response, this.maxBytes));
      this.deliverNotifications(parsed);
      const message = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).find((entry) => entry.id === id);
      if (!message) throw new McpHttpError("protocol", "response did not answer the request");
      return unwrap(message);
    }
    if (type.startsWith("text/event-stream")) {
      let found;
      await readSse(response, signal, (event) => {
        if (event.event !== "message") return void 0;
        const parsed = parseMessage(event.data);
        this.deliverNotifications(parsed);
        const message = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []).find((entry) => entry.id === id);
        if (!message) return void 0;
        found = message;
        return "stop";
      }, this.maxBytes);
      if (signal.aborted) throw new McpHttpError("network", "aborted");
      if (!found) throw new McpHttpError("protocol", "event stream ended without the response");
      return unwrap(found);
    }
    drain(response);
    throw new McpHttpError("protocol", "unexpected content type");
  }
  // ── legacy SSE: a GET opens the stream, its first event names where to
  //    POST, and every response comes back over the stream ──
  openSseStream(signal) {
    if (this.sseEndpoint) return this.sseEndpoint;
    this.sseEndpoint = new Promise((resolveEndpoint, rejectEndpoint) => {
      let settled = false;
      const fail = (error2) => {
        if (!settled) {
          settled = true;
          rejectEndpoint(error2);
        }
        for (const entry of this.pending.values()) entry.reject(error2);
        this.pending.clear();
      };
      const headers = this.headers();
      headers.set("accept", "text/event-stream");
      const opening = AbortSignal.any([signal, this.sseAbort.signal]);
      this.fetchImpl(this.target.url, { method: "GET", headers, signal: opening }).then(async (response) => {
        if (!response.ok) {
          drain(response);
          throw new McpHttpError("status", `HTTP ${response.status}`, response.status, response.headers.get("www-authenticate") ?? void 0);
        }
        await readSse(response, this.sseAbort.signal, (event) => {
          if (event.event === "endpoint") {
            if (!settled) {
              settled = true;
              try {
                resolveEndpoint(new URL(event.data, this.target.url).toString());
              } catch {
                rejectEndpoint(new McpHttpError("protocol", "invalid endpoint event"));
              }
            }
            return void 0;
          }
          if (event.event !== "message") return void 0;
          const parsed = parseMessage(event.data);
          this.deliverNotifications(parsed);
          for (const message of Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) {
            const entry = typeof message.id === "number" ? this.pending.get(message.id) : void 0;
            if (!entry) continue;
            this.pending.delete(message.id);
            try {
              entry.resolve(unwrap(message));
            } catch (error2) {
              entry.reject(error2 instanceof Error ? error2 : new McpHttpError("protocol", String(error2)));
            }
          }
          return void 0;
        }, this.maxBytes);
        fail(new McpHttpError("network", "event stream ended"));
      }).catch((error2) => {
        fail(error2 instanceof McpHttpError ? error2 : new McpHttpError("network", "event stream failed"));
      });
    });
    return this.sseEndpoint;
  }
  async ssePost(frame, signal) {
    const endpoint = await this.openSseStream(signal);
    const response = await this.post(endpoint, frame, signal);
    drain(response);
  }
  sseRequest(id, frame, signal) {
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.pending.delete(id);
        reject(new McpHttpError("network", "aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, {
        resolve: (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        reject: (error2) => {
          signal.removeEventListener("abort", onAbort);
          reject(error2);
        }
      });
      this.ssePost(frame, signal).catch((error2) => {
        this.pending.delete(id);
        signal.removeEventListener("abort", onAbort);
        reject(error2 instanceof Error ? error2 : new McpHttpError("network", String(error2)));
      });
    });
  }
  deliverNotifications(parsed) {
    for (const message of Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) {
      if (typeof message.method === "string" && message.id === void 0) this.onNotification?.(message);
    }
  }
};

// server/mcp-remote-proxy.ts
function isRecord2(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function requestKey(id) {
  return typeof id === "string" || typeof id === "number" && Number.isFinite(id) ? `${typeof id}:${id}` : void 0;
}
function send(frame) {
  process.stdout.write(`${JSON.stringify(frame)}
`);
}
function error(id, code, message) {
  send({ jsonrpc: "2.0", id: requestKey(id) ? id : null, error: { code, message } });
}
var spec;
try {
  spec = remoteMcpSpec(JSON.parse(process.env.OMB_REMOTE_MCP_SERVER ?? ""));
} catch {
}
delete process.env.OMB_REMOTE_MCP_SERVER;
if (!spec) {
  process.stderr.write("mcp-remote-proxy: invalid remote MCP configuration\n");
  process.exit(1);
}
var client = new RemoteMcpClient(spec, { maxBytes: 32 * 1024 * 1024, onNotification: send });
var pending = /* @__PURE__ */ new Map();
var tasks = /* @__PURE__ */ new Set();
var initialized = false;
var closing = false;
async function handle(message) {
  const id = requestKey(message.id);
  if (typeof message.method !== "string" || message.jsonrpc !== "2.0") {
    error(message.id, -32600, "Invalid JSON-RPC request");
    return;
  }
  if (message.method === "notifications/cancelled") {
    const key = isRecord2(message.params) ? requestKey(message.params.requestId) : void 0;
    if (key) pending.get(key)?.abort();
    return;
  }
  if (!id) {
    if (message.method === "notifications/initialized" && initialized) return;
    try {
      await client.notify(message.method, message.params, AbortSignal.timeout(3e4));
    } catch {
    }
    return;
  }
  if (pending.has(id)) {
    error(message.id, -32600, "Duplicate request ID");
    return;
  }
  const controller = new AbortController();
  pending.set(id, controller);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(message.method === "tools/call" ? 12e4 : 3e4)]);
  try {
    const result = message.method === "initialize" ? await client.initialize("OpenMausBot tool proxy", signal) : await client.request(message.method, message.params, signal);
    if (message.method === "initialize") initialized = true;
    send({ jsonrpc: "2.0", id: message.id, result });
  } catch {
    error(message.id, signal.aborted ? -32800 : -32603, signal.aborted ? "MCP request cancelled" : "Remote MCP request failed");
  } finally {
    pending.delete(id);
  }
}
var input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (closing || !line.trim()) return;
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    error(null, -32700, "Invalid JSON-RPC frame");
    return;
  }
  if (!isRecord2(value)) {
    error(null, -32600, "Invalid JSON-RPC frame");
    return;
  }
  const task = handle(value);
  tasks.add(task);
  void task.finally(() => tasks.delete(task));
});
async function shutdown() {
  if (closing) return;
  closing = true;
  input.close();
  for (const controller of pending.values()) controller.abort();
  await Promise.allSettled(tasks);
  await client.close();
  process.exit(0);
}
input.on("close", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
