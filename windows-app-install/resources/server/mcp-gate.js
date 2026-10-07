import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);


// server/mcp-gate.ts
import { spawn as spawn2 } from "node:child_process";
import { mkdirSync, readdirSync as readdirSync2, rmSync, statSync as statSync2, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";
import { createInterface } from "node:readline";

// shared/tool-scope.ts
var SERVER_NAME = /^[a-z][a-z0-9_-]{0,31}$/;
var CONTROL_CHARACTER = /[\x00-\x1f\x7f]/;
var MAX_SELECTORS = 256;
var MAX_SELECTOR_LENGTH = 1024;
function validName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.length <= MAX_SELECTOR_LENGTH && !CONTROL_CHARACTER.test(name) && !name.includes("*");
}
function selectorIdentity(selector) {
  if (selector.length > MAX_SELECTOR_LENGTH || CONTROL_CHARACTER.test(selector)) return;
  if (selector.startsWith("native:")) {
    const name = selector.slice(7);
    if (name === "*" || validName(name)) return { kind: "native", name };
  } else if (selector.startsWith("mcp:")) {
    const separator = selector.indexOf(":", 4);
    if (separator < 0) return;
    const server = selector.slice(4, separator);
    const name = selector.slice(separator + 1);
    if (SERVER_NAME.test(server) && (name === "*" || validName(name))) {
      return { kind: "mcp", server, name };
    }
  }
}
function parseToolScope(value) {
  if (value === void 0) return { ok: true, scope: void 0 };
  const invalid = { ok: false, error: "Tool selection must contain only valid allow and deny lists." };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid;
  const scope2 = {};
  for (const key of Reflect.ownKeys(value)) {
    if (key !== "allow" && key !== "deny") return invalid;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return invalid;
    const list = descriptor.value;
    if (!Array.isArray(list) || list.length > MAX_SELECTORS) return invalid;
    if (!Array.from(list).every((entry) => typeof entry === "string" && selectorIdentity(entry))) return invalid;
    scope2[key] = [...new Set(list)];
  }
  return { ok: true, scope: scope2 };
}
function matches(selector, tool) {
  const selected = selectorIdentity(selector);
  return selected?.kind === tool.kind && (selected.kind !== "mcp" || tool.kind === "mcp" && selected.server === tool.server) && (selected.name === "*" || selected.name === tool.name);
}
function permits(scope2, tool) {
  if (!validName(tool.name) || tool.kind === "mcp" && !SERVER_NAME.test(tool.server)) return false;
  return (scope2?.allow === void 0 || scope2.allow.some((selector) => matches(selector, tool))) && !scope2?.deny?.some((selector) => matches(selector, tool));
}
function allowsTool(scope2, tool) {
  const parsed = parseToolScope(scope2);
  return parsed.ok && permits(parsed.scope, tool);
}

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
function resolveWord(cli, args, env) {
  if (process.platform !== "win32") return { command: cli, args };
  const file = whichWin(cli, env);
  if (!file) return { command: cli, args };
  const ext = extname(file).toLowerCase();
  if (ext === ".cmd" || ext === ".bat") {
    const direct = parseCmdShim(file, env);
    return direct ? { command: direct.command, args: [...direct.args, ...args] } : { command: file, args };
  }
  if (ext === ".exe" || ext === ".com") return { command: file, args };
  const viaNode = parseNodeShebang(file, env);
  return viaNode ? { command: viaNode.command, args: [...viaNode.args, ...args] } : { command: file, args };
}
function resolveCliSpawn(cli, args, env) {
  const trimmed = cli.trim();
  if (trimmed.includes(" ") && existsSync(trimmed)) return resolveWord(trimmed, args, env);
  const split = splitCliString(cli);
  if (split.length > 1 || split[0] !== trimmed) {
    const [head, ...fixed] = split;
    if (!head) return { command: cli, args };
    return resolveWord(head, [...fixed, ...args], env);
  }
  return resolveWord(cli, args, env);
}

