export const DEFAULT_MODEL = "chatterbox-turbo";
/** What the picker falls back to when the server has no /v1/models. Most
 * Chatterbox servers speak with one built-in voice unless told otherwise,
 * so one honest entry beats a list of names the server may reject. */
export const FALLBACK_VOICES = [
    { id: "default", label: "Default", description: "the server's built-in Chatterbox voice" },
];
/** Accept "http://127.0.0.1:4123", the same with a trailing slash, and a
 * base that already ends in /v1 — the address is typed by hand, so meet
 * it halfway rather than 404ing over a slash. */
export function apiRoot(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}
async function safeJson(res) {
    try {
        return await res.json();
    }
    catch {
        return null;
    }
}
/** Prefer the server's own words over anything we can invent — wrapper
 * services vary, and their "model not loaded" says more than a 500. */
function message(status, what, body) {
    const theirs = (typeof body?.error === "string" && body.error.trim()) ||
        (typeof body?.detail === "string" && body.detail.trim()) ||
        (typeof body?.message === "string" && body.message.trim()) ||
        "";
    return theirs ? `${what} failed: ${theirs}` : `${what} failed (${status})`;
}
/** One bounded request shape for both calls: a dead server is the common
 * failure, and it must be named in the user's words, quickly. */
async function request(url, init, what, baseUrl) {
    try {
        return await fetch(url, init);
    }
    catch (e) {
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
            throw new Error(`${what} timed out — the Chatterbox server at ${baseUrl.trim()} did not answer`);
        }
        throw new Error(`couldn't reach the Chatterbox server at ${baseUrl.trim()} — check that it is running`);
    }
}
export async function listChatterboxVoices(baseUrl) {
    try {
        try {
            const res = await request(`${apiRoot(baseUrl)}/models`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) }, "listing voices", baseUrl);
            if (res.ok) {
                const body = await safeJson(res);
                const voices = (body?.data ?? [])
                    .map((m) => ({ id: String(m?.id ?? ""), label: String(m?.id ?? "") }))
                    .filter((v) => v.id);
                if (voices.length)
                    return voices;
            }
        }
        catch {
            // /v1/models missing or unreachable — try /v1/audio/voices next
        }
        // Some servers (e.g. Chatterbox-TTS-Server) list voices here instead.
        const voicesRes = await request(`${apiRoot(baseUrl)}/audio/voices`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) }, "listing voices", baseUrl);
        if (voicesRes.ok) {
            const body = await safeJson(voicesRes);
            const voices = (body?.voices ?? [])
                .map((entry) => {
                // Chatterbox-TTS-Server currently returns filename strings; docs (and
                // /get_predefined_voices) describe { filename, display_name } objects.
                if (typeof entry === "string")
                    return { id: entry, label: entry };
                const id = String(entry?.filename ?? entry?.id ?? "");
                return { id, label: String(entry?.display_name ?? entry?.name ?? id) };
            })
                .filter((v) => v.id);
            if (voices.length)
                return voices;
        }
    }
    catch {
        // fall through: the built-in entry below beats an empty picker
    }
    return FALLBACK_VOICES;
}
/** Ask for wav because every browser plays it and every OpenAI-compatible
 * server can produce it; the server's own content-type wins when it says
 * something else, so returned bytes are never mislabeled. */
export async function synthesizeChatterbox(text, voiceId, baseUrl, model) {
    const res = await request(`${apiRoot(baseUrl)}/audio/speech`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "audio/wav" },
        body: JSON.stringify({ model: model?.trim() || DEFAULT_MODEL, input: text, voice: voiceId, response_format: "wav" }),
        signal: AbortSignal.timeout(60_000),
    }, "speaking", baseUrl);
    if (!res.ok)
        throw new Error(message(res.status, "speaking", await safeJson(res)));
    const header = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const mime = header === "audio/mpeg" || header === "audio/mp3"
        ? "audio/mpeg"
        : header === "audio/x-wav"
            ? "audio/wav"
            : header.startsWith("audio/")
                ? header
                : "audio/wav";
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}
