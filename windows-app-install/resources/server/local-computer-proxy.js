import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);


// server/mcp-bridge.ts
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

// server/control-client.ts
var DISENGAGED = { held: false, helpOpen: false };
var UNAVAILABLE = { held: true, helpOpen: false };
function createControlClient(options) {
  const url2 = options?.url ?? process.env.OMB_CONTROL_URL ?? "";
  const token2 = options?.token ?? process.env.OMB_CONTROL_TOKEN ?? "";
  const cacheMs = options?.cacheMs ?? 750;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const configured = Boolean(url2 && token2);
  const headers = { authorization: `Bearer ${token2}`, "content-type": "application/json" };
  let cachedAt = 0;
  let cached2 = DISENGAGED;
  async function read() {
    try {
      const res = await fetchImpl(url2, { headers, signal: AbortSignal.timeout(2e3) });
      if (!res.ok) return UNAVAILABLE;
      const body = await res.json().catch(() => null);
      if (typeof body?.held !== "boolean" || typeof body?.helpOpen !== "boolean") return UNAVAILABLE;
      return {
        held: body.held,
        helpOpen: body.helpOpen,
        ...typeof body.blockedReason === "string" && body.blockedReason.trim() ? { blockedReason: body.blockedReason } : {}
      };
    } catch {
      return UNAVAILABLE;
    }
  }
  return {
    configured,
    async state(fresh = false) {
      if (!configured) return DISENGAGED;
      const now = Date.now();
      if (!fresh && now - cachedAt < cacheMs) return cached2;
      cached2 = await read();
      cachedAt = Date.now();
      return cached2;
    },
    async requestHelp(reason) {
      if (!configured) return null;
      try {
        const res = await fetchImpl(url2, {
          method: "POST",
          headers,
          body: JSON.stringify({ reason }),
          signal: AbortSignal.timeout(2e3)
        });
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        return typeof body?.requestId === "string" && body.requestId ? body.requestId : null;
      } catch {
        return null;
      }
    },
    async expireHelp(requestId) {
      if (!configured || !requestId) return;
      try {
        await fetchImpl(url2, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ requestId }),
          signal: AbortSignal.timeout(2e3)
        });
      } catch {
      }
    }
  };
}
var CONTROL_REFUSAL_PLAIN = "A person has taken control of this computer, so this call was NOT performed. Do not retry it \u2014 the screen is changing under their hands. Pause this task, tell the person you are waiting for them to hand control back, and take a fresh screenshot before your next action once they have.";

