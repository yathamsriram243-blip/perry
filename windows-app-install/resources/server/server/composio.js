// A project API key (ak_…) creates/reuses one Composio Session. That
// Session owns connection state, auth links and the MCP endpoint.
import { saveConfig } from "./config.js";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { SPAWNED_PROXIES } from "./proxy-paths.js";
import { managedConnectorUnavailableReason } from "../shared/connector-availability.js";
import { CONNECTOR_TOOL_NAME_PATTERN } from "../shared/wire.js";
import { CONNECTOR_ALLOWED_TOOLS_ENV, CONNECTOR_ALLOWED_TOOLS_MAX_BYTES, CONNECTOR_SERVICE_SLUGS_ENV, CONNECTOR_SERVICE_SLUGS_MAX_BYTES, serializeConnectorAllowedTools, serializeConnectorServiceSlugs, } from "./connector-advertisement.js";
import { serviceSlugFor, serviceSlugForCandidates } from "./connector-verdict.js";
const DEFAULT_BACKEND_ORIGIN = "https://backend.composio.dev";
function apiBase() {
    return (process.env.OMB_COMPOSIO_API ?? `${DEFAULT_BACKEND_ORIGIN}/api/v3.1`).replace(/\/$/, "");
}
function toolkitBase() {
    return (process.env.OMB_COMPOSIO_TOOLKITS_API ?? `${DEFAULT_BACKEND_ORIGIN}/api/v3`).replace(/\/$/, "");
}
const sessionResponseSchema = z.object({
    session_id: z.string().min(1),
    mcp: z.object({ type: z.enum(["http", "sse"]), url: z.string().min(1) }),
    config: z.object({
        user_id: z.string().optional(),
        multi_account: z.object({
            enable: z.boolean().optional(),
            max_accounts_per_toolkit: z.number().optional(),
            require_explicit_selection: z.boolean().optional(),
        }).optional(),
        /** toolkit slug → the project's own auth config the Session uses for it */
        auth_configs: z.record(z.string(), z.string()).optional(),
    }).optional(),
});
// A project's own auth configs (bring-your-own OAuth app, API-key toolkits
// such as twitter that Composio does not manage). A Session only uses one
// when it was created with the config's id under `auth_configs`.
const authConfigItemSchema = z.object({
    id: z.string().optional(),
    status: z.string().nullable().optional(),
    is_composio_managed: z.boolean().optional(),
    is_enabled_for_tool_router: z.boolean().nullable().optional(),
    last_updated_at: z.string().nullable().optional(),
    toolkit: z.object({ slug: z.string().optional() }).optional(),
});
const authConfigsPageSchema = z.object({
    items: z.array(authConfigItemSchema).optional(),
    next_cursor: z.string().nullable().optional(),
});
const MAX_AUTH_CONFIG_PAGES = 20;
const connectedAccountResponseSchema = z.object({
    id: z.string().optional(),
    alias: z.string().nullable().optional(),
    status: z.string().optional(),
    updated_at: z.string().optional(),
    toolkit: z.object({ slug: z.string().optional() }).optional(),
});
const connectedAccountsPageSchema = z.object({
    items: z.array(connectedAccountResponseSchema),
    next_cursor: z.string().nullable().optional(),
});
const toolkitItemSchema = z.object({
    slug: z.string().optional(),
    is_no_auth: z.boolean().optional(),
    connected_account: z.object({ id: z.string().optional(), status: z.string().optional() }).nullable().optional(),
});
const toolkitPageSchema = z.object({
    items: z.array(toolkitItemSchema).optional(),
    next_cursor: z.string().nullable().optional(),
});
const connectorServiceSchema = z.object({
    connected: z.boolean(),
    pending: z.boolean().optional(),
    status: z.string().optional(),
    accounts: z.array(z.object({ id: z.string(), alias: z.string().optional(), status: z.string() })).optional(),
});
const connectorServicesResponseSchema = z.object({ services: z.record(z.string(), connectorServiceSchema).optional() });
const removalResponseSchema = z.object({ removed: z.number() });
const authUrlResponseSchema = z.object({ url: z.string().optional() });
const linkResponseSchema = z.object({ redirect_url: z.string().optional() });
const MULTI_ACCOUNT_CONFIG = {
    enable: true,
    max_accounts_per_toolkit: 5,
    require_explicit_selection: true,
};
const MAX_CONNECTED_ACCOUNT_PAGES = 100;
const ACCOUNT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const printableAliasSchema = z.string().min(1).max(64).refine((value) => {
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined || codePoint < 32 || codePoint === 127)
            return false;
    }
    return true;
});
let managedBrokerAccess;
const managedBrokerMessageSchema = z.record(z.string(), z.unknown());
const managedBrokerToken = /^[0-9a-f]{64}$/;
function normalizeManagedBrokerUrl(value) {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) {
        throw new Error("The connected-apps service URL must not include credentials, a query, or a fragment");
    }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
        throw new Error("The connected-apps service must use HTTPS");
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
export function applyManagedBrokerMessage(message) {
    const parsed = managedBrokerMessageSchema.safeParse(message);
    if (!parsed.success ||
        parsed.data.type !== "openmausbot:managed-composio" ||
        !Object.hasOwn(parsed.data, "access")) {
        return false;
    }
    setManagedBrokerAccess(parsed.data.access);
    return true;
}
export function setManagedBrokerAccess(access) {
    if (access === null) {
        managedBrokerAccess = null;
        return;
    }
    const parsed = z.object({ url: z.string().url(), token: z.string().regex(managedBrokerToken) }).strict().parse(access);
    managedBrokerAccess = { url: normalizeManagedBrokerUrl(parsed.url), token: parsed.token };
}
function brokerAccess() {
    if (managedBrokerAccess !== undefined)
        return managedBrokerAccess;
    const url = process.env.OMB_COMPOSIO_BROKER_URL?.trim();
    const token = process.env.OMB_COMPOSIO_BROKER_TOKEN?.trim();
    if (!url || !token)
        return null;
    if (!managedBrokerToken.test(token))
        throw new Error("The connected-apps service token is invalid");
    return { url: normalizeManagedBrokerUrl(url), token };
}
/** A user-owned project is an explicit choice and must win over the packaged
 * app's managed broker. An empty key means that choice was cleared, so the
 * managed service may take over again without a restart. */
function projectApiKey(cfg) {
    const apiKey = cfg.composio?.apiKey?.trim();
    return apiKey || null;
}
/** Composio's toolkit slug is `twitter`. Keep accepting the old `x` alias at
 * every local boundary so saved connector cards and model calls keep working. */
function canonicalToolkitSlug(slug) {
    const normalized = slug.trim().toLowerCase();
    return normalized === "x" ? "twitter" : normalized;
}
/** Keep credential-backed caches and transport sessions separated without
 * retaining another plaintext copy of the credential as their identity. */
function backendFingerprint(kind, endpoint, credential) {
    return createHash("sha256")
        .update(kind)
        .update("\0")
        .update(endpoint)
        .update("\0")
        .update(credential)
        .digest("hex");
}
const MAX_TRACKED_TRANSPORT_SESSIONS = 512;
const transportSessionBackends = new Map();
function rememberTransportSession(sessionId, identity) {
    transportSessionBackends.delete(sessionId);
    transportSessionBackends.set(sessionId, identity);
    while (transportSessionBackends.size > MAX_TRACKED_TRANSPORT_SESSIONS) {
        const oldest = transportSessionBackends.keys().next().value;
        if (oldest === undefined)
            break;
        transportSessionBackends.delete(oldest);
    }
}
function canonicalServiceRecord(services) {
    return Object.fromEntries(Object.entries(services).map(([slug, state]) => [canonicalToolkitSlug(slug), state]));
}
/** Preserve the caller's key (`x` included) while speaking canonical toolkit
 * slugs upstream. Old connector cards index status with their saved slug. */
