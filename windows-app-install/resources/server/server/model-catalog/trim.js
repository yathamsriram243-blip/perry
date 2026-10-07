// Trims models.dev's api.json down to what OpenMausBot needs and drops
// anything unsafe to hand to OpenCode. Both the build script that makes the
// bundled snapshot (scripts/build-model-catalog.mjs) and the runtime refresh
// (catalog.ts) run their data through trimModelsDevCatalog, so a catalog
// fetched later passes exactly the same filter as the one we ship.
//
// Why braces matter: OpenCode expands `{env:NAME}` and `{file:path}` anywhere
// in its config text, and writing the brace as { in JSON does not stop it
// (verified on OpenCode 1.18.27). A provider or model string carrying a brace
// could make OpenCode read another provider's key or any file the user can
// read into a model name. So any provider or model with a `{` or `}` in any of
// its strings (or object keys) is dropped here, before anything else sees it.
//
// The trimmed shape keeps models.dev's own field names, so trimming is
// idempotent: a trimmed catalog passes through unchanged. That lets catalog.ts
// run every source (our cache, OpenCode's raw cache, the snapshot) through the
// same function. On disk each model also leaves out `id` (it is the key) and
// `tool_call` (every kept model has it); packCatalog/unpackCatalog convert,
// which keeps the shipped snapshot under its 150 KB gzipped budget.
import { normalizeApiUrl } from "../cli-api-setup.js";
export const MODEL_CATALOG_SCHEMA = 1;
// Generous caps: models.dev's largest provider lists about 600 models today.
const MAX_PROVIDERS = 2_000;
const MAX_MODELS_PER_PROVIDER = 5_000;
const MAX_DEPTH = 8;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ENV_NAME = /^[A-Za-z0-9_]{1,128}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/u;
const RELEASE_DATE = /^\d{4}-\d{2}(?:-\d{2})?$/;
/** True when the text holds a brace OpenCode could treat as a substitution. */
export function hasBrace(value) {
    return value.includes("{") || value.includes("}");
}
/** True when any string or object key inside `value` holds a brace. Values
 * nested deeper than models.dev ever goes count as unsafe too. */
export function containsBrace(value, depth = 0) {
    if (typeof value === "string")
        return hasBrace(value);
    if (value === null || typeof value !== "object")
        return false;
    if (depth > MAX_DEPTH)
        return true;
    if (Array.isArray(value))
        return value.some((item) => containsBrace(item, depth + 1));
    return Object.entries(value).some(([key, item]) => hasBrace(key) || containsBrace(item, depth + 1));
}
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
/** A map keyed by provider or model id. It has no prototype, so an id such as
 * `constructor` or `toString` finds nothing unless the catalog lists it, and a
 * `__proto__` key could not replace the prototype (it is also rejected). */