// server/env-path.ts
import { execFile } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, extname, join } from "node:path";
function nvmBinDirs() {
  try {
    const base = join(homedir(), ".nvm", "versions", "node");
    return readdirSync(base).filter((v) => v.startsWith("v")).sort((a, b) => b.localeCompare(a, void 0, { numeric: true })).map((v) => join(base, v, "bin"));
  } catch {
    return [];
  }
}
function sealedFixture() {
  return process.env.OMB_TEST_SEALED_PATH === "1";
}
function knownDirs() {
  const home = homedir();
  return [
    join(home, ".local", "bin"),
    // claude installer default
    join(home, ".npm-global", "bin"),
    // npm prefix ~/.npm-global (claude, opencode)
    join(home, ".kimi-code", "bin"),
    // kimi-code installer
    join(home, ".grok", "bin"),
    // x.ai installer
    join(home, ".opencode", "bin"),
    // opencode installer
    join(home, ".claude", "local"),
    // claude "local install"
    // Machine-wide rather than under the (possibly temporary) home.
    ...sealedFixture() ? [] : [
      "/opt/homebrew/bin",
      // brew, Apple silicon
      "/usr/local/bin"
      // brew Intel / classic installs
    ],
    join(home, ".volta", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".asdf", "shims"),
    join(home, ".local", "share", "mise", "shims"),
    // mise installer
    join(home, ".deno", "bin"),
    join(home, "bin"),
    ...nvmBinDirs()
  ];
}
function windowsKnownDirs() {
  const home = homedir();
  const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  return [
    join(appData, "npm"),
    // npm -g shims: claude, codex
    join(home, ".grok", "bin"),
    // x.ai installer
    join(localAppData, "agy", "bin"),
    // Antigravity installer
    // Cursor installer: cursor-agent.* and its `agent` copies (MOCA-272)
    join(localAppData, "cursor-agent"),
    join(home, ".local", "bin"),
    // claude native installer
    join(home, ".claude", "local"),
    join(home, "bin"),
    // Factory droid installer (%USERPROFILE%\bin)
    join(home, ".bun", "bin"),
    join(home, ".deno", "bin"),
    join(home, "go", "bin"),
    join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin")
    // Docker Desktop installer
  ];
}
var cached = null;
var probed = false;
var loginShellPath = null;
var registeredDirs = [];
function augmentedPath() {
  if (cached === null) {
    cached = mergePaths([
      ...registeredDirs.filter((d) => existsSync(d)),
      ...process.env.OMB_EXTRA_PATH ? process.env.OMB_EXTRA_PATH.split(delimiter) : [],
      ...process.env.PATH ? process.env.PATH.split(delimiter) : [],
      // Keep the last successful login-shell result while a rescan starts a
      // fresh asynchronous probe. Otherwise resetPathCache() would make
      // rc-only CLIs disappear again for the response that triggered it.
      ...loginShellPath ? loginShellPath.split(delimiter) : [],
      // Both platforms scan their standard install locations; only the
      // login-shell probe below stays unix-only, since Windows has no
      // equivalent rc file to source.
      ...(process.platform === "win32" ? windowsKnownDirs() : knownDirs()).filter((d) => existsSync(d))
    ]);
  }
  if (!probed && !process.env.VITEST && !sealedFixture() && process.platform !== "win32") {
    probed = true;
    probeLoginShellPath();
  }
  return cached;
}
function mergePaths(parts) {
  return [...new Set(parts.filter(Boolean))].join(delimiter);
}
function probeLoginShellPath() {
  const shell = process.env.SHELL || "/bin/zsh";
  execFile(
    shell,
    ["-l", "-i", "-c", 'printf "__OMB_PATH__%s" "$PATH"'],
    { timeout: 5e3 },
    (err, stdout) => {
      if (err || !stdout) return;
      const m = /__OMB_PATH__([^\n]*)/.exec(stdout);
      if (!m || !m[1]) return;
      loginShellPath = m[1];
      cached = mergePaths([...(cached ?? "").split(delimiter), ...m[1].split(delimiter)]);
    }
  );
}
function splitCliString(cli) {
  const out = [];
  let cur = "";
  let quote = null;
  for (const ch of cli.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}
function isFile(p) {
  try {
    return statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
}
function whichWin(cli, env) {
  const exts = ((env ?? process.env).PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const probe = (base) => {
    const order = extname(base) ? [base, ...exts.map((e) => base + e)] : [...exts.map((e) => base + e), base];
    return order.find(isFile) ?? null;
  };
  if (/[\\/]/.test(cli) || /^[a-zA-Z]:/.test(cli)) return probe(cli);
  const path = env ? env.PATH ?? env.Path ?? "" : augmentedPath();
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    const hit = probe(join(dir, cli));
    if (hit) return hit;
  }
  return null;
}
function nodeExe(near, env) {
  const local = join(near, "node.exe");
  if (isFile(local)) return local;
  const onPath = whichWin("node.exe", env);
  if (onPath && extname(onPath).toLowerCase() === ".exe") return onPath;
  return process.versions.electron ? null : process.execPath;
}
function parseCmdShim(shim, env) {
  let text;
  try {
    text = readFileSync(shim, "utf8");
  } catch {
    return null;
  }
  const dir = dirname(shim);
  const npmEntry = /^SET "NP[MX]_CLI_JS=%~dp0\\([^"]+)"/im.exec(text);
  const targets = [...npmEntry ? [npmEntry] : [], ...text.matchAll(/"%~?dp0%?\\?([^"]+)"/g)].map((m) => join(dir, m[1])).filter((p) => isFile(p) && basename(p).toLowerCase() !== "node.exe");
  const script = targets.find((p) => /\.[cm]?js$/i.test(p));
  if (script) {
    const node = nodeExe(dir, env);
    if (node) return { command: node, args: [script] };
  }
  const exe = targets.find((p) => extname(p).toLowerCase() === ".exe");
  return exe ? { command: exe, args: [] } : null;
}
function parseNodeShebang(file, env) {
  let head = "";
  let fd = null;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(128);
    const n = readSync(fd, buf, 0, buf.length, 0);
    head = buf.subarray(0, n).toString("utf8").split("\n", 1)[0];
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
  if (!/^#!.*\bnode(\.exe)?\b/.test(head)) return null;
  const node = nodeExe(dirname(file), env);
  return node ? { command: node, args: [file] } : null;
}
function resolveWord(cli, args2, env) {
  if (process.platform !== "win32") return { command: cli, args: args2 };
  const file = whichWin(cli, env);
  if (!file) return { command: cli, args: args2 };
  const ext = extname(file).toLowerCase();
  if (ext === ".cmd" || ext === ".bat") {
    const direct = parseCmdShim(file, env);
    return direct ? { command: direct.command, args: [...direct.args, ...args2] } : { command: file, args: args2 };
  }
  if (ext === ".exe" || ext === ".com") return { command: file, args: args2 };
  const viaNode = parseNodeShebang(file, env);
  return viaNode ? { command: viaNode.command, args: [...viaNode.args, ...args2] } : { command: file, args: args2 };
}
function resolveCliSpawn(cli, args2, env) {
  const trimmed = cli.trim();
  if (trimmed.includes(" ") && existsSync(trimmed)) return resolveWord(trimmed, args2, env);
  const split = splitCliString(cli);
  if (split.length > 1 || split[0] !== trimmed) {
    const [head, ...fixed] = split;
    if (!head) return { command: cli, args: args2 };
    return resolveWord(head, [...fixed, ...args2], env);
  }
  return resolveWord(cli, args2, env);
}

// server/mcp-tool-schema.ts
var ROOT_COMBINATORS = ["anyOf", "oneOf", "allOf", "not"];
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function branches(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}
function objectShape(schema) {
  const properties = isObject(schema.properties) ? { ...schema.properties } : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((key) => typeof key === "string") : []);
  const adopt = (shape) => {
    for (const [key, value] of Object.entries(shape.properties)) if (!(key in properties)) properties[key] = value;
  };
  for (const branch of branches(schema.allOf)) {
    const shape = objectShape(branch);
    adopt(shape);
    for (const key of shape.required) required.add(key);
  }
  for (const keyword of ["anyOf", "oneOf"]) {
    const choices = branches(schema[keyword]).map(objectShape);
    if (choices.length === 0) continue;
    for (const choice of choices) adopt(choice);
    for (const key of choices[0].required) {
      if (choices.every((choice) => choice.required.includes(key))) required.add(key);
    }
  }
  return { properties, required: [...required] };
}
function describesObject(type) {
  return type === void 0 || type === "object" || Array.isArray(type) && type.includes("object");
}
function providerSafeInputSchema(schema) {
  if (!isObject(schema) || !describesObject(schema.type)) return { type: "object", properties: {} };
  if (schema.type === "object" && ROOT_COMBINATORS.every((keyword) => !(keyword in schema))) return schema;
  const { properties, required } = objectShape(schema);
  const safe = { ...schema, type: "object", properties };
  for (const keyword of ROOT_COMBINATORS) delete safe[keyword];
  if (required.length > 0) safe.required = required;
  else delete safe.required;
  return safe;
}
function createToolListNormalizer() {
  const pending = /* @__PURE__ */ new Set();
  const idKey = (id) => `${typeof id}:${String(id)}`;
  return {
    observeRequest(line) {
      let frame;
      try {
        frame = JSON.parse(line);
      } catch {
        return;
      }
      if (isObject(frame) && frame.method === "tools/list" && (typeof frame.id === "number" || typeof frame.id === "string")) {
        pending.add(idKey(frame.id));
      }
    },
    rewriteResponse(line) {
      if (pending.size === 0) return line;
      let frame;
      try {
        frame = JSON.parse(line);
      } catch {
        return line;
      }
      if (!isObject(frame) || "method" in frame || !pending.delete(idKey(frame.id))) return line;
      if (!isObject(frame.result) || !Array.isArray(frame.result.tools)) return line;
      let changed = false;
      const tools = frame.result.tools.map((tool) => {
        if (!isObject(tool)) return tool;
        const inputSchema = providerSafeInputSchema(tool.inputSchema);
        if (inputSchema === tool.inputSchema) return tool;
        changed = true;
        return { ...tool, inputSchema };
      });
      return changed ? JSON.stringify({ ...frame, result: { ...frame.result, tools } }) : line;
    }
  };
}

