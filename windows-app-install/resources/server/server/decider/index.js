import { deciderCredential } from "../included-services.js";
import { jevBackend } from "./jev.js";
import { hybridBackend, layaBackend } from "./laya.js";
import { appendDeciderLog, stateHash } from "./log.js";
import { KEY_CHECK_QUESTION, KEY_CHECK_STATE, relayAccepts, relaySeam } from "./relay.js";
export { DECIDER_JOBS } from "./types.js";
/** Used when a caller passes no timeout. Room routing passes its own. */
export const DEFAULT_DECIDER_TIMEOUT_MS = 1_500;
/** The Settings key check is one tiny call a person is waiting on. */
export const KEY_CHECK_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 50;
const MAX_TIMEOUT_MS = 30_000;
/** A request the switches never let through. */
const offBackend = {
    id: "off",
    decide: async () => ({ ok: false, reason: "disabled" }),
};
const BACKENDS = {
    jev: jevBackend,
    laya: layaBackend,
    hybrid: hybridBackend,
};
export function deciderProvider(cfg) {
    const provider = cfg.decider?.provider ?? "jev";
    return provider in BACKENDS ? provider : "off";
}
function isLayaProvider(provider) {
    return provider === "laya" || provider === "hybrid";
}
/** The key a call uses and the one base URL it goes to: the person's own
 * (a draft being tested, else the config value or the desktop's encrypted
 * store handed over as env) with `decider.baseUrl` or Jev's own, else Cloud
 * Pro's included token with the Admin's relay, but only where the relay
 * accepts that seam: any other job has only an own key. Resolved on every
 * call. When Laya or Hybrid is selected, the local Laya System-One engine
 * supplies a built-in local credential when no external key is set. */
function deciderAccount(cfg, seam, draft) {
    const account = deciderCredential(draft?.trim() || cfg.decider?.key, cfg.decider?.baseUrl);
    if (account) {
        return account.included && seam && !relaySeam(seam) ? null : account;
    }
    if (isLayaProvider(cfg.decider?.provider)) {
        return {
            token: draft?.trim() || cfg.decider?.key || "laya-local",
            api: cfg.decider?.baseUrl || "http://127.0.0.1:8010",
            included: false,
        };
    }
    return null;
}
/** A key is on file, or Cloud Pro includes decisions here, or Laya is active. */
export function deciderConfigured(cfg) {
    return Boolean(deciderAccount(cfg));
}
/** Cloud Pro includes decisions on this machine, whatever key is saved:
 * what clearing an own key falls back to. */
export function deciderIncludedHere() {
    return deciderCredential(undefined, undefined)?.included === true;
}
/** The master switch as it takes effect: off while there is no key. With an
 * own key it is on once switched on (saving the key does that); with Cloud
 * Pro's included decisions or Laya it is on until someone switches it off. */
export function deciderEnabled(cfg) {
    const account = deciderAccount(cfg);
    const provider = deciderProvider(cfg);
    if (!account || provider === "off")
        return false;
    if (isLayaProvider(provider))
        return cfg.decider?.enabled !== false;
    return account.included ? cfg.decider?.enabled !== false : cfg.decider?.enabled === true;
}
/** One job's own switch. Absent means on: turning the decider on turns on
 * what it decides unless a job was switched off by hand. */
export function deciderJobOn(cfg, job) {
    return cfg.decider?.jobs?.[job] !== false;
}
/** Whether a job would be asked right now. Callers check this before they
 * spend any effort building a request. */
export function deciderReady(cfg, job) {
    return deciderEnabled(cfg) && deciderJobOn(cfg, job) && Boolean(deciderAccount(cfg, job));
}
/** What Settings needs. Never the key, and not the base URL either: that is
 * an operator setting with no UI. `included`: the decisions are Cloud Pro's,
 * not a saved key. */