// server/mcp-trim.ts
var DEFAULT_RESULT_BUDGET = 8e3;
var MIN_BUDGET = 512;
var fmt = (n) => n.toLocaleString("en-US");
function serialize(value) {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : null;
  } catch {
    return null;
  }
}
function fitArray(items, budget) {
  const kept = [];
  let used = 2;
  for (const item of items) {
    const json = serialize(item);
    if (json === null) break;
    const cost = json.length + (kept.length ? 1 : 0);
    if (kept.length && used + cost > budget) break;
    kept.push(item);
    used += cost;
  }
  return kept;
}
function arrayFields(value) {
  if (Array.isArray(value)) return [{ key: "", items: value }];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).filter((entry) => Array.isArray(entry[1])).map(([key, items]) => ({ key, items }));
}
function cutAt(text, chars) {
  const cut = text.slice(0, Math.max(0, chars));
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 55296 && last <= 56319 ? cut.slice(0, -1) : cut;
}
function marker(input) {
  const counts = input.dropped.filter((d) => d.kept < d.total).map((d) => `${d.key || "items"} ${fmt(d.kept)} of ${fmt(d.total)}`).join(", ");
  const what = input.structural ? counts ? ` Kept ${counts}.` : "" : " Cut mid-text, so what is above may be incomplete JSON.";
  const where = input.spillHint && input.spillPath ? ` The whole result is at ${JSON.stringify(input.spillPath)}; reading it costs as much as not trimming, so narrow the call first.` : " If you need more, call the tool again with a narrower query, a filter, or the next page.";
  return `

[OpenMausBot trimmed this tool result to fit the conversation: ${fmt(input.originalChars)} \u2192 ${fmt(input.keptChars)} characters.${what}${where}]`;
}
function trimStructured(parsed, budget) {
  const room = Math.max(MIN_BUDGET, budget);
  const current = serialize(parsed);
  if (current !== null && current.length <= room) return null;
  const fields = arrayFields(parsed);
  if (!fields.length) return null;
  const skeleton = Array.isArray(parsed) ? 2 : serialize({ ...parsed, ...Object.fromEntries(fields.map((f) => [f.key, []])) })?.length ?? Infinity;
  const share = Math.floor((room - skeleton) / fields.length);
  if (!Number.isFinite(skeleton) || share <= 0) return null;
  const dropped = [];
  let value;
  if (Array.isArray(parsed)) {
    const kept = fitArray(parsed, share);
    dropped.push({ key: "", kept: kept.length, total: parsed.length });
    value = kept;
  } else {
    const next = { ...parsed };
    for (const field of fields) {
      const kept = fitArray(field.items, share);
      dropped.push({ key: field.key, kept: kept.length, total: field.items.length });
      next[field.key] = kept;
    }
    value = next;
  }
  if (!dropped.some((d) => d.kept < d.total)) return null;
  const json = serialize(value);
  return json !== null && json.length <= room ? { value, dropped } : null;
}
function trimResultText(input) {
  const { text } = input;
  const budget = Math.max(MIN_BUDGET, input.budget ?? DEFAULT_RESULT_BUDGET);
  if (text.length <= budget) return { text, trimmed: false, originalChars: text.length };
  const room = Math.max(MIN_BUDGET, budget - 400);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = void 0;
  }
  const fields = parsed === void 0 ? [] : arrayFields(parsed);
  if (fields.length) {
    const skeleton = Array.isArray(parsed) ? 2 : serialize({ ...parsed, ...Object.fromEntries(fields.map((f) => [f.key, []])) })?.length ?? Infinity;
    const share = Math.floor((room - skeleton) / fields.length);
    if (Number.isFinite(skeleton) && share > 0) {
      const dropped = [];
      let value;
      if (Array.isArray(parsed)) {
        const kept = fitArray(parsed, share);
        dropped.push({ key: "", kept: kept.length, total: parsed.length });
        value = kept;
      } else {
        const next = { ...parsed };
        for (const field of fields) {
          const kept = fitArray(field.items, share);
          dropped.push({ key: field.key, kept: kept.length, total: field.items.length });
          next[field.key] = kept;
        }
        value = next;
      }
      const json = serialize(value);
      if (json !== null && json.length <= room) {
        return {
          text: json + marker({ originalChars: text.length, keptChars: json.length, dropped, spillPath: input.spillPath, spillHint: input.spillHint, structural: true }),
          trimmed: true,
          originalChars: text.length
        };
      }
    }
  }
  const cut = cutAt(text, room);
  return {
    text: cut + marker({ originalChars: text.length, keptChars: cut.length, dropped: [], spillPath: input.spillPath, spillHint: input.spillHint, structural: false }),
    trimmed: true,
    originalChars: text.length
  };
}

