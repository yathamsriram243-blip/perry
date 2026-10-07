// Rung three of the hosting ladder: `openmausbot serve --tunnel` gives a
// server a public HTTPS address (https://c-<id>.openmausbot.com) with no
// domain, no proxy and no open port, through the same control plane and
// Cloudflare tunnel the desktop app already uses. Headless, so:
//
//   - the account and connector credentials live in a 0600 JSON file under
//     the data dir instead of the OS keychain (a server has none; a key kept
//     next to the ciphertext would be theatre), and its mode is re-tightened
//     on every open;
//   - cloudflared is fetched once into the data dir, by the same pinned
//     version + digest script the release build uses, when nothing usable is
//     on the machine;
//   - the tunnel's loopback gateway forwards to an IPC listener the harness
//     opens for it (OMB_TUNNEL_SOCKET), so to request-auth every public
//     request is "through a proxy" by construction and needs a paired
//     session — the loopback bind and its owner trust are untouched.
//
// Everything network- and process-shaped is the desktop's own code
// (electron/control-plane-client.mjs, companion-account-service.mjs,
// managed-companion-tunnel.mjs and the connector guardian): one
// implementation, so a fix lands in both.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANION_ACCOUNT_EMAIL_FIELD, COMPANION_INSTALLATION_ID_FIELD, createCompanionAccountService, resolveCompanionControlPlaneURL, } from "../electron/companion-account-service.mjs";
import { cleanupCompanionOriginEndpoint, createCompanionOriginEndpoint, MANAGED_COMPANION_ORIGIN_PORT, } from "../electron/companion-origin-gateway.mjs";
import { ControlPlaneError, createControlPlaneClient } from "../electron/control-plane-client.mjs";
import { createManagedCompanionTunnel, managedCompanionTunnelAccess, resolveCloudflaredBinary, } from "../electron/managed-companion-tunnel.mjs";
import { createSecureCredentialState } from "../electron/secure-credential-state.mjs";
import { writeFileAtomic } from "./atomic.js";
const HERE = dirname(fileURLToPath(import.meta.url));
export const TUNNEL_CREDENTIALS_FILE = "tunnel-account.json";
export const TUNNEL_RUNTIME_DIR = "tunnel-runtime";
function plainDocument(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return null;
    const document = {};
    for (const [key, entry] of Object.entries(value))
        document[key] = entry;
    return document;
}
export function openTunnelCredentials(dataDir) {
    const file = join(dataDir, TUNNEL_CREDENTIALS_FILE);
    let initial = {};
    let status = "empty";
    if (existsSync(file)) {
        try {
            // A file someone loosened (or an old umask) is tightened, not trusted as is.
            if (process.platform !== "win32" && (statSync(file).mode & 0o077) !== 0)
                chmodSync(file, 0o600);
            const parsed = plainDocument(JSON.parse(readFileSync(file, "utf8")));
            if (!parsed)
                throw new Error("not a JSON object");
            initial = parsed;
            status = "ok";
        }
        catch {
            status = "unavailable";
        }
    }
    const persist = (next) => {
        mkdirSync(dataDir, { recursive: true, mode: 0o700 });
        writeFileAtomic(file, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    };
    const state = createSecureCredentialState(initial, persist, { writable: status !== "unavailable" });
    return {
        file,
        status,
        read: () => state.read(),
        update: (derive, afterPersist) => state.update(derive, afterPersist),
    };
}
function stringField(document, field) {
    const value = document[field];
    return typeof value === "string" && value ? value : null;
}
export function describeTunnelAccount(document) {
    return {
        email: stringField(document, COMPANION_ACCOUNT_EMAIL_FIELD),
        address: managedCompanionTunnelAccess(document)?.endpoint ?? null,
        installationId: stringField(document, COMPANION_INSTALLATION_ID_FIELD),
    };
}
export function tunnelAccess(document) {
    return managedCompanionTunnelAccess(document);
}
/** The control plane's platform vocabulary. */
export function platformName(platform = process.platform) {
    return platform === "darwin" ? "darwin" : platform === "win32" ? "windows" : "linux";
}
const STOPPED_TUNNEL = { status: "stopped", ready: false };
/** The desktop honours OMB_CONTROL_PLANE_URL only in development builds; a
 * server's operator owns its environment, so it is honoured here always and
 * the caller says so in its output. One-shot commands (login, status) pass no
 * `recovery` and so start no background timers. */
export function createTunnelAccount(options) {
    const env = options.env ?? process.env;
    const credentials = openTunnelCredentials(options.dataDir);
    const controlPlane = resolveCompanionControlPlaneURL({ isPackaged: true, environment: env });
    const client = controlPlane ? createControlPlaneClient({ baseURL: controlPlane, fetchImpl: options.fetchImpl }) : null;
    const recovery = options.recovery;
    const service = createCompanionAccountService({
        client,
        readCredentials: () => credentials.read(),
        updateCredentials: (derive, afterPersist) => credentials.update(derive, afterPersist),
        identity: { name: options.machineName ?? hostname(), platform: platformName(), appVersion: options.version },
        newClientInstanceId: () => randomUUID(),
        ...(options.log ? { log: options.log } : {}),
        ...(recovery
            ? {
                autoRecover: true,
                companionIsOn: () => recovery.running() !== null,
                managedConnectionState: () => recovery.running()?.state() ?? STOPPED_TUNNEL,
                activatePersistedEndpoint: async () => {
                    const tunnel = recovery.running();
                    const access = tunnelAccess(credentials.read());
                    if (!tunnel || !access)
                        return tunnel?.state() ?? STOPPED_TUNNEL;
                    return tunnel.restart(access);
                },
                ...options.clock,
            }
            : {}),
    });
    return { service, credentials, controlPlane };
}
// ── a fleet's credential: no account file, no emailed code ───────────────
export const FLEET_CREDENTIAL_ENV = "OMB_INSTALLATION_CREDENTIAL";
/** A container the fleet starts carries its installation credential in the
 * environment. Nothing is written to disk and nobody types a code; the
 * address and connector token are fetched fresh at every start. */
export function fleetCredential(env = process.env) {
    const value = env[FLEET_CREDENTIAL_ENV]?.trim();
    return value ? value : null;
}
export async function fleetAccess(options) {
    const env = options.env ?? process.env;
    const controlPlane = resolveCompanionControlPlaneURL({ isPackaged: true, environment: env });
    if (!controlPlane)
        throw new Error("OMB_CONTROL_PLANE_URL is set but is not an https address");
    const client = createControlPlaneClient({ baseURL: controlPlane, fetchImpl: options.fetchImpl });
    try {
        const { endpoint, connectorToken } = await client.ensureEndpoint(options.credential);
        return { endpoint: endpoint.url, token: connectorToken };
    }
    catch (error) {
        if (error instanceof ControlPlaneError && error.status === 401) {
            throw new Error(`the installation credential in ${FLEET_CREDENTIAL_ENV} was rejected by ${controlPlane}; the fleet has to issue a new one`);
        }
        // The request id is what support looks the failure up by.
        const reference = error instanceof ControlPlaneError && error.requestId ? ` (reference ${error.requestId})` : "";
        throw new Error(`could not get this machine's public address from ${controlPlane}: ${error instanceof Error ? error.message : String(error)}${reference}`);
    }
}
// ── cloudflared and the guardian: where they are, or how to get them ──────
/** OMB_CLOUDFLARED_PATH, then the copy this command downloaded into the data
 * dir, then PATH. */
export function cloudflaredPath(dataDir, env = process.env) {
    return resolveCloudflaredBinary({ isPackaged: false, appPath: dataDir, environment: env });
}
/** The pinned-download script: bundled beside the server in a package or
 * image, the source in a checkout. */
export function prepareEntry(here = HERE) {
    const bundled = join(here, "prepare-cloudflared.js");
    return existsSync(bundled) ? bundled : resolve(here, "..", "scripts", "prepare-cloudflared.mjs");
}
/** The connector guardian (the process that owns the gateway and cloudflared
 * and tears both down if this process dies), same rule. */
export function guardianEntry(here = HERE) {
    const bundled = join(here, "tunnel-guardian.js");
    if (existsSync(bundled))
        return bundled;
    const source = resolve(here, "..", "electron", "managed-companion-guardian-main.mjs");
    return existsSync(source) ? source : null;
}
export async function ensureCloudflared(options) {
    const env = options.env ?? process.env;
    const found = cloudflaredPath(options.dataDir, env);
    if (found)
        return found;
    options.log(`downloading cloudflared once (pinned version and digest, about 40 MB) into ${options.dataDir}`);
    await new Promise((done, fail) => {
        const child = spawn(process.execPath, [prepareEntry(options.here), "--current", "--root", options.dataDir], {
            env,
            stdio: ["ignore", "inherit", "inherit"],
        });
        child.on("error", fail);
        child.on("exit", (code) => (code === 0 ? done() : fail(new Error(`the cloudflared download failed (exit ${code ?? "signal"})`))));
    });
    const staged = cloudflaredPath(options.dataDir, env);
    if (!staged)
        throw new Error("cloudflared was downloaded but is not where it should be; remove the data dir's dist-native folder and try again");
    return staged;
}
// ── the origin: an IPC path the harness listens on for the gateway ────────
export function createTunnelOrigin() {
    return createCompanionOriginEndpoint({ processId: process.pid });
}
export function cleanupTunnelOrigin(origin) {
    cleanupCompanionOriginEndpoint(origin);
}
/** The gateway listens on 127.0.0.1:<originPort> (the control plane points
 * the tunnel at 8812; OMB_TUNNEL_ORIGIN_PORT exists for tests) and forwards
 * to the harness's IPC socket. Verification polls the public address until
 * it answers as this app, then retries with backoff forever if it never does. */
export function startTunnel(options) {
    const env = options.env ?? process.env;
    const originPort = Number(env.OMB_TUNNEL_ORIGIN_PORT || MANAGED_COMPANION_ORIGIN_PORT);
    let current = { status: "stopped", ready: false };
    const tunnel = createManagedCompanionTunnel({
        binaryPath: options.binaryPath,
        guardianEntry: options.guardian,
        runtimeRoot: join(options.dataDir, TUNNEL_RUNTIME_DIR),
        originPort,
        environment: env,
        fetchImpl: options.fetchImpl,
        onChange: (state) => {
            current = state;
            options.onState?.(state);
        },
    });
    const started = tunnel.start({ endpoint: options.access.endpoint, token: options.access.token, originTarget: options.originTarget });
    return {
        address: options.access.endpoint,
        state: () => current,
        started,
        restart: (access) => tunnel.start({ endpoint: access.endpoint, token: access.token, originTarget: options.originTarget }),
        stop: async () => {
            await tunnel.stop();
        },
    };
}
/** One line per state change, for a terminal or a journal. */
export function describeTunnelState(state, address) {
    switch (state.status) {
        case "starting":
            return "tunnel: connecting…";
        case "ready":
            return `tunnel: live at ${address}`;
        case "retrying":
            return `tunnel: ${state.error ?? "not verified yet"} retrying in ${Math.max(1, Math.round((state.retryInMs ?? 0) / 1000))}s`;
        case "stopped":
            return "tunnel: stopped";
        default:
            return `tunnel: ${state.error ?? state.status}`;
    }
}
