import { augmentedPath } from "./env-path.js";
import { PROVIDER_CREDENTIAL_ENV, stripWorkspaceCredentialEnv, } from "./config.js";
import { createLineSplitter } from "./mcp-bridge.js";
import { McpHttpError, RemoteMcpClient } from "./mcp-http.js";
import { discoverMcpAuth } from "./mcp-oauth-discovery.js";
import { isRemoteMcpServer } from "./mcp-registry.js";
import { killCliTree, spawnCli } from "./procs.js";
export const SIGN_IN_REQUIRED = "This server needs you to sign in.";
const MAX_STDOUT_BYTES = 1_048_576;
const MAX_TOOLS = 100;
const DEFAULT_TIMEOUT_MS = 8_000;
function probeEnvironment(server) {
    const env = { ...process.env, PATH: augmentedPath() };
    stripWorkspaceCredentialEnv(env);
    for (const key of PROVIDER_CREDENTIAL_ENV)
        delete env[key];
    Object.assign(env, server.env);
    return env;
}
function publicProbeError(kind) {
    if (kind === "spawn")
        return "Could not start this command. Check that it is installed and executable.";
    if (kind === "timeout")
        return "The server did not answer in time.";
    if (kind === "closed")
        return "The server stopped before the MCP handshake finished.";
    if (kind === "cancelled")
        return "Connection test was cancelled.";
    return "The command did not return a valid MCP tools list.";
}
function redactConfiguredValues(value, secrets) {
    let redacted = value;
    for (const secret of Object.values(secrets)) {
        if (secret)
            redacted = redacted.split(secret).join("[redacted]");
    }
    return redacted;
}
/** The bounded, redacted tool list the renderer may see. `secrets` are the
 * configured values (env or header values) a careless server might echo. */
function publicTools(raw, secrets) {
    const tools = [];
    for (const entry of raw.slice(0, MAX_TOOLS)) {
        if (!entry || typeof entry !== "object")
            continue;
        const candidate = entry;
        if (typeof candidate.name !== "string" || !candidate.name.trim())
            continue;
        tools.push({
            name: redactConfiguredValues(candidate.name, secrets).slice(0, 200),
            ...(typeof candidate.description === "string"
                ? { description: redactConfiguredValues(candidate.description, secrets).slice(0, 500) }
                : {}),
        });
    }
    return tools;
}
/** Prove the MCP handshake and list the tools of one configured server,
 * whichever way it is reached. Neither path returns anything the renderer
 * must not see: child stderr, environment values, header values. */
export function probeMcpServer(server, timeoutMs = DEFAULT_TIMEOUT_MS, signal) {
    return isRemoteMcpServer(server)
        ? probeRemoteMcpServer(server, timeoutMs, signal)
        : probeStdioMcpServer(server, timeoutMs, signal);
}
/** Connect to a remote server over its transport, bounded by the same
 * timeout as a command. HTTP status codes are safe to show and are the one
 * detail that tells a wrong token from a wrong address. */
async function probeRemoteMcpServer(server, timeoutMs, signal) {
    if (signal?.aborted)
        return { ok: false, error: publicProbeError("cancelled") };
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const client = new RemoteMcpClient(server);
    try {
        await client.initialize("OpenMausBot", combined);
        const result = await client.request("tools/list", {}, combined);
        const tools = result && typeof result === "object" ? result.tools : undefined;
        if (!Array.isArray(tools))
            return { ok: false, error: "The server did not return a valid MCP tools list." };
        const secrets = server.oauth?.clientSecret ? { ...server.headers, "oauth.clientSecret": server.oauth.clientSecret } : server.headers;
        return { ok: true, tools: publicTools(tools, secrets) };
    }
    catch (error) {
        if (signal?.aborted)
            return { ok: false, error: publicProbeError("cancelled") };
        if (timeout.aborted)
            return { ok: false, error: publicProbeError("timeout") };
        // A 401 that names an OAuth sign-in is not a wrong address or header:
        // the person has to sign in. Anything else keeps the plain status.
        if (error instanceof McpHttpError && error.status === 401) {
            const discovery = AbortSignal.timeout(5_000);
            const meta = await discoverMcpAuth(server.url, error.wwwAuthenticate ?? null, {
                signal: signal ? AbortSignal.any([signal, discovery]) : discovery,
            }).catch(() => null);
            if (meta)
                return { ok: false, auth: "required", error: SIGN_IN_REQUIRED };
        }
        if (error instanceof McpHttpError && error.kind === "status") {
            return { ok: false, error: `The server answered HTTP ${error.status}. Check the address and headers.` };
        }
        if (error instanceof McpHttpError && error.kind === "protocol") {
            return { ok: false, error: "The server did not return a valid MCP tools list." };
        }
        return { ok: false, error: "Could not reach this address. Check the URL and your network." };
    }
    finally {
        await client.close().catch(() => { });
    }
}
/** Start one stdio server long enough to prove the MCP handshake and list its
 * tools. It is always reaped, never inherits OpenMaus credentials, and never
 * returns child stderr or environment values to the renderer. */
function probeStdioMcpServer(server, timeoutMs, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve({ ok: false, error: publicProbeError("cancelled") });
            return;
        }
        let child;
        try {
            child = spawnCli(server.command, server.args, {
                cwd: process.cwd(),
                env: probeEnvironment(server),
                stdio: ["pipe", "pipe", "pipe"],
            });
        }
        catch {
            resolve({ ok: false, error: publicProbeError("spawn") });
            return;
        }
        let settled = false;
        let stdoutBytes = 0;
        let initialized = false;
        let timer;
        const onAbort = () => finish({ ok: false, error: publicProbeError("cancelled") });
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            if (timer)
                clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            killCliTree(child);
            resolve(result);
        };
        const write = (frame) => {
            try {
                child.stdin.write(`${JSON.stringify(frame)}\n`);
            }
            catch {
                finish({ ok: false, error: publicProbeError("closed") });
            }
        };
        const splitter = createLineSplitter((line) => {
            if (settled || !line.trim())
                return;
            let frame;
            try {
                frame = JSON.parse(line);
            }
            catch {
                return;
            }
            if (!frame || typeof frame !== "object")
                return;
            const value = frame;
            if (value.id === 1 && value.result && !initialized) {
                initialized = true;
                write({ jsonrpc: "2.0", method: "notifications/initialized" });
                write({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
                return;
            }
            if (value.id !== 2)
                return;
            const result = value.result;
            if (!Array.isArray(result?.tools)) {
                finish({ ok: false, error: publicProbeError("protocol") });
                return;
            }
            finish({ ok: true, tools: publicTools(result.tools, server.env) });
        });
        timer = setTimeout(() => {
            finish({ ok: false, error: publicProbeError("timeout") });
        }, timeoutMs);
        signal?.addEventListener("abort", onAbort, { once: true });
        child.stdout.on("data", (chunk) => {
            stdoutBytes += chunk.byteLength;
            if (stdoutBytes > MAX_STDOUT_BYTES) {
                finish({ ok: false, error: publicProbeError("protocol") });
                return;
            }
            splitter.push(chunk);
        });
        // Drain without retaining it. Child stderr often contains secrets or
        // arbitrary native logs and is not part of the MCP protocol.
        child.stderr.resume();
        child.once("error", () => finish({ ok: false, error: publicProbeError("spawn") }));
        child.once("close", () => finish({ ok: false, error: publicProbeError("closed") }));
        if (signal?.aborted) {
            onAbort();
            return;
        }
        write({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: { name: "OpenMausBot", version: "probe" },
            },
        });
    });
}