// server/procs.ts
import {
  spawn,
  execFile as execFile2
} from "node:child_process";
var cliGroups = /* @__PURE__ */ new WeakSet();
var stopping = /* @__PURE__ */ new WeakMap();
function killCliTree(child2, timeoutMs = 5e3) {
  const existing = stopping.get(child2);
  if (existing) return existing;
  const pid = child2.pid;
  if (!pid) return Promise.resolve(true);
  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return Promise.resolve(false);
  const run = stopCliTree(child2, pid, Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : 5e3);
  stopping.set(child2, run);
  void run.then((stopped) => {
    if (!stopped) stopping.delete(child2);
  });
  return run;
}
async function stopCliTree(child2, pid, timeoutMs) {
  const exited = () => child2.exitCode !== null || child2.signalCode !== null;
  if (process.platform !== "win32") {
    const group = cliGroups.has(child2);
    const settled = () => {
      if (!exited()) return false;
      if (!group) return true;
      try {
        process.kill(-pid, 0);
        return false;
      } catch (error) {
        return error.code === "ESRCH";
      }
    };
    const signal = (value) => {
      try {
        if (group) process.kill(-pid, value);
        else child2.kill(value);
      } catch {
        try {
          child2.kill(value);
        } catch {
        }
      }
    };
    const wait = async (ms) => {
      const deadline = Date.now() + ms;
      while (!settled()) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        await new Promise((resolve) => setTimeout(resolve, Math.min(25, remaining)));
      }
      return true;
    };
    if (settled()) return true;
    signal("SIGTERM");
    if (await wait(timeoutMs)) return true;
    signal("SIGKILL");
    return wait(1e3);
  }
  if (exited()) return true;
  return new Promise((resolve) => {
    let timer;
    let finished = false;
    const done = (stopped) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child2.off("close", closed);
      child2.off("exit", closed);
      resolve(stopped);
    };
    const closed = () => done(true);
    child2.once("close", closed);
    timer = setTimeout(() => done(false), timeoutMs);
    timer.unref?.();
    execFile2("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, (err) => {
      if (finished) return;
      if (!err) {
        if (exited()) done(true);
        else child2.once("exit", closed);
        return;
      }
      try {
        child2.kill();
      } catch {
      }
    });
  });
}