// server/mcp-bridge.ts
var BRIDGE_INACTIVITY_MS = 45e3;
var PROBE_TIMEOUT_MS = 1e4;
function runLivenessProbe(probe, timeoutMs = PROBE_TIMEOUT_MS, env) {
  return new Promise((resolve) => {
    const child = spawn(probe.command, probe.args, {
      shell: false,
      env: env ?? { ...process.env, PATH: augmentedPath() },
      stdio: ["ignore", "ignore", "ignore"]
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(false);
    }, timeoutMs);
    timer.unref?.();
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}
function createInactivityWatchdog(options) {
  let timer = null;
  let stopped = false;
  let probing = false;
  let touchedWhileProbing = false;
  const arm = () => {
    if (stopped) return;
    timer = setTimeout(fire, options.inactivityMs);
    timer.unref?.();
  };
  const settleProbe = (alive) => {
    probing = false;
    if (stopped) return;
    if (alive || touchedWhileProbing) {
      arm();
      return;
    }
    options.onDead();
  };
  const fire = () => {
    probing = true;
    touchedWhileProbing = false;
    void options.probe().then(settleProbe, () => settleProbe(false));
  };
  arm();
  return {
    touch() {
      if (stopped) return;
      if (probing) {
        touchedWhileProbing = true;
        return;
      }
      if (timer) clearTimeout(timer);
      arm();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
}
function createLineSplitter(onLine) {
  let pending = "";
  const decoder = new StringDecoder("utf8");
  return {
    push(chunk) {
      pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
      let newline;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        onLine(line);
      }
    },
    flush() {
      pending += decoder.end();
      if (pending) onLine(pending);
      pending = "";
    }
  };
}
function createGateInterceptor(options) {
  const refusalText = options.refusalText ?? CONTROL_REFUSAL_PLAIN;
  let queue = Promise.resolve();
  return (line) => {
    queue = queue.then(async () => {
      let frame = null;
      try {
        frame = JSON.parse(line);
      } catch {
      }
      if (!frame || frame.method !== "tools/call") {
        options.forward(line);
        return;
      }
      const held = await options.isHeld().catch(() => true);
      if (!held) {
        options.forward(line);
        return;
      }
      options.refuse(
        JSON.stringify({
          jsonrpc: "2.0",
          id: frame.id ?? null,
          result: { content: [{ type: "text", text: options.getRefusalReason?.() ?? refusalText }], isError: true }
        })
      );
    });
    return queue;
  };
}
function createMcpBridgeInterceptor(options) {
  const afterPing = options.gate ? createGateInterceptor({
    isHeld: options.gate.isHeld,
    forward: options.forward,
    refuse: options.answer,
    refusalText: options.gate.refusalText,
    getRefusalReason: options.gate.getRefusalReason
  }) : (line) => {
    options.forward(line);
  };
  return (line) => {
    let frame = null;
    try {
      frame = JSON.parse(line);
    } catch {
    }
    if (frame && frame.method === "ping") {
      if (frame.id !== void 0) {
        options.answer(JSON.stringify({ jsonrpc: "2.0", id: frame.id, result: {} }));
      }
      return;
    }
    return afterPing(line);
  };
}
function runMcpBridge(options) {
  const env = options.env ?? { ...process.env, PATH: augmentedPath() };
  const { command: command2, args: args2 } = resolveCliSpawn(options.command, options.args, env);
  const child = spawn(command2, args2, {
    shell: false,
    env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stdin.on("error", () => {
  });
  child.stderr.pipe(process.stderr);
  const client = options.gate ? createControlClient({ url: options.gate.url, token: options.gate.token }) : null;
  let refusalReason;
  const answer = (line) => process.stdout.write(line + "\n");
  const forward = (line) => child.stdin.write(line + "\n");
  const intercept = createMcpBridgeInterceptor({
    answer,
    forward,
    ...options.gate ? {
      gate: {
        isHeld: async () => {
          refusalReason = void 0;
          const state = await client.state(true);
          refusalReason = state.blockedReason;
          return state.held;
        },
        getRefusalReason: () => refusalReason
      }
    } : {}
  });
  const toolLists = createToolListNormalizer();
  let pendingInput = Promise.resolve();
  const inbound = createLineSplitter((line) => {
    toolLists.observeRequest(line);
    const completion = intercept(line);
    if (completion) pendingInput = completion;
  });
  const onStdin = (chunk) => inbound.push(chunk);
  process.stdin.on("data", onStdin);
  process.stdin.on("end", () => {
    inbound.flush();
    void pendingInput.finally(() => child.stdin.end());
  });
  const outbound = createLineSplitter((line) => process.stdout.write(toolLists.rewriteResponse(line) + "\n"));
  child.stdout.on("data", (chunk) => outbound.push(chunk));
  child.stdout.on("end", () => outbound.flush());
  const detach = () => {
    process.stdin.off("data", onStdin);
    process.stdin.pause();
  };
  let watchdog = null;
  if (options.liveness) {
    const liveness = options.liveness;
    watchdog = createInactivityWatchdog({
      inactivityMs: BRIDGE_INACTIVITY_MS,
      probe: () => runLivenessProbe(liveness, PROBE_TIMEOUT_MS, options.env),
      onDead: () => {
        process.stderr.write(
          `${options.label} transport went silent and stopped answering liveness probes; ending the bridge
`
        );
        process.exitCode = 1;
        detach();
        child.kill("SIGKILL");
        const failsafe = setTimeout(() => process.exit(1), 2e3);
        failsafe.unref?.();
      }
    });
    const touch = () => watchdog?.touch();
    process.stdin.on("data", touch);
    child.stdout.on("data", touch);
    child.stderr.on("data", touch);
  }
  child.on("error", (error) => {
    process.stderr.write(`could not connect to ${options.label}: ${error.message}
`);
    process.exitCode = 1;
    watchdog?.stop();
    detach();
  });
  child.on("close", (code, signal) => {
    if (signal) process.stderr.write(`${options.label} connection ended with ${signal}
`);
    process.exitCode = process.exitCode ?? code ?? 1;
    watchdog?.stop();
    detach();
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => child.kill(signal));
  }
}

// server/local-computer-proxy.ts
var {
  OMB_CUA_COMMAND: command,
  OMB_CUA_ARGS: encodedArgs,
  OMB_CONTROL_URL: url,
  OMB_CONTROL_TOKEN: token,
  ...childEnv
} = process.env;
var args;
try {
  const parsed = JSON.parse(encodedArgs ?? "");
  const endpoint = new URL(url ?? "");
  if (!command?.trim() || command.includes("\0") || !Array.isArray(parsed) || !parsed.every((arg) => typeof arg === "string" && !arg.includes("\0")) || !token || !["http:", "https:"].includes(endpoint.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.username || endpoint.password) {
    throw new Error("invalid connection");
  }
  args = parsed;
} catch {
  process.stderr.write("invalid local computer proxy connection\n");
  process.exit(2);
}
runMcpBridge({
  command,
  args,
  env: { ...childEnv, PATH: augmentedPath() },
  label: "Local Cua Driver",
  gate: { url, token }
});