const idMap = () => Object.create(null);
/** Never a real id; as a plain-object key it would set the prototype. */
const RESERVED_KEY = "__proto__";
const finite = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
/** A display name: control characters removed, trimmed, capped. */
function displayName(value, fallback) {
    if (typeof value !== "string")
        return fallback;
    const clean = value.replace(new RegExp(CONTROL.source, "gu"), "").trim().slice(0, 128);
    return clean || fallback;
}
function httpsUrl(value) {
    if (typeof value !== "string")
        return undefined;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
    }
    catch {
        return undefined;
    }
}
function apiUrl(value) {
    if (typeof value !== "string")
        return undefined;
    try {
        return normalizeApiUrl(value);
    }
    catch {
        return undefined;
    }
}
function trimModel(key, raw) {
    if (!isRecord(raw))
        return "invalid";
    if (raw.id !== undefined && raw.id !== key)
        return "invalid";
    // The caller already drops a key with a brace; this is the backstop.
    if (!key || key.length > 256 || key === RESERVED_KEY || hasBrace(key) || CONTROL.test(key) || /\s/u.test(key))
        return "invalid";
    // Only models an agent can drive: current, tool-calling, text in.
    if (raw.status === "deprecated" || raw.tool_call !== true)
        return "skip";
    const modalities = isRecord(raw.modalities) ? raw.modalities : undefined;
    const input = Array.isArray(modalities?.input)
        ? modalities.input.filter((item) => typeof item === "string" && item.length <= 32).slice(0, 8)
        : [];
    if (!input.includes("text"))
        return "skip";
    const model = {
        id: key,
        name: displayName(raw.name, key),
        tool_call: true,
        reasoning: raw.reasoning === true,
        attachment: raw.attachment === true,
        modalities: { input },
    };
    if (typeof raw.release_date === "string" && RELEASE_DATE.test(raw.release_date))
        model.release_date = raw.release_date;
    const context = finite(isRecord(raw.limit) ? raw.limit.context : undefined);
    if (context !== undefined)
        model.limit = { context };
    if (isRecord(raw.cost)) {
        const cost = {};
        for (const field of ["input", "output"]) {
            const price = finite(raw.cost[field]);
            if (price !== undefined)
                cost[field] = price;
        }
        if (Object.keys(cost).length)
            model.cost = cost;
    }
    if (raw.status === "alpha" || raw.status === "beta")
        model.status = raw.status;
    return model;
}
function trimProvider(key, raw, options) {
    const drop = (reason) => {
        options.onDrop?.({ provider: key, reason });
        return undefined;
    };
    if (!isRecord(raw))
        return drop("invalid");
    // Every provider-level string, not only the fields kept below: a brace
    // anywhere means the entry was written for a templating system.
    const { models: rawModels, ...fields } = raw;
    if (hasBrace(key) || containsBrace(fields))
        return drop("brace");
    if (!PROVIDER_ID.test(key) || (raw.id !== undefined && raw.id !== key))
        return drop("invalid");
    const env = Array.isArray(raw.env) ? raw.env : [];
    if (!env.every((name) => typeof name === "string" && ENV_NAME.test(name)))
        return drop("invalid");
    const models = idMap();
    if (isRecord(rawModels)) {
        let kept = 0;
        for (const modelKey of Object.keys(rawModels).sort()) {
            const rawModel = rawModels[modelKey];
            if (hasBrace(modelKey) || containsBrace(rawModel)) {
                options.onDrop?.({ provider: key, model: modelKey, reason: "brace" });
                continue;
            }
            const model = trimModel(modelKey, rawModel);
            if (model === "invalid")
                options.onDrop?.({ provider: key, model: modelKey, reason: "invalid" });
            if (typeof model === "string")
                continue;
            models[modelKey] = model;
            if (++kept >= MAX_MODELS_PER_PROVIDER)
                break;
        }
    }
    // Field order is fixed (models last) so the snapshot text is stable.
    const provider = { id: key, name: displayName(raw.name, key), env: env.slice(0, 8) };
    if (typeof raw.npm === "string" && raw.npm.length <= 214 && !CONTROL.test(raw.npm))
        provider.npm = raw.npm;
    const api = apiUrl(raw.api);
    if (api)
        provider.api = api;
    const doc = httpsUrl(raw.doc);
    if (doc)
        provider.doc = doc;
    return { ...provider, models };
}
/** models.dev api.json (or an already-trimmed catalog) → the trimmed,
 * brace-free provider map, sorted by provider and model id. Anything that is
 * not an object yields an empty map. The provider map and every model map
 * have no prototype, so looking up an id the catalog lacks gives undefined. */
export function trimModelsDevCatalog(raw, options = {}) {
    const providers = idMap();
    if (!isRecord(raw))
        return providers;
    for (const key of Object.keys(raw).sort().slice(0, MAX_PROVIDERS)) {
        const provider = trimProvider(key, raw[key], options);
        if (provider)
            providers[key] = provider;
    }
    return providers;
}
/** Counts for logs and the build script's report. */
export function catalogStats(providers) {
    let models = 0;
    for (const provider of Object.values(providers))
        models += Object.keys(provider.models).length;
    return { providers: Object.keys(providers).length, models };
}
/** The on-disk form of a trimmed catalog. */
export function packCatalog(providers) {
    return Object.fromEntries(Object.entries(providers).map(([id, provider]) => [id, {
            ...provider,
            models: Object.fromEntries(Object.entries(provider.models).map(([modelId, model]) => {
                const { id: _id, tool_call: _toolCall, ...stored } = model;
                return [modelId, stored];
            })),
        }]));
}
/** A stored catalog back in models.dev's shape, ready for trimModelsDevCatalog.
 * It only restores the two packed fields; trimming still validates the rest. */
export function unpackCatalog(stored) {
    if (!isRecord(stored))
        return stored;
    return Object.fromEntries(Object.entries(stored).map(([id, provider]) => {
        if (!isRecord(provider) || !isRecord(provider.models))
            return [id, provider];
        const models = Object.fromEntries(Object.entries(provider.models).map(([modelId, model]) => [modelId, isRecord(model) ? { ...model, id: modelId, tool_call: true } : model]));
        return [id, { ...provider, models }];
    }));
}