export function describeDecider(cfg) {
    const account = deciderAccount(cfg);
    const rawProvider = deciderProvider(cfg);
    const provider = rawProvider === "off" ? "jev" : rawProvider;
    return {
        provider,
        configured: Boolean(account),
        ...(account?.included ? { included: true } : {}),
        enabled: deciderEnabled(cfg),
        jobs: {
            roomRouting: deciderJobOn(cfg, "roomRouting"),
            browserClicks: deciderJobOn(cfg, "browserClicks"),
            toolSelection: deciderJobOn(cfg, "toolSelection"),
            placement: deciderJobOn(cfg, "placement"),
        },
    };
}
/** The config write a Settings save becomes. */
export function deciderSavePatch(patch, current, included = false) {
    const next = { ...patch };
    const targetProvider = next.provider ?? current?.provider ?? "jev";
    const layaActive = isLayaProvider(targetProvider);
    const savingKey = typeof patch.key === "string" && Boolean(patch.key.trim());
    const clearingKey = typeof patch.key === "string" && !patch.key.trim();
    if (typeof patch.key === "string")
        next.key = patch.key.trim();
    if (savingKey) {
        next.enabled = patch.enabled ?? true;
        next.jobs = { ...current?.jobs, roomRouting: true, ...patch.jobs };
    }
    else if (clearingKey) {
        if (!included && !layaActive)
            next.enabled = false;
    }
    else if (patch.jobs) {
        next.jobs = { ...current?.jobs, ...patch.jobs };
    }
    if (layaActive && patch.provider && next.enabled === undefined) {
        next.enabled = true;
        next.jobs = {
            roomRouting: true,
            browserClicks: true,
            toolSelection: true,
            placement: true,
            ...current?.jobs,
            ...patch.jobs,
        };
    }
    if (next.enabled === true && !savingKey && !current?.key?.trim() && !included && !layaActive) {
        return { ok: false, error: "Save a Jev API key or switch to Laya (laya-system-one) before turning on fast decisions." };
    }
    return { ok: true, patch: next };
}
export function createDecider(deps) {
    const fetchImpl = deps.fetch ?? fetch;
    const now = deps.now ?? (() => performance.now());
    function gate(cfg, seam) {
        if (deciderProvider(cfg) === "off")
            return "disabled";
        if (seam === "keyCheck")
            return null;
        if (!deciderConfigured(cfg))
            return cfg.decider?.enabled === true ? "no_key" : "disabled";
        if (!deciderEnabled(cfg))
            return "disabled";
        if (!deciderJobOn(cfg, seam))
            return "job_off";
        // Only the included token, and the relay does not take this job.
        if (!deciderAccount(cfg, seam))
            return "no_key";
        return null;
    }
    async function call(seam, backend, request, options) {
        const provider = backend.id === "off" ? undefined : backend.id;
        if (options.signal?.aborted)
            return { ok: false, ...(provider ? { provider } : {}), reason: "cancelled" };
        const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_DECIDER_TIMEOUT_MS));
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        options.signal?.addEventListener("abort", onAbort, { once: true });
        let timer;
        // The race, not only the abort, bounds the call: a body that stalls
        // after its headers must not hold a room turn past the budget.
        const timedOut = new Promise((resolve) => {
            timer = setTimeout(() => {
                controller.abort();
                resolve({ ok: false, reason: "timeout" });
            }, timeoutMs);
        });
        const started = now();
        let outcome;
        try {
            const decided = Promise.resolve()
                .then(() => backend.decide({ ...request, signal: controller.signal, fetch: fetchImpl }))
                .catch(() => ({ ok: false, reason: "malformed" }));
            outcome = await Promise.race([decided, timedOut]);
        }
        finally {
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", onAbort);
        }
        const latencyMs = Math.max(0, Math.round(now() - started));
        if (!outcome.ok && outcome.reason !== "timeout" && options.signal?.aborted)
            outcome = { ok: false, reason: "cancelled" };
        if (provider && deps.dataDir) {
            const first = outcome.ok ? Object.values(outcome.answers).find((answer) => answer.type === "choice") : undefined;
            appendDeciderLog(deps.dataDir, {
                at: new Date().toISOString(),
                seam,
                provider,
                ok: outcome.ok,
                ...(!outcome.ok ? { reason: outcome.reason, ...(outcome.status ? { status: outcome.status } : {}) } : {}),
                ...(first ? { choice: first.choice } : {}),
                pTop: first?.pTop ?? null,
                margin: first?.margin ?? null,
                latencyMs,
                ...(outcome.ok && outcome.inputTokens !== undefined ? { inputTokens: outcome.inputTokens } : {}),
                stateHash: stateHash(request.state),
            });
        }
        if (!outcome.ok)
            return { ok: false, ...(provider ? { provider } : {}), reason: outcome.reason, ...(outcome.status ? { status: outcome.status } : {}), latencyMs };
        return {
            ok: true,
            provider: provider,
            answers: outcome.answers,
            latencyMs,
            ...(outcome.inputTokens !== undefined ? { inputTokens: outcome.inputTokens } : {}),
            ...(outcome.model ? { model: outcome.model } : {}),
        };
    }
    async function ask(seam, state, questions, options = {}) {
        try {
            const cfg = deps.config();
            const refused = gate(cfg, seam);
            if (refused)
                return { ok: false, reason: refused };
            const provider = deciderProvider(cfg);
            const backend = provider === "off" ? offBackend : BACKENDS[provider];
            const account = deciderAccount(cfg, seam);
            // Through the included token, only the exact requests the relay takes.
            if (account.included && !relayAccepts(seam, state, questions))
                return { ok: false, reason: "misconfigured" };
            return await call(seam, backend, { key: account.token, baseUrl: account.api, state, questions }, options);
        }
        catch {
            return { ok: false, reason: "malformed" };
        }
    }
    const single = (result) => result.ok ? { ...result, answers: result.answers.answer } : result;
    return {
        ask,
        async choose(seam, state, question, options) {
            const asked = { answer: { type: "choice", instructions: question.instructions, options: question.options } };
            return single(await ask(seam, state, asked, options));
        },
        async score(seam, state, question, options) {
            return single(await ask(seam, state, { answer: { type: "score", instructions: question.instructions, levels: question.levels } }, options));
        },
        async yesNo(seam, state, instructions, options) {
            return single(await ask(seam, state, { answer: { type: "yesno", instructions } }, options));
        },
        async testKey(input = {}, options = {}) {
            try {
                const cfg = deps.config();
                // A draft or saved own key goes to Jev (or decider.baseUrl); with
                // neither, Cloud Pro's included token goes to its relay.
                const account = deciderAccount(cfg, "keyCheck", input.key);
                if (!account)
                    return { ok: false, reason: "no_key" };
                const provider = deciderProvider(cfg);
                const backend = provider === "off" ? offBackend : BACKENDS[provider];
                const questions = { answer: { type: "yesno", instructions: KEY_CHECK_QUESTION } };
                if (account.included && !relayAccepts("keyCheck", KEY_CHECK_STATE, questions))
                    return { ok: false, reason: "misconfigured" };
                return single(await call("keyCheck", backend, {
                    key: account.token,
                    baseUrl: account.api,
                    state: KEY_CHECK_STATE,
                    questions,
                }, { timeoutMs: KEY_CHECK_TIMEOUT_MS, ...options }));
            }
            catch {
                return { ok: false, reason: "malformed" };
            }
        },
    };
}