// server/mcp-gate.ts
function gateEnvironment() {
  if (process.argv.length === 2) return process.env;
  try {
    const key = process.argv[3];
    if (process.argv.length !== 4 || process.argv[2] !== "--config-env" || !key || !/^OMB_GATE_CONFIG_[a-f0-9]{64}$/.test(key)) throw new Error();
    const value = JSON.parse(process.env[key] ?? "");
    if (!value || typeof value !== "object" || Array.isArray(value) || !["OMB_GATE_NAME", "OMB_GATE_UPSTREAM", "OMB_GATE_TOOL_SCOPE"].every((name) => typeof value[name] === "string") || !Object.entries(value).every(([name, setting]) => GATE_ENV_KEYS.includes(name) && typeof setting === "string")) throw new Error();
    return value;
  } catch {
    process.stderr.write("mcp-gate: invalid private configuration\n");
    process.exit(1);
  }
}
var GATE_ENV_KEYS = ["OMB_GATE_NAME", "OMB_GATE_SPILL_DIR", "OMB_GATE_BUDGET", "OMB_GATE_UPSTREAM", "OMB_GATE_SPILL_HINT", "OMB_GATE_TOOL_SCOPE"];
var gateEnv = gateEnvironment();
var NAME = gateEnv.OMB_GATE_NAME || "mcp";
var SPILL_DIR = gateEnv.OMB_GATE_SPILL_DIR || "";
var rawBudget = Number(gateEnv.OMB_GATE_BUDGET);
var BUDGET = Number.isFinite(rawBudget) && rawBudget >= 0 ? rawBudget : DEFAULT_RESULT_BUDGET;
var SPILL_MAX_AGE_MS = 24 * 60 * 6e4;
var SPILL_HINT = gateEnv.OMB_GATE_SPILL_HINT === "1";
function fail(message) {
  process.stderr.write(`mcp-gate(${NAME}): ${message}
`);
  process.exit(1);
}
function toolScope() {
  const raw = gateEnv.OMB_GATE_TOOL_SCOPE;
  if (raw === void 0) return;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("invalid tool selection JSON");
  }
  const parsed = parseToolScope(value);
  if (!parsed.ok || parsed.scope === void 0) fail("invalid tool selection; check the bot's Access settings");
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(NAME)) fail("invalid MCP server identity for tool selection");
  return parsed.scope;
}
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function requestKey(id) {
  return typeof id === "string" || typeof id === "number" && Number.isFinite(id) ? `${typeof id}:${id}` : void 0;
}
function rejectRequest(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestKey(id) ? id : null, error: { code, message } })}
`);
}
function upstreamSpec() {
  let parsed;
  try {
    parsed = JSON.parse(gateEnv.OMB_GATE_UPSTREAM ?? "");
  } catch {
    fail("OMB_GATE_UPSTREAM is not valid JSON");
  }
  const spec2 = parsed;
  if (!spec2 || typeof spec2 !== "object" || typeof spec2.command !== "string" || !spec2.command) {
    fail("OMB_GATE_UPSTREAM needs a command");
  }
  return spec2;
}
function sweepSpill(dir) {
  let entries;
  try {
    entries = readdirSync2(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - SPILL_MAX_AGE_MS;
  for (const entry of entries) {
    try {
      const path = join2(dir, entry);
      if (statSync2(path).mtimeMs < cutoff) rmSync(path, { force: true });
    } catch {
    }
  }
}
var spilled = 0;
function spill(tool, text) {
  if (!SPILL_DIR) return void 0;
  const safeTool = tool.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 60) || "tool";
  const path = join2(SPILL_DIR, `${Date.now()}-${process.pid}-${spilled++}-${safeTool}.json`);
  try {
    mkdirSync(SPILL_DIR, { recursive: true, mode: 448 });
    writeFileSync(path, text, { mode: 384 });
    return path;
  } catch (error) {
    process.stderr.write(`mcp-gate(${NAME}): could not save the full result: ${String(error)}
`);
    return void 0;
  }
}
function trimCallResult(result, tool) {
  if (BUDGET === 0) return false;
  const content = result.content;
  if (!Array.isArray(content)) return false;
  const textBlocks = content.filter(
    (block) => Boolean(block) && typeof block === "object" && block.type === "text" && typeof block.text === "string"
  );
  const total = textBlocks.reduce((sum, block) => sum + block.text.length, 0);
  if (!textBlocks.length || total <= BUDGET) return false;
  const share = Math.floor(BUDGET / textBlocks.length);
  const path = spill(tool, textBlocks.map((block) => block.text).join("\n"));
  let trimmed = false;
  for (const block of textBlocks) {
    const outcome = trimResultText({ text: block.text, budget: share, spillPath: path, spillHint: SPILL_HINT, toolName: tool });
    if (!outcome.trimmed) continue;
    block.text = outcome.text;
    trimmed = true;
  }
  if (trimmed && result.structuredContent && typeof result.structuredContent === "object") {
    const structured = trimStructured(result.structuredContent, BUDGET);
    if (structured) result.structuredContent = structured.value;
  }
  return trimmed;
}
var scope = toolScope();
var spec = upstreamSpec();
if (SPILL_DIR) sweepSpill(SPILL_DIR);
var childEnv = { ...process.env, ...spec.env };
for (const key of Object.keys(childEnv)) if (key.startsWith("OMB_GATE_")) delete childEnv[key];
var resolved = resolveCliSpawn(spec.command, spec.args ?? []);
var child = spawn2(resolved.command, resolved.args, {
  stdio: ["pipe", "pipe", "pipe"],
  env: childEnv,
  shell: false,
  // a console app spawned from the desktop shell flashes a window otherwise
  ...process.platform === "win32" ? { windowsHide: true } : {}
});
var reaping = false;
var reapChild = () => {
  if (reaping) return;
  reaping = true;
  void killCliTree(child);
};
process.on("SIGTERM", () => {
  reapChild();
  process.exit(0);
});
process.on("SIGINT", () => {
  reapChild();
  process.exit(0);
});
process.on("exit", reapChild);
child.on("error", (error) => {
  process.stderr.write(`mcp-gate(${NAME}): could not start ${resolved.command}: ${String(error)}