function requestedServiceRecord(services, requested) {
    const canonical = canonicalServiceRecord(services);
    return Object.fromEntries(requested.flatMap((slug) => {
        const state = canonical[canonicalToolkitSlug(slug)];
        return state === undefined ? [] : [[slug, state]];
    }));
}
export function connectionMode(cfg) {
    if (projectApiKey(cfg))
        return "self-hosted";
    if (brokerAccess())
        return "managed";
    return "unavailable";
}
export function configured(cfg) {
    return connectionMode(cfg) !== "unavailable";
}
export function connectorAvailability(cfg, storeState = process.env.OMB_CREDENTIAL_STORE) {
    if (configured(cfg))
        return "configured";
    return storeState === "unavailable" ? "unreadable" : "unconfigured";
}
export function connectorSetup(cfg, desktopManaged = process.env.OMB_DESKTOP_PARENT === "1") {
    if (configured(cfg))
        return "ready";
    return desktopManaged ? "service-unavailable" : "needs-setup";
}
async function brokerRequest(path, init) {
    const broker = brokerAccess();
    if (!broker)
        throw new Error("The connected-apps service is unavailable");
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${broker.token}`);
    if (init?.body)
        headers.set("content-type", "application/json");
    return fetch(`${broker.url}${path}`, {
        ...init,
        headers,
        signal: init?.signal ?? AbortSignal.timeout(30_000),
    });
}
function projectHeaders(apiKey, json = false) {
    const headers = new Headers({ "x-api-key": apiKey });
    if (json)
        headers.set("content-type", "application/json");
    return headers;
}
async function responseError(res, fallback) {
    const raw = await res.text().catch(() => "");
    try {
        const body = JSON.parse(raw);
        return String(body?.message ?? body?.error?.message ?? body?.error ?? fallback);
    }
    catch {
        return raw.trim().slice(0, 300) || fallback;
    }
}
async function throwBrokerError(res, fallback) {
    const status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw Object.assign(new Error(await responseError(res, fallback)), { status });
}
function trustedAuthUrl(value, slug) {
    if (!value)
        throw new Error(`Connected-apps service returned no authorization link for ${slug}`);
    const url = new URL(value);
    if (url.protocol !== "https:" || (url.hostname !== "composio.dev" && !url.hostname.endsWith(".composio.dev"))) {
        throw new Error("Connected-apps service returned an untrusted authorization link");
    }
    return url.toString();
}
/** Composio's own hosts are always trusted. A backend the operator pointed
 * the app at explicitly (OMB_COMPOSIO_API — a dev or test stub) may hand back
 * a Session on its own origin, since the API itself was already trusted that
 * far; any other host is refused. */
export function trustedSessionMcpUrl(value) {
    let mcp;
    try {
        mcp = new URL(value);
    }
    catch {
        return false;
    }
    if (mcp.protocol === "https:" && (mcp.hostname === "composio.dev" || mcp.hostname.endsWith(".composio.dev")))
        return true;
    if (mcp.protocol !== "https:" && !(mcp.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(mcp.hostname)))
        return false;
    const override = process.env.OMB_COMPOSIO_API;
    if (!override)
        return false;
    try {
        return new URL(override).origin === mcp.origin;
    }
    catch {
        return false;
    }
}
function parseSessionResponse(session) {
    const mcp = new URL(session.mcp.url);
    if (!trustedSessionMcpUrl(session.mcp.url)) {
        throw new Error("Composio returned an untrusted Session MCP URL");
    }
    return { ...session, mcp: { ...session.mcp, url: mcp.toString() } };
}
function supportsMultiAccount(session) {
    // Only `enable` gates reuse. The cap and selection flags are what we ASK
    // for at creation; if Composio clamps or omits them in the echo, recreating
    // the Session would post the same config and get the same echo back — a
    // strict equality check here can only manufacture a recreate-per-request
    // loop, never fix anything.
    return session.config?.multi_account?.enable === true;
}
/** Session ids this boot already tried to upgrade once. If the fresh Session
 *  STILL doesn't echo multi-account, Composio isn't granting it — run with
 *  what we have (single-account behavior) instead of recreating a Session and
 *  rewriting config.json on every request. */
const multiAccountUpgradeAttempted = new Set();
/** Session id + auth-config map pairs this boot already created a Session
 *  for. Same idea: if Composio does not echo `auth_configs`, recreating the
 *  Session on every check would loop without changing anything. */
const authConfigUpgradeAttempted = new Set();
function inputError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}
export function normalizeAccountAlias(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const parsed = z.string().safeParse(value);
    if (!parsed.success)
        throw inputError("Account alias must be text");
    const alias = parsed.data.trim();
    if (!printableAliasSchema.safeParse(alias).success) {
        throw inputError("Account alias must be 1-64 printable characters");
    }
    return alias;
}
function validAccountId(value) {
    return Boolean(value && ACCOUNT_ID.test(value));
}
async function getProjectSession(apiKey, sessionId) {
    const res = await fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(sessionId)}`, {
        headers: projectHeaders(apiKey),
        signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404)
        return null;
    if (!res.ok)
        throw new Error(await responseError(res, `Composio session: HTTP ${res.status}`));
    return parseSessionResponse(sessionResponseSchema.parse(await res.json()));
}
/** The project's own (non-Composio-managed) auth configs, one per toolkit.
 *  Disabled configs and ones switched off for Sessions are skipped; when a
 *  toolkit has several, the most recently updated wins. Ordinary Session
 *  preparation treats a denied list as "none"; an explicit auth retry surfaces
 *  the denial so it cannot replace a usable Session with an incomplete one. */
