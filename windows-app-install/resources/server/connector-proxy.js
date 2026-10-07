import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);


// server/connector-proxy.ts
import readline from "node:readline";
import { randomUUID } from "node:crypto";

// shared/wire.ts
var CONNECTOR_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
var CONNECTOR_TOOL_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;

// server/connector-verdict.ts
function serviceSlugFor(tool) {
  const underscore = tool.indexOf("_");
  if (underscore <= 0) return null;
  return tool.slice(0, underscore).toLowerCase();
}
function serviceSlugForCandidates(tool, candidates) {
  let match = null;
  for (const candidate of candidates) {
    if (tool.startsWith(candidate.toUpperCase() + "_") && (match === null || candidate.length > match.length)) {
      match = candidate;
    }
  }
  return match;
}

// server/connector-advertisement.ts
var CONNECTOR_ALLOWED_TOOLS_ENV = "OMB_CONNECTOR_ALLOWED_TOOLS";
var CONNECTOR_SERVICE_SLUGS_ENV = "OMB_CONNECTOR_SERVICE_SLUGS";
var CONNECTOR_ALLOWED_TOOLS_MAX_BYTES = 32 * 1024;
var CONNECTOR_SERVICE_SLUGS_MAX_BYTES = 32 * 1024;
var CONNECTOR_META_TOOLS = [
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
  // Session-level connection meta-tools. COMPOSIO_MANAGE_CONNECTIONS ships
  // in every Composio session; COMPOSIO_WAIT_FOR_CONNECTIONS is opt-in and
  // off by default. They prefix as service "composio", which no grant
  // names, so they ride this list instead of CONNECTION_TOOL_SUFFIXES —
  // connector-proxy intercepts their calls to surface connection cards.
  // The filter only keeps names upstream actually lists, so advertising an
  // opted-out tool changes nothing.
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_WAIT_FOR_CONNECTIONS"
];
var CONNECTION_TOOL_SUFFIXES = ["_MANAGE_CONNECTIONS", "_WAIT_FOR_CONNECTIONS"];
function parseConnectorAllowedToolsEnv(raw) {
  if (!raw) return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const grants = {};
  for (const [slug, grant] of Object.entries(value)) {
    if (!CONNECTOR_SLUG_PATTERN.test(slug)) return null;
    if (!grant || typeof grant !== "object" || Array.isArray(grant)) return null;
    const tools = grant.tools;
    if (tools === "*") {
      grants[slug] = { tools: "*" };
      continue;
    }
    if (!Array.isArray(tools) || tools.length === 0) return null;
    if (!tools.every((tool) => typeof tool === "string" && CONNECTOR_TOOL_NAME_PATTERN.test(tool))) {
      return null;
    }
    grants[slug] = { tools };
  }
  return grants;
}
function parseConnectorServiceSlugsEnv(raw) {
  if (!raw) return [];
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.every((slug) => typeof slug === "string" && CONNECTOR_SLUG_PATTERN.test(slug)) ? value : [];
}
function connectorToolAdvertised(name, grants, candidates = []) {
  if (Object.keys(grants).length > 0 && CONNECTOR_META_TOOLS.includes(name)) return true;
  const service = serviceSlugForCandidates(name, candidates) ?? serviceSlugFor(name);
  const grant = service === null ? void 0 : grants[service];
  if (!grant) return false;
  if (grant.tools === "*") return true;
  if (grant.tools.includes(name)) return true;
  return CONNECTION_TOOL_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
function filterToolsListFrame(frame, grants, candidates = []) {
  const result = frame.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return frame;
  const tools = result.tools;
  if (!Array.isArray(tools)) return frame;
  const kept = tools.filter((tool) => {
    const name = tool && typeof tool === "object" && !Array.isArray(tool) ? tool.name : void 0;
    return typeof name === "string" ? connectorToolAdvertised(name, grants, candidates) : true;
  });
  return { ...frame, result: { ...result, tools: kept } };
}

// server/connector-proxy.ts
var UPSTREAM = process.env.OMB_CONNECTOR_UPSTREAM_URL ?? "";
var HARNESS = process.env.OMB_HARNESS_URL ?? "http://127.0.0.1:8799";
var BOT_ID = process.env.OMB_BOT_ID ?? "";
var THREAD_ID = process.env.OMB_THREAD_ID ?? "";
var TOKEN = process.env.OMB_CONNECTOR_TOKEN ?? process.env.OMB_COMMS_TOKEN ?? "";
var ALLOWED_TOOLS = parseConnectorAllowedToolsEnv(process.env[CONNECTOR_ALLOWED_TOOLS_ENV]);
var SERVICE_SLUGS = parseConnectorServiceSlugsEnv(process.env[CONNECTOR_SERVICE_SLUGS_ENV]);
var MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
var INITIALIZE_RELAY_TIMEOUT_MS = 1e3;
var RELAY_TIMEOUT_MS = 10 * 6e4;
function parsedHeaders() {
  try {
    const value = JSON.parse(process.env.OMB_CONNECTOR_UPSTREAM_HEADERS ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry) => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}
var upstreamHeaders = parsedHeaders();
var upstreamSessionId = "";
var send = (message) => process.stdout.write(`${JSON.stringify(message)}
`);
function textResult(id, text, isError = false) {
  return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], ...isError ? { isError: true } : {} } };
}
function jsonRpcError(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32e3, message } };
}
function initializeResult(id, protocolVersion) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: typeof protocolVersion === "string" && protocolVersion ? protocolVersion : "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "openmausbot-connectors", version: "1" }
    }
  };
}
async function readBounded(response) {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_RESPONSE_BYTES) throw new Error("connector response exceeded 20 MB");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("connector response exceeded 20 MB");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
function parseUpstream(text, id) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const frames = trimmed.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  return frames.findLast((frame) => frame.id === id) ?? frames.at(-1) ?? null;
}
async function relay(message, timeoutMs = RELAY_TIMEOUT_MS) {
  if (!UPSTREAM) throw new Error("connected apps are unavailable");
  const response = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...upstreamHeaders,
      ...upstreamSessionId ? { "mcp-session-id": upstreamSessionId } : {}
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const nextSession = response.headers.get("mcp-session-id");
  if (nextSession) upstreamSessionId = nextSession;
  if (!response.ok) throw new Error(`connector service returned HTTP ${response.status}`);
  return parseUpstream(await readBounded(response), message.id);
}
function connectorAdds(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return [];
  const toolkits = args.toolkits;
  if (!Array.isArray(toolkits)) return [];
  const seen = /* @__PURE__ */ new Set();
  const requests = [];
  for (const item of toolkits) {
    if (typeof item === "string") {
      const slug2 = item.trim().toLowerCase();
      const key2 = JSON.stringify([slug2, ""]);
      if (!seen.has(key2)) {
        seen.add(key2);
        requests.push({ slug: slug2 });
      }
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item;
    const action = String(row.action ?? "add").toLowerCase();
    if (!["add", "connect", "initiate"].includes(action)) continue;
    const slug = typeof row.toolkit === "string" ? row.toolkit : row.name;
    if (typeof slug !== "string") continue;
    const normalized = slug.trim().toLowerCase();
    const alias = (typeof row.alias === "string" ? row.alias : typeof row.account === "string" ? row.account : "").trim();
    const key = JSON.stringify([normalized, alias.toLowerCase()]);
    if (seen.has(key)) continue;
    seen.add(key);
    requests.push({ slug: normalized, ...alias ? { alias } : {} });
  }
  return requests;
}
async function showConnectorCards(items) {
  const response = await fetch(`${HARNESS}/api/internal/connectors/request`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ botId: BOT_ID, threadId: THREAD_ID, items, resumeKey: randomUUID() }),
    signal: AbortSignal.timeout(3e4)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(String(body.error ?? `could not show connection card (HTTP ${response.status})`));
  }
}
async function handle(message) {
  const id = message.id;
  const method = String(message.method ?? "");
  if (method === "notifications/initialized" || method === "initialized") {
    if (UPSTREAM) void relay(message).catch(() => {
    });
    return;
  }
  if (method === "initialize") {
    if (UPSTREAM) {
      try {
        await relay(message, INITIALIZE_RELAY_TIMEOUT_MS);
      } catch {
      }
    }
    if (id !== void 0) {
      const params = message.params ?? {};
      send(initializeResult(id, params.protocolVersion));
    }
    return;
  }
  if (method === "tools/call") {
    const params = message.params ?? {};
    const name = String(params.name ?? "");
    const requests = /MANAGE_CONNECTIONS$/i.test(name) ? connectorAdds(params.arguments) : [];
    if (requests.length) {
      await showConnectorCards(requests);
      const labels = requests.map((r) => r.alias ? `${r.slug} (${r.alias})` : r.slug).join(", ");
      send(textResult(
        id,
        `OpenMausBot showed the user a secure connection card for ${labels}. End this turn now. The app will continue the task automatically after the connection finishes.`
      ));
      return;
    }
    if (/WAIT_FOR_CONNECTIONS$/i.test(name)) {
      send(textResult(id, "OpenMausBot is handling connection completion and will continue the task automatically."));
      return;
    }
  }
  try {
    const response = await relay(message);
    if (response && id !== void 0) {
      send(method === "tools/list" && ALLOWED_TOOLS ? filterToolsListFrame(response, ALLOWED_TOOLS, SERVICE_SLUGS) : response);
    }
  } catch (error) {
    if (id === void 0) return;
    const messageText = error instanceof Error ? error.message : String(error);
    if (method === "tools/call") send(textResult(id, messageText, true));
    else send(jsonRpcError(id, messageText));
  }
}
var input = readline.createInterface({ input: process.stdin, terminal: false });
input.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  void handle(message).catch((error) => {
    if (message.id === void 0) return;
    const method = String(message.method ?? "");
    const messageText = error instanceof Error ? error.message : String(error);
    if (method === "tools/call") send(textResult(message.id, messageText, true));
    else send(jsonRpcError(message.id, messageText));
  });
});
input.on("close", () => process.exit(0));