`);
  process.exit(1);
});
child.stderr.pipe(process.stderr);
var pending = /* @__PURE__ */ new Map();
createInterface({ input: process.stdin }).on("line", (line) => {
  let message;
  if (line.trim()) {
    try {
      const parsed = JSON.parse(line);
      if (isRecord(parsed)) message = parsed;
    } catch {
      if (scope) return rejectRequest(null, -32700, "Invalid JSON-RPC frame");
    }
    if (scope && (!message || message.jsonrpc !== "2.0")) return rejectRequest(message?.id, -32600, "Invalid JSON-RPC frame");
  }
  const id = requestKey(message?.id);
  const params = isRecord(message?.params) ? message.params : void 0;
  if (scope && message?.method === "tools/call") {
    if (!id || typeof params?.name !== "string" || params.arguments !== void 0 && !isRecord(params.arguments)) {
      return rejectRequest(message.id, -32602, "Invalid tool call");
    }
    if (!allowsTool(scope, { kind: "mcp", server: NAME, name: params.name })) {
      return rejectRequest(message.id, -32602, "Tool selection excludes this tool. Check the bot's Access settings.");
    }
  }
  if (scope && message?.method === "tools/list" && !id) {
    return rejectRequest(message.id, -32600, "Tool listing needs a request ID");
  }
  if (id && typeof message?.method === "string") {
    if (scope && pending.has(id)) fail("duplicate request ID on a restricted connection");
    if (message.method === "tools/call") {
      pending.set(id, { kind: "call", tool: typeof params?.name === "string" ? params.name : "tool" });
    } else if (scope) {
      pending.set(id, { kind: message.method === "tools/list" ? "list" : "other" });
    }
  }
  child.stdin.write(`${line}
`);
});
process.stdin.on("end", () => child.stdin.end());
createInterface({ input: child.stdout }).on("line", (line) => {
  if (!line.trim()) return;
  let message;
  try {
    const parsed = JSON.parse(line);
    if (isRecord(parsed)) message = parsed;
  } catch {
    if (scope) fail("unreadable upstream frame on a restricted connection");
  }
  if (!message || scope && message.jsonrpc !== "2.0") {
    if (scope) fail("invalid upstream frame on a restricted connection");
    process.stdout.write(`${line}
`);
    return;
  }
  const id = typeof message.method === "string" ? void 0 : requestKey(message.id);
  const request = id === void 0 ? void 0 : pending.get(id);
  if (scope && id !== void 0 && !request) fail("unrequested upstream response on a restricted connection");
  if (id !== void 0) pending.delete(id);
  const result = message.result;
  if (scope && request?.kind === "list" && message.error === void 0) {
    if (!isRecord(result) || !Array.isArray(result.tools) || !result.tools.every((tool) => isRecord(tool) && typeof tool.name === "string" && tool.name.trim().length > 0) || result.nextCursor !== void 0 && typeof result.nextCursor !== "string") {
      return rejectRequest(message.id, -32603, "Invalid tool catalog on a restricted connection");
    }
    result.tools = result.tools.filter((tool) => allowsTool(scope, { kind: "mcp", server: NAME, name: tool.name }));
  }
  if (request?.kind === "call" && isRecord(result)) {
    try {
      if (trimCallResult(result, request.tool)) {
        process.stderr.write(`mcp-gate(${NAME}): trimmed ${request.tool} to ${BUDGET} chars
`);
      }
    } catch (error) {
      process.stderr.write(`mcp-gate(${NAME}): could not trim ${request.tool}: ${String(error)}
`);
      process.stdout.write(`${line}
`);
      return;
    }
  }
  process.stdout.write(`${JSON.stringify(message)}
`);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
