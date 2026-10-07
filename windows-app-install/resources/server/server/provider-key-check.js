export const PROVIDER_KEY_KINDS = ["anthropic", "openai", "openrouter", "openaiCompat", "xai", "mistral", "cerebras"];
const DEFAULT_URLS = {
    anthropic: "https://api.anthropic.com",
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    openaiCompat: "https://openrouter.ai/api/v1",
    xai: "https://api.x.ai/v1",
    mistral: "https://api.mistral.ai/v1",
    cerebras: "https://api.cerebras.ai/v1",
};
const MAX_MODELS = 5;
/** A URL hostname on this machine: the only place a key may go over plain http. */
export function isLoopback(hostname) {
    const host = hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("127.");
}
/** The models endpoint for a provider, from its base URL or the default. */
export function providerModelsUrl(provider, base) {
    const root = (base?.trim() || DEFAULT_URLS[provider]).replace(/\/+$/, "");
    if (provider === "anthropic")
        return root.endsWith("/v1") ? `${root}/models` : `${root}/v1/models`;
    return `${root}/models`;
}
function modelIds(body) {
    const record = body && typeof body === "object" ? body : null;
    const list = Array.isArray(body) ? body : Array.isArray(record?.data) ? record.data : Array.isArray(record?.models) ? record.models : [];
    const ids = [];
    for (const entry of list) {
        const item = entry && typeof entry === "object" ? entry : null;
        const id = typeof item?.id === "string" ? item.id : typeof item?.name === "string" ? item.name : null;
        if (id && id.length <= 120)
            ids.push(id);
        if (ids.length === MAX_MODELS)
            break;
    }
    return ids;
}
export async function checkProviderKey(input, fetchImpl = fetch, timeoutMs = 10_000) {
    if (!input.key.trim())
        return { ok: false, reason: "rejected" };
    let url;
    try {
        url = new URL(providerModelsUrl(input.provider, input.url));
    }
    catch {
        return { ok: false, reason: "unexpected" };
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
        return { ok: false, reason: "unexpected" };
    }
    const authenticate = (input.provider === "openaiCompat" || input.provider === "openrouter")
        && url.origin === "https://openrouter.ai" && url.pathname === "/api/v1/models";
    if (authenticate)
        url.pathname = "/api/v1/key";
    const headers = input.provider === "anthropic"
        ? { "x-api-key": input.key, "anthropic-version": "2023-06-01" }
        : { authorization: `Bearer ${input.key}` };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        // A redirect is never followed: the key must not be replayed to
        // whichever host the provider's front door points at today.
        const response = await fetchImpl(url, { headers, signal: controller.signal, redirect: "manual" });
        if (response.status === 401 || response.status === 403)
            return { ok: false, reason: "rejected", status: response.status };
        if (!response.ok)
            return { ok: false, reason: "unexpected", status: response.status };
        const body = await response.json().catch(() => null);
        if (!body || typeof body !== "object")
            return { ok: false, reason: "unexpected", status: response.status };
        if (authenticate) {
            const data = body.data;
            if (!data || typeof data !== "object" || Array.isArray(data)
                || typeof data.is_free_tier !== "boolean") {
                return { ok: false, reason: "unexpected", status: response.status };
            }
            // /key also returns account and usage details; none belong in this verdict.
            return { ok: true, check: "authentication", models: [] };
        }
        return { ok: true, check: "models", models: modelIds(body) };
    }
    catch {
        return { ok: false, reason: "unreachable" };
    }
    finally {
        clearTimeout(timer);
    }
}