export async function listCustomAuthConfigs(apiKey) {
    const chosen = new Map();
    let cursor;
    for (let page = 0; page < MAX_AUTH_CONFIG_PAGES; page++) {
        const params = new URLSearchParams({ is_composio_managed: "false", limit: "100" });
        if (cursor)
            params.set("cursor", cursor);
        const res = await fetch(`${apiBase()}/auth_configs?${params}`, {
            headers: projectHeaders(apiKey),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok)
            throw new Error(await responseError(res, `Composio auth configs: HTTP ${res.status}`));
        const body = authConfigsPageSchema.parse(await res.json());
        for (const item of body.items ?? []) {
            const slug = item.toolkit?.slug ? canonicalToolkitSlug(item.toolkit.slug) : "";
            if (!slug || !item.id || item.is_composio_managed === true)
                continue;
            if (item.is_enabled_for_tool_router === false)
                continue;
            if (item.status && /^(disabled|inactive|expired|deleted)$/i.test(item.status))
                continue;
            const updated = item.last_updated_at ?? "";
            const current = chosen.get(slug);
            if (!current || updated > current.updated)
                chosen.set(slug, { id: item.id, updated });
        }
        const next = body.next_cursor ?? undefined;
        if (!next || next === cursor)
            break;
        cursor = next;
    }
    return Object.fromEntries([...chosen].sort(([a], [b]) => a.localeCompare(b)).map(([slug, { id }]) => [slug, id]));
}
/** True when the Session already routes every wanted toolkit through the
 *  project's own auth config. Extra configs on the Session are fine; a
 *  missing or different one means the Session predates the config. */
function sessionCoversAuthConfigs(session, wanted) {
    const have = session.config?.auth_configs ?? {};
    const haveLower = Object.fromEntries(Object.entries(have).map(([slug, id]) => [canonicalToolkitSlug(slug), id]));
    return Object.entries(wanted).every(([slug, id]) => haveLower[slug] === id);
}
function authConfigsKey(sessionId, wanted) {
    return `${sessionId}:${JSON.stringify(wanted)}`;
}
/** Validate a project key and return one reusable Session for this install. */
export async function prepareProjectSession(apiKey, current, knownAuthConfigs) {
    const trimmed = apiKey.trim();
    if (!trimmed)
        throw new Error("Enter a Composio project API key");
    if (!trimmed.startsWith("ak_"))
        throw new Error("Composio project API keys start with ak_");
    // The project's own auth configs must be named at creation — a Session
    // cannot be edited later — so they are read before deciding whether the
    // current Session is still the right one (issue #509: a twitter auth
    // config created after the Session existed was never used).
    const authConfigs = knownAuthConfigs
        ?? await listCustomAuthConfigs(trimmed).catch(() => ({}));
    let priorUserId = current?.userId;
    if (trimmed === current?.apiKey && current.sessionId) {
        const existing = await getProjectSession(trimmed, current.sessionId);
        if (existing
            && supportsMultiAccount(existing)
            && (sessionCoversAuthConfigs(existing, authConfigs)
                || authConfigUpgradeAttempted.has(authConfigsKey(existing.session_id, authConfigs)))) {
            return {
                apiKey: trimmed,
                userId: existing.config?.user_id ?? current.userId ?? `openmausbot_${randomUUID()}`,
                sessionId: existing.session_id,
            };
        }
        // Connections belong to the Composio user, not the Session. Recreate old
        // single-account Sessions with the same user ID so every existing grant is
        // retained while the new Session opts into explicit multi-account routing.
        priorUserId = existing?.config?.user_id ?? priorUserId;
    }
    const userId = priorUserId ?? `openmausbot_${randomUUID()}`;
    const sessionRequest = {
        user_id: userId,
        manage_connections: {
            enable: true,
            enable_wait_for_connections: true,
            enable_connection_removal: true,
        },
        multi_account: MULTI_ACCOUNT_CONFIG,
    };
    if (Object.keys(authConfigs).length)
        sessionRequest.auth_configs = authConfigs;
    const res = await fetch(`${apiBase()}/tool_router/session`, {
        method: "POST",
        headers: projectHeaders(trimmed, true),
        body: JSON.stringify(sessionRequest),
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
        throw new Error(await responseError(res, `Composio rejected this key (HTTP ${res.status})`));
    const session = parseSessionResponse(sessionResponseSchema.parse(await res.json()));
    // If Composio does not echo the configs back, a later check would ask for
    // the same creation again — remember this attempt so it happens once.
    authConfigUpgradeAttempted.add(authConfigsKey(session.session_id, authConfigs));
    return { apiKey: trimmed, userId, sessionId: session.session_id };
}
async function ensureProjectSession(cfg) {
    const composio = cfg.composio;
    const apiKey = projectApiKey(cfg);
    if (!composio || !apiKey)
        throw new Error("No Composio project key configured");
    if (composio.sessionId) {
        const existing = await getProjectSession(apiKey, composio.sessionId);
        if (existing && (supportsMultiAccount(existing) || multiAccountUpgradeAttempted.has(existing.session_id))) {
            return existing;
        }
    }
    // A missing/deleted session is recreated and its non-secret identifiers are
    // persisted so an edited config/env setup does not recreate it every launch.
    const prepared = await prepareProjectSession(apiKey, composio);
    multiAccountUpgradeAttempted.add(prepared.sessionId);
    composio.userId = prepared.userId;
    composio.sessionId = prepared.sessionId;
    saveConfig({ composio: { userId: prepared.userId, sessionId: prepared.sessionId } });
    const created = await getProjectSession(apiKey, prepared.sessionId);
    if (!created)
        throw new Error("Composio Session disappeared after creation");
    return created;
}
/** Replace the current Session with a freshly created one — the only way to
 *  pick up an auth config the user added after the Session was made. The
 *  Composio user id is kept, so every existing connection survives. */
async function recreateProjectSession(cfg, userId, authConfigs) {
    const composio = cfg.composio;
    const apiKey = projectApiKey(cfg);
    if (!composio || !apiKey)
        throw new Error("No Composio project key configured");
    const prepared = await prepareProjectSession(apiKey, { apiKey, userId }, authConfigs);
    multiAccountUpgradeAttempted.add(prepared.sessionId);
    composio.userId = prepared.userId;
    composio.sessionId = prepared.sessionId;
    saveConfig({ composio: { userId: prepared.userId, sessionId: prepared.sessionId } });
    const created = await getProjectSession(apiKey, prepared.sessionId);
    if (!created)
        throw new Error("Composio Session disappeared after creation");
    return created;
}
/** Composio's wording when a toolkit has no managed auth and the Session was
 *  not told which of the project's own auth configs to use. */
const NEEDS_AUTH_CONFIG = /does not manage auth|auth[_ ]?config/i;
export async function mcpIntegration(cfg, context) {
    if (!configured(cfg))
        return null;
    // Connector grants 3/5: a grants record rides to the bridge as a capped
    // JSON env var so tools/list is filtered down to what the bot may call.
    // No record (legacy all-tools bots) or one past the cap mounts without
    // the var — the bridge then relays the unfiltered list and every call is
    // still judged by the slice-2 verdict on the relay endpoint.
    const allowlist = context.connectorTools === undefined
        ? undefined
        : serializeConnectorAllowedTools(context.connectorTools);
    if (allowlist?.oversized) {
        console.warn(`[composio] connector allowlist for bot ${context.botId} exceeds ${CONNECTOR_ALLOWED_TOOLS_MAX_BYTES} bytes;`
            + " tools/list stays unfiltered and grants are enforced per call");
    }
    // The connected-service slugs ride alongside the allowlist so the
    // bridge resolves underscored services (bland_ai) instead of letting a
    // plain-prefix grant (bland) widen them. An unreachable catalog omits
    // the var and the filter keeps its plain-split fallback; legacy
    // all-tools bots mount without it because their list is unfiltered.
    const serviceSlugs = context.connectorTools === undefined
        ? undefined
        : serializeConnectorServiceSlugs(await connectedServiceSlugs(cfg));
    if (serviceSlugs?.oversized) {
        console.warn(`[composio] connector service slugs for bot ${context.botId} exceed ${CONNECTOR_SERVICE_SLUGS_MAX_BYTES} bytes;`
            + " tools/list falls back to plain-prefix resolution");
    }
    return {
        command: process.execPath,
        args: [SPAWNED_PROXIES.connectors],
        env: {
            ELECTRON_RUN_AS_NODE: "1",
            // The provider-facing bridge receives only this boot's loopback token.
            // Project/broker credentials stay in the harness process, so a coding
            // agent that prints its environment cannot export a durable secret.
            OMB_CONNECTOR_UPSTREAM_URL: `${context.harnessUrl}/api/internal/connectors/mcp`,
            OMB_CONNECTOR_UPSTREAM_HEADERS: JSON.stringify({ authorization: `Bearer ${context.commsToken}` }),
            OMB_HARNESS_URL: context.harnessUrl,
            // Distinct from the agents proxy token: Codex flattens mounted MCP env
            // variables into one process environment, so a shared name would let
            // the later agents mount overwrite this connector-scoped capability.
            OMB_CONNECTOR_TOKEN: context.commsToken,
            OMB_BOT_ID: context.botId,
            OMB_THREAD_ID: context.threadId,
            ...(allowlist?.env ? { [CONNECTOR_ALLOWED_TOOLS_ENV]: allowlist.env } : {}),
            ...(serviceSlugs?.env ? { [CONNECTOR_SERVICE_SLUGS_ENV]: serviceSlugs.env } : {}),
        },
    };
}
export async function relayMcp(cfg, payload, transportSessionId, beforeSend) {
    const apiKey = projectApiKey(cfg);
    let url;
    let identity;
    const headers = new Headers({
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
    });
    if (apiKey) {
        const session = await ensureProjectSession(cfg);
        url = session.mcp.url;
        headers.set("x-api-key", apiKey);
        identity = backendFingerprint("project-mcp", url, apiKey);
    }
    else {
        const broker = brokerAccess();
        if (!broker)
            throw new Error("Connected apps are unavailable");
        url = `${broker.url}/v1/mcp`;
        headers.set("authorization", `Bearer ${broker.token}`);
        identity = backendFingerprint("managed-mcp", url, broker.token);
    }
    const knownIdentity = transportSessionId
        ? transportSessionBackends.get(transportSessionId)
        : undefined;
    const forwardedTransportSessionId = transportSessionId
        && knownIdentity === identity
        ? transportSessionId
        : undefined;
    if (forwardedTransportSessionId) {
        headers.set("mcp-session-id", forwardedTransportSessionId);
    }
    // Session discovery can await network I/O. Turn authority and mutable
    // permissions must be checked after it, immediately before dispatch.
    beforeSend?.();
    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10 * 60_000),
    });
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 20 * 1024 * 1024)
        throw new Error("Connected-app response exceeded 20 MB");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 20 * 1024 * 1024)
        throw new Error("Connected-app response exceeded 20 MB");
    if (forwardedTransportSessionId)
        rememberTransportSession(forwardedTransportSessionId, identity);
    const nextTransportSessionId = response.headers.get("mcp-session-id") ?? undefined;
    if (nextTransportSessionId)
        rememberTransportSession(nextTransportSessionId, identity);
    return {
        status: response.status,
        bytes,
        contentType: response.headers.get("content-type") ?? "application/json",
        transportSessionId: nextTransportSessionId,
    };
}
async function listConnectedAccounts(apiKey, userId, slugs) {
    const accounts = [];
    const seenCursors = new Set();
    let cursor;
    // Five accounts per toolkit can exceed one provider page when a user has
    // many apps. Follow Composio's cursor instead of silently dropping entries.
    for (let page = 0; page < MAX_CONNECTED_ACCOUNT_PAGES; page += 1) {
        const params = new URLSearchParams({
            limit: "50",
            user_ids: userId,
            order_by: "updated_at",
            order_direction: "desc",
        });
        if (slugs.length)
            params.set("toolkit_slugs", slugs.join(","));
        if (cursor)
            params.set("cursor", cursor);
        const response = await fetch(`${apiBase()}/connected_accounts?${params}`, {
            headers: projectHeaders(apiKey),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok)
            throw new Error(await responseError(response, `Composio accounts: HTTP ${response.status}`));
        const body = connectedAccountsPageSchema.parse(await response.json());
        accounts.push(...body.items);
        const next = body.next_cursor || undefined;
        if (!next || seenCursors.has(next))
            return accounts;
        seenCursors.add(next);
        cursor = next;
    }
    throw new Error("Composio account inventory exceeded the pagination safety limit");
}
async function listSessionToolkits(apiKey, sessionId) {
    const toolkits = [];
    const seenCursors = new Set();
    let cursor;
    for (let page = 0; page < MAX_CONNECTED_ACCOUNT_PAGES; page += 1) {
        // The unfiltered endpoint contains the entire Composio marketplace and is
        // cursor-paginated in 50-item pages. The Connected tab only needs the
        // user's connected toolkits, so avoid scanning hundreds of unrelated apps.
        const params = new URLSearchParams({ limit: "50", is_connected: "true" });
        if (cursor)
            params.set("cursor", cursor);
        const response = await fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(sessionId)}/toolkits?${params}`, { headers: projectHeaders(apiKey), signal: AbortSignal.timeout(15_000) });
        if (!response.ok)
            throw new Error(await responseError(response, `Composio toolkits: HTTP ${response.status}`));
        const body = toolkitPageSchema.parse(await response.json());
        toolkits.push(...(body.items ?? []));
        const next = body.next_cursor || undefined;
        if (!next || seenCursors.has(next))
            return toolkits;
        seenCursors.add(next);
        cursor = next;
    }
    throw new Error("Composio toolkit inventory exceeded the pagination safety limit");
}
function summarizeAccounts(accounts, slugs) {
    const requested = new Set(slugs.map(canonicalToolkitSlug));
    const bySlug = new Map();
    for (const account of accounts) {
        const slug = account.toolkit?.slug ? canonicalToolkitSlug(account.toolkit.slug) : "";
        if (!slug || (requested.size && !requested.has(slug)) || !validAccountId(account.id))
            continue;
        const alias = account.alias?.trim() ?? "";
        const summary = {
            id: account.id,
            status: account.status || "UNKNOWN",
            updatedAt: account.updated_at ?? "",
        };
        if (printableAliasSchema.safeParse(alias).success)
            summary.alias = alias;
        const list = bySlug.get(slug) ?? [];
        list.push(summary);
        bySlug.set(slug, list);
    }
    for (const list of bySlug.values())
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return bySlug;
}
function publicAccount({ id, alias, status }) {
    const account = { id, status };
    if (alias)
        account.alias = alias;
    return account;
}
function serviceStateFromAccounts(accounts) {
    const active = accounts.find((account) => /^active$/i.test(account.status));
    const pending = accounts.find((account) => /^(initiated|initializing|pending)$/i.test(account.status));
    const selected = active ?? pending ?? accounts[0];
    return {
        connected: Boolean(active),
        pending: Boolean(pending),
        status: selected?.status ?? "not_connected",
        accounts: accounts.map(publicAccount),
    };
}
function allServiceStates(accountsBySlug, toolkits) {
    const services = new Map([...accountsBySlug].map(([slug, accounts]) => [slug, serviceStateFromAccounts(accounts)]));
    for (const toolkit of toolkits) {
        const slug = toolkit.slug ? canonicalToolkitSlug(toolkit.slug) : "";
        const selected = toolkit.connected_account;
        const selectedId = validAccountId(selected?.id) ? selected.id : undefined;
        if (!slug || (!toolkit.is_no_auth && !selectedId))
            continue;
        const existingAccounts = accountsBySlug.get(slug) ?? [];
        const accounts = [...existingAccounts];
        if (selectedId && !accounts.some((account) => account.id === selectedId)) {
            accounts.push({ id: selectedId, status: selected?.status ?? "ACTIVE" });
        }
        const accountState = serviceStateFromAccounts(accounts);
        const status = toolkit.is_no_auth ? "ACTIVE" : selected?.status ?? accountState.status;
        services.set(slug, {
            connected: toolkit.is_no_auth === true || accountState.connected || /^active$/i.test(status),
            pending: accountState.pending || /^(initiated|initializing|pending)$/i.test(status),
            status,
            accounts: accountState.accounts,
        });
    }
    return Object.fromEntries(services);
}
/**
 * Enumerate the user's complete connected-account inventory without depending
 * on marketplace ordering or catalog pagination.
 */
export async function connectedServices(cfg) {
    const apiKey = projectApiKey(cfg);
    if (!apiKey) {
        const response = await brokerRequest("/v1/connectors/connected");
        if (!response.ok)
            await throwBrokerError(response, `Connected apps: HTTP ${response.status}`);
        const body = connectorServicesResponseSchema.parse(await response.json());
        const services = canonicalServiceRecord(body.services ?? {});
        return Object.fromEntries(Object.entries(services).map(([slug, state]) => [slug, {
                connected: state.connected,
                pending: state.pending ?? false,
                status: state.status ?? (state.connected ? "ACTIVE" : "not_connected"),
                accounts: state.accounts ?? [],
            }]));
    }
    const session = await ensureProjectSession(cfg);
    const userId = session.config?.user_id ?? cfg.composio?.userId;
    if (!userId)
        throw new Error("Composio Session returned no user ID");
    const [toolkits, accounts] = await Promise.all([
        listSessionToolkits(apiKey, session.session_id),
        // Scoped project keys can grant Session reads without granting the raw
        // connected-account list. The Session still proves which selected/no-auth
        // toolkits belong to this installation, so retain that safe fallback.
        listConnectedAccounts(apiKey, userId, []).catch(() => []),
    ]);
    return allServiceStates(summarizeAccounts(accounts, []), toolkits);
}
/** Semantic validation for a connectorTools patch (issue #1737): slugs
 * must name a connected service, and every listed tool name must carry its
 * own service prefix (GMAIL_SEND_EMAIL under "gmail") — a mismatched name
 * would be granted yet permanently refused at call time. The prefix check
 * resolves against the connected-service slugs, so an underscored service
 * (bland_ai) keeps its BLAND_AI_* names and a plain-prefix grant cannot
 * capture them; it always runs, degrading to the plain split when the
 * connection inventory is unreachable. Only the connection-dependent and
 * catalog checks fail open — an unreachable connection inventory, the
 * curated fallback, or a catalog walk that did not reach its end never
 * block the patch, because call-time enforcement (slice 2) stays the
 * authority either way. Returns the rejection message or null. */
export async function validateConnectorGrants(cfg, grants) {
    const connected = await connectedServices(cfg).catch(() => null);
    const candidates = connected ? Object.keys(connected) : [];
    for (const [slug, grant] of Object.entries(grants)) {
        if (grant.tools === "*")
            continue;
        // The prefix check runs against the connected-service slugs, so an
        // underscored service (bland_ai) accepts its own BLAND_AI_* names —
        // and a plain-prefix grant cannot capture them while the real service
        // is connected.
        const misplaced = grant.tools.filter((tool) => (serviceSlugForCandidates(tool, candidates) ?? serviceSlugFor(tool)) !== slug);
        if (misplaced.length) {
            return `connectorTools.${slug}.tools names tools that belong to another service: ${misplaced.join(", ")}`;
        }
    }
    if (!connected)
        return null;
    const unconnected = Object.keys(grants).filter((slug) => !connected[slug]?.connected);
    if (unconnected.length) {
        return `connectorTools names services that are not connected: ${unconnected.join(", ")}`;
    }
    const catalog = await listToolkits(cfg);
    // source "curated" means the marketplace was unreachable, and a walk that
    // never reached its natural end served only part of it — either way there
    // is nothing trustworthy to cross-check against, and a grant for a service
    // on a page the walk never saw must not be rejected.
    if (catalog.source !== "api" || !catalog.pagination?.complete)
        return null;
    const known = new Set(catalog.cards.map((card) => card.slug.toLowerCase()));
    const unknown = Object.keys(grants).filter((slug) => !known.has(slug));
    if (unknown.length) {
        return `connectorTools names services missing from the connected-apps catalog: ${unknown.join(", ")}`;
    }
    return null;
}
/** The grant editor's tool inventory, grouped by service slug. Sourced from
 * the same MCP endpoint the bots' bridge relays to (initialize + tools/list
 * through relayMcp), so what the picker offers is exactly what a granted bot
 * would see — in self-hosted and managed modes alike. Platform meta-tools
 * and per-service connection flows are not per-tool grants (they ride along
 * whenever a service is granted), so they never appear in the picker. */
export async function listConnectorTools(cfg, options = {}) {
    const identity = connectorToolsIdentity(cfg);
    if (!options.force && connectorToolsCache?.identity === identity
        && Date.now() - connectorToolsCache.at < CONNECTOR_TOOLS_CACHE_MS) {
        return connectorToolsCache.services;
    }
    // Concurrent misses share one MCP walk — two editors opening together
    // must not run the initialize + tools/list sequences twice. force
    // bypasses the settled cache but still joins a walk already running.
    if (connectorToolsRequest?.identity === identity)
        return connectorToolsRequest.services;
    const walk = collectConnectorTools(cfg).then((services) => {
        connectorToolsCache = { at: Date.now(), identity, services };
        return services;
    });
    connectorToolsRequest = { identity, services: walk };
    try {
        return await walk;
    }
    finally {
        if (connectorToolsRequest?.services === walk)
            connectorToolsRequest = null;
    }
}
const CONNECTOR_TOOLS_CACHE_MS = 60_000;
let connectorToolsCache = null;
/** Which backend an inventory walk belongs to, mirroring the relay's own
 * credential fingerprint: a project key or the managed broker. Cached
 * inventories are keyed by it, so a config switch can never serve the
 * previous backend's tools for another cache window. */
function connectorToolsIdentity(cfg) {
    const apiKey = projectApiKey(cfg);
    if (apiKey)
        return backendFingerprint("project-tools", apiBase(), apiKey);
    const broker = brokerAccess();
    return broker ? backendFingerprint("managed-tools", broker.url, broker.token) : "none";
}
let connectorToolsRequest = null;
/** The service slugs grant enforcement resolves tool-name prefixes
 * against: every key of the connection inventory, connected or not,
 * because the real backend slugs are what separates an underscored
 * service (bland_ai) from a plain-prefix grant (bland). Cached like the
 * tool inventory — 60s, keyed by backend identity, one shared in-flight
 * walk — and an unreachable inventory reads as an empty list without
 * caching the failure, so callers fall back to the plain split and the
 * next call retries. */
export async function connectedServiceSlugs(cfg) {
    const identity = connectorToolsIdentity(cfg);
    if (connectorServiceSlugsCache?.identity === identity
        && Date.now() - connectorServiceSlugsCache.at < CONNECTOR_SERVICE_SLUGS_CACHE_MS) {
        return connectorServiceSlugsCache.slugs;
    }
    if (connectorServiceSlugsRequest?.identity === identity)
        return connectorServiceSlugsRequest.slugs;
    const walk = connectedServices(cfg).then((services) => {
        const slugs = Object.keys(services);
        connectorServiceSlugsCache = { at: Date.now(), identity, slugs };
        return slugs;
    }, () => []);
    connectorServiceSlugsRequest = { identity, slugs: walk };
    try {
        return await walk;
    }
    finally {
        if (connectorServiceSlugsRequest?.slugs === walk)
            connectorServiceSlugsRequest = null;
    }
}
const CONNECTOR_SERVICE_SLUGS_CACHE_MS = 60_000;
let connectorServiceSlugsCache = null;
let connectorServiceSlugsRequest = null;
/** Tool names longer than any Composio description worth searching. */
const TOOL_DESCRIPTION_MAX = 240;
const TOOLS_LIST_PAGES_MAX = 10;
function connectorToolListing(tool) {
    if (!tool || typeof tool !== "object" || Array.isArray(tool))
        return null;
    const name = tool.name;
    if (typeof name !== "string" || !CONNECTOR_TOOL_NAME_PATTERN.test(name))
        return null;
    if (name.startsWith("COMPOSIO_"))
        return null;
    if (name.endsWith("_MANAGE_CONNECTIONS") || name.endsWith("_WAIT_FOR_CONNECTIONS"))
        return null;
    const description = tool.description;
    const trimmed = typeof description === "string"
        ? description.replace(/\s+/g, " ").trim().slice(0, TOOL_DESCRIPTION_MAX)
        : "";
    return trimmed ? { name, description: trimmed } : { name };
}
/** One JSON-RPC response frame from a JSON or SSE body, mirroring the
 * bridge's parseUpstream: SSE data lines are tried in order and the frame
 * carrying the request id wins. */
function parseMcpResponse(text, id) {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    const candidate = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
    if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        return candidate(parsed) ? parsed : null;
    }
    const frames = trimmed
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter((line) => line && line !== "[DONE]")
        .flatMap((line) => {
        try {
            return [JSON.parse(line)];
        }
        catch {
            return [];
        }
    })
        .filter(candidate);
    return frames.findLast((frame) => frame.id === id) ?? frames.at(-1) ?? null;
}
async function collectConnectorTools(cfg) {
    // Connected services are the real slugs, so they resolve underscored
    // services (bland_ai) the plain split would file under "bland"; an
    // unreachable inventory degrades to that split.
    const connected = await connectedServices(cfg).catch(() => null);
    const candidates = connected ? Object.keys(connected) : [];
    const initialize = await relayMcp(cfg, {
        jsonrpc: "2.0",
        id: "omb-grants-initialize",
        method: "initialize",
        params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "openmausbot-grant-editor", version: "1" },
        },
    });
    if (initialize.status !== 200) {
        throw new Error(await responseErrorFromBytes(initialize.status, initialize.bytes));
    }
    const transportSessionId = initialize.transportSessionId;
    // Streamable-HTTP servers expect the handshake notification before the
    // first request; it carries no response, so failures are not fatal.
    await relayMcp(cfg, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
    }, transportSessionId).catch(() => undefined);
    const grouped = new Map();
    let cursor;
    for (let page = 0; page < TOOLS_LIST_PAGES_MAX; page += 1) {
        const list = await relayMcp(cfg, {
            jsonrpc: "2.0",
            id: "omb-grants-tools",
            method: "tools/list",
            params: cursor ? { cursor } : {},
        }, transportSessionId);
        if (list.status !== 200) {
            throw new Error(await responseErrorFromBytes(list.status, list.bytes));
        }
        const frame = parseMcpResponse(new TextDecoder().decode(list.bytes), "omb-grants-tools");
        const error = frame && typeof frame.error === "object" && frame.error !== null
            ? frame.error.message
            : undefined;
        if (typeof error === "string" && error)
            throw new Error(error);
        const result = frame && typeof frame.result === "object" && frame.result !== null
            ? frame.result
            : undefined;
        if (!result || !Array.isArray(result.tools)) {
            throw new Error("Composio returned a tools/list response without a tools array");
        }
        for (const tool of result.tools) {
            const listing = connectorToolListing(tool);
            if (!listing)
                continue;
            const slug = serviceSlugForCandidates(listing.name, candidates) ?? serviceSlugFor(listing.name);
            if (!slug)
                continue;
            const bucket = grouped.get(slug) ?? [];
            if (!bucket.some((existing) => existing.name === listing.name))
                bucket.push(listing);
            grouped.set(slug, bucket);
        }
        cursor = typeof result.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
        if (!cursor)
            break;
    }
    for (const bucket of grouped.values())
        bucket.sort((a, b) => a.name.localeCompare(b.name));
    return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
async function responseErrorFromBytes(status, bytes) {
    try {
        const body = JSON.parse(new TextDecoder().decode(bytes));
        const message = body && typeof body === "object" && !Array.isArray(body)
            ? body.error
            : undefined;
        if (message && typeof message === "object" && !Array.isArray(message)) {
            const text = message.message;
            if (typeof text === "string" && text)
                return text;
        }
        if (typeof message === "string" && message)
            return message;
    }
    catch {
        // fall through to the generic status line
    }
    return `Composio tools/list: HTTP ${status}`;
}
export async function connectionStatus(cfg, slugs) {
    const canonicalSlugs = [...new Set(slugs.map(canonicalToolkitSlug))];
    const apiKey = projectApiKey(cfg);
    if (!apiKey) {
        const response = await brokerRequest(`/v1/connectors?${new URLSearchParams({ services: canonicalSlugs.join(",") })}`);
        if (!response.ok)
            await throwBrokerError(response, `Connected apps: HTTP ${response.status}`);
        const body = connectorServicesResponseSchema.parse(await response.json());
        return requestedServiceRecord(body.services ?? {}, slugs);
    }
    const session = await ensureProjectSession(cfg);
    const params = new URLSearchParams({ limit: "50" });
    if (canonicalSlugs.length)
        params.set("toolkits", canonicalSlugs.join(","));
    const userId = session.config?.user_id ?? cfg.composio?.userId;
    const [res, accounts] = await Promise.all([
        fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(session.session_id)}/toolkits?${params}`, {
            headers: projectHeaders(apiKey),
            signal: AbortSignal.timeout(15_000),
        }),
        // Session toolkits only include an account once it is usable. Read the
        // account lifecycle too so the UI can distinguish an OAuth flow that is
        // still waiting in the browser from one that expired or failed. Scoped
        // keys may omit connected-account read permission, so this is additive:
        // the normal session result remains the fallback.
        userId
            ? listConnectedAccounts(apiKey, userId, canonicalSlugs).catch(() => [])
            : Promise.resolve([]),
    ]);
    if (!res.ok)
        throw new Error(await responseError(res, `Composio toolkits: HTTP ${res.status}`));
    const body = toolkitPageSchema.parse(await res.json());
    const bySlug = new Map((body.items ?? []).flatMap((item) => item.slug ? [[canonicalToolkitSlug(item.slug), item]] : []));
    const accountsBySlug = summarizeAccounts(accounts, canonicalSlugs);
    return Object.fromEntries(slugs.map((slug) => {
        const canonicalSlug = canonicalToolkitSlug(slug);
        const item = bySlug.get(canonicalSlug);
        const serviceAccounts = accountsBySlug.get(canonicalSlug) ?? [];
        // Mirror allServiceStates: a scoped key can be denied the raw account
        // list while the Session still names its selected account. Synthesize
        // that account here too, so a status poll never wipes the row the
        // inventory paths render (merge replaces a slug's state wholesale).
        const selected = item?.connected_account;
        const selectedId = validAccountId(selected?.id) ? selected.id : undefined;
        const withSelected = selectedId && !serviceAccounts.some((account) => account.id === selectedId)
            ? [...serviceAccounts, { id: selectedId, status: selected?.status ?? "ACTIVE" }]
            : serviceAccounts;
        const accountState = serviceStateFromAccounts(withSelected);
        const state = item?.connected_account?.status
            ?? (item?.is_no_auth ? "ACTIVE" : accountState.status);
        return [slug, {
                connected: item?.is_no_auth === true || accountState.connected || /^active$/i.test(state),
                pending: accountState.pending || /^(initiated|initializing|pending)$/i.test(state),
                status: state,
                accounts: accountState.accounts,
            }];
    }));
}
/** Backward-compatible service disconnect: removes the Session-selected account. */
export async function removeService(cfg, slug) {
    const toolkit = canonicalToolkitSlug(slug);
    const apiKey = projectApiKey(cfg);
    if (!apiKey) {
        const response = await brokerRequest(`/v1/connectors/${encodeURIComponent(toolkit)}`, { method: "DELETE" });
        if (!response.ok)
            await throwBrokerError(response, `Connected apps: HTTP ${response.status}`);
        return removalResponseSchema.parse(await response.json());
    }
    const session = await ensureProjectSession(cfg);
    const params = new URLSearchParams({ limit: "50", toolkits: toolkit });
    const list = await fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(session.session_id)}/toolkits?${params}`, { headers: projectHeaders(apiKey), signal: AbortSignal.timeout(15_000) });
    if (!list.ok)
        throw new Error(await responseError(list, `Composio toolkits: HTTP ${list.status}`));
    const body = toolkitPageSchema.parse(await list.json());
    const id = body.items?.find((item) => item.slug && canonicalToolkitSlug(item.slug) === toolkit)?.connected_account?.id;
    if (!id)
        return { removed: 0 };
    const removed = await fetch(`${apiBase()}/connected_accounts/${encodeURIComponent(id)}?revoke_on_delete=true`, { method: "DELETE", headers: projectHeaders(apiKey), signal: AbortSignal.timeout(30_000) });
    if (!removed.ok)
        throw new Error(await responseError(removed, `Composio disconnect: HTTP ${removed.status}`));
    return { removed: 1 };
}
/** Disconnect exactly one account after proving it belongs to this user/toolkit. */
export async function removeAccount(cfg, slug, accountId) {
    if (!validAccountId(accountId))
        throw inputError("Invalid connected-account ID");
    const toolkit = canonicalToolkitSlug(slug);
    const apiKey = projectApiKey(cfg);
    if (!apiKey) {
        const response = await brokerRequest(`/v1/connectors/${encodeURIComponent(toolkit)}/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
        if (!response.ok)
            await throwBrokerError(response, `Connected apps: HTTP ${response.status}`);
        return removalResponseSchema.parse(await response.json());
    }
    const session = await ensureProjectSession(cfg);
    const userId = session.config?.user_id ?? cfg.composio?.userId;
    if (!userId)
        throw new Error("Composio Session has no user ID");
    const accounts = await listConnectedAccounts(apiKey, userId, [toolkit]);
    const owned = accounts.some((account) => account.id === accountId
        && account.toolkit?.slug !== undefined
        && canonicalToolkitSlug(account.toolkit.slug) === toolkit);
    if (!owned)
        return { removed: 0 };
    const removed = await fetch(`${apiBase()}/connected_accounts/${encodeURIComponent(accountId)}?revoke_on_delete=true`, { method: "DELETE", headers: projectHeaders(apiKey), signal: AbortSignal.timeout(30_000) });
    if (!removed.ok)
        throw new Error(await responseError(removed, `Composio disconnect: HTTP ${removed.status}`));
    return { removed: 1 };
}
/** Mint a browser auth link for one service. Returns { url } or throws. */
export async function authorizeService(cfg, slug, requestedAlias) {
    let alias = normalizeAccountAlias(requestedAlias);
    const toolkit = canonicalToolkitSlug(slug);
    const mode = connectionMode(cfg);
    const unavailable = managedConnectorUnavailableReason(mode, toolkit);
    if (unavailable)
        throw inputError(unavailable, 409);
    const apiKey = projectApiKey(cfg);
    if (!apiKey) {
        const request = { method: "POST" };
        if (alias)
            request.body = JSON.stringify({ alias });
        const response = await brokerRequest(`/v1/connectors/${encodeURIComponent(toolkit)}/authorize`, request);
        if (!response.ok)
            await throwBrokerError(response, `Connected apps: HTTP ${response.status}`);
        const body = authUrlResponseSchema.parse(await response.json());
        return { url: trustedAuthUrl(body.url, toolkit) };
    }
    const session = await ensureProjectSession(cfg);
    const userId = session.config?.user_id ?? cfg.composio?.userId;
    if (!userId)
        throw new Error("Composio Session has no user ID");
    // A scoped key may be denied account listing — authorization must still
    // work (it always did pre-multi-account), so the alias guardrails degrade
    // to first-account behavior, the same fallback every inventory path takes.
    const accounts = await listConnectedAccounts(apiKey, userId, [toolkit]).catch(() => []);
    const serviceAccounts = accounts.filter((account) => account.toolkit?.slug !== undefined && canonicalToolkitSlug(account.toolkit.slug) === toolkit);
    const usableAccounts = serviceAccounts.filter((account) => /^(active|initiated|initializing|pending)$/i.test(account.status ?? ""));
    if (usableAccounts.length >= MULTI_ACCOUNT_CONFIG.max_accounts_per_toolkit) {
        throw inputError(`${toolkit} already has the maximum of ${MULTI_ACCOUNT_CONFIG.max_accounts_per_toolkit} accounts`, 409);
    }
    if (serviceAccounts.length > 0 && !alias) {
        if (serviceAccounts.every((account) => /^(initializing|initiated|expired)$/i.test(account.status ?? ""))) {
            // Retry without replacing a named account or revoking a former grant:
            // EXPIRED can describe either an abandoned flow or an expired credential.
            alias = `omb-retry-${randomUUID()}`;
        }
        else {
            throw inputError("Add an account alias so the existing connection is not replaced");
        }
    }
    if (alias && serviceAccounts.some((account) => account.alias?.trim().toLowerCase() === alias.toLowerCase())) {
        throw inputError(`Account alias "${alias}" is already in use for ${toolkit}`, 409);
    }
    const linkRequest = { toolkit };
    if (alias)
        linkRequest.alias = alias;
    const link = (sessionId) => fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(sessionId)}/link`, {
        method: "POST",
        headers: projectHeaders(apiKey, true),
        body: JSON.stringify(linkRequest),
        signal: AbortSignal.timeout(30_000),
    });
    let res = await link(session.session_id);
    if (!res.ok) {
        const message = await responseError(res, `Composio authorization: HTTP ${res.status}`);
        if (!NEEDS_AUTH_CONFIG.test(message))
            throw new Error(message);
        // The toolkit needs one of the project's own auth configs. The Session
        // names those only at creation, so an auth config the user created after
        // the Session existed is invisible to it: rebuild the Session once and
        // retry. If the project has no config for this toolkit, say what to do
        // instead of echoing Composio's "auth_config_override" hint.
        const authConfigs = await listCustomAuthConfigs(apiKey);
        const covered = Object.keys(authConfigs).some((key) => canonicalToolkitSlug(key) === toolkit);
        if (!covered) {
            throw inputError(`${toolkit} has no Composio-managed sign-in. In your Composio project, create an auth config for "${toolkit}" `
                + "(Auth Configs → Create) with your own app credentials, then click Connect again.");
        }
        const fresh = await recreateProjectSession(cfg, userId, authConfigs);
        res = await link(fresh.session_id);
        if (!res.ok)
            throw new Error(await responseError(res, `Composio authorization: HTTP ${res.status}`));
    }
    const body = linkResponseSchema.parse(await res.json());
    return { url: trustedAuthUrl(body.redirect_url, toolkit) };
}
import { CURATED_500 } from "./composio-catalog-500.js";
// Curated fallback — the services agentcal's connectors page ships plus the
// long marketplace tail. Logos resolve client-side:
// logo → favicon(domain) → monogram.
const CURATED = CURATED_500;
let toolkitCache = null;
/**
 * Marketplace catalog. Tries the v3 toolkits API (official names,
 * descriptions, logos — cached 10 min); falls back to the curated list.
 */
export async function listToolkits(cfg) {
    const backendKey = projectApiKey(cfg);
    const broker = backendKey ? null : brokerAccess();
    const identity = backendKey
        ? backendFingerprint("project-catalog", toolkitBase(), backendKey)
        : broker
            ? backendFingerprint("managed-catalog", broker.url, broker.token)
            : null;
    if (identity && toolkitCache?.identity === identity && Date.now() - toolkitCache.at < 10 * 60_000) {
        return { cards: toolkitCache.cards, source: "api", pagination: toolkitCache.pagination };
    }
    if (backendKey || broker) {
        try {
            // The marketplace runs to well over a thousand toolkits and the endpoint
            // is cursor-paginated, so one page stops partway through the alphabet.
            // Follow next_cursor, and keep the pages already collected if a later
            // one fails — a partial catalog still beats the curated two dozen.
            const items = [];
            const seenCursors = new Set();
            let cursor;
            let lastReportedPage;
            let reportedTotalItems;
            let reportedTotalPages;
            // Why the walk ended. "limit" means the loop ran out of iterations;
            // every early exit names itself so a stalled catalog can be logged
            // instead of silently posing as the complete marketplace.
            let stop = "limit";
            for (let page = 0; page < MAX_CONNECTED_ACCOUNT_PAGES; page += 1) {
                const params = new URLSearchParams({ limit: "500", sort_by: "usage" });
                if (cursor)
                    params.set("cursor", cursor);
                const res = backendKey
                    ? await fetch(`${toolkitBase()}/toolkits?${params}`, {
                        headers: { "x-api-key": backendKey },
                        signal: AbortSignal.timeout(15_000),
                    })
                    : await brokerRequest(cursor ? `/v1/catalog?cursor=${encodeURIComponent(cursor)}` : "/v1/catalog", {
                        signal: AbortSignal.timeout(15_000),
                    });
                if (!res.ok) {
                    stop = "http-error";
                    break;
                }
                const json = await res.json();
                const pageItems = json.items ?? json.data ?? [];
                if (!Array.isArray(pageItems)) {
                    stop = "bad-page";
                    break;
                }
                items.push(...pageItems);
                const pageTotalItems = Number(json.total_items);
                if (Number.isFinite(pageTotalItems) && pageTotalItems > 0)
                    reportedTotalItems = pageTotalItems;
                // Composio reports current_page and total_pages beside next_cursor.
                // A broker that drops the cursor (or an upstream regression) can replay
                // a page while minting fresh cursors, so trust page movement: once it
                // stops advancing, the catalog is stuck and paging stops cleanly.
                const reportedPage = Number(json.current_page);
                if (Number.isFinite(reportedPage)) {
                    if (lastReportedPage !== undefined && reportedPage <= lastReportedPage) {
                        stop = "page-stuck";
                        break;
                    }
                    lastReportedPage = reportedPage;
                }
                const pageTotalPages = Number(json.total_pages);
                if (Number.isFinite(pageTotalPages) && pageTotalPages > 0)
                    reportedTotalPages = pageTotalPages;
                if (lastReportedPage !== undefined &&
                    Number.isFinite(pageTotalPages) &&
                    pageTotalPages > 0 &&
                    lastReportedPage >= pageTotalPages) {
                    stop = "total-reached";
                    break;
                }
                const next = typeof json.next_cursor === "string" ? json.next_cursor.trim() : "";
                if (!next) {
                    stop = "end";
                    break;
                }
                if (seenCursors.has(next)) {
                    stop = "cursor-repeated";
                    break;
                }
                seenCursors.add(next);
                cursor = next;
            }
            if (items.length) {
                const cards = items.map((t) => ({
                    slug: canonicalToolkitSlug(String(t.slug ?? t.key ?? t.name ?? "")),
                    label: t.name ?? t.slug ?? "",
                    blurb: (t.meta?.description ?? t.description ?? "").slice(0, 90),
                    logo: t.meta?.logo ?? t.logo ?? null,
                    noAuth: t.no_auth === true,
                    domain: null,
                }));
                const uniqueCards = cards.filter((card, index) => card.slug && cards.findIndex((candidate) => candidate.slug === card.slug) === index);
                const shortOfReportedTotal = reportedTotalItems !== undefined && uniqueCards.length < reportedTotalItems;
                // Trust reported page counts even when the walk ends "cleanly": an
                // endpoint that stops at page 1 of 4 without a cursor is still partial.
                const pagingStoppedEarly = lastReportedPage !== undefined
                    && reportedTotalPages !== undefined
                    && lastReportedPage < reportedTotalPages;
                const stalled = shortOfReportedTotal || pagingStoppedEarly;
                // "end" and "total-reached" are the walk's natural finishes; every
                // other stop reason left pages unread even when the API reports no
                // totals for stalled to compare against.
                const complete = (stop === "end" || stop === "total-reached") && !stalled;
                const pagination = { items: uniqueCards.length, stalled, complete };
                if (reportedTotalItems !== undefined)
                    pagination.totalItems = reportedTotalItems;
                if (pagination.stalled)
                    pagination.reason = stop;
                if (pagination.stalled) {
                    console.warn(`[composio] marketplace catalog paging stopped early (${stop}) after ${uniqueCards.length} toolkits`
                        + (reportedTotalItems !== undefined ? ` of ~${reportedTotalItems}` : "")
                        + "; serving a partial marketplace");
                }
                toolkitCache = { at: Date.now(), cards: uniqueCards, identity: identity, pagination };
                return { cards: uniqueCards, source: "api", pagination };
            }
        }
        catch {
            /* fall through to curated */
        }
    }
    return { cards: CURATED, source: "curated" };
}
export async function toolkitCard(cfg, slug) {
    const normalized = canonicalToolkitSlug(slug);
    const { cards } = await listToolkits(cfg);
    return cards.find((card) => card.slug.toLowerCase() === normalized)
        ?? CURATED.find((card) => card.slug === normalized)
        ?? {
            slug: normalized,
            label: normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
            blurb: "Connect this app so your bot can continue",
            logo: null,
            domain: null,
        };
}
export const CURATED_SLUGS = CURATED.map((c) => c.slug);
