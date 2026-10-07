const API = (process.env.OMB_FISH_AUDIO_API || "https://api.fish.audio").replace(/\/+$/, "");
/** Used when no model is saved, so existing setups keep their behavior. */
export const DEFAULT_FISH_MODEL = "s2.1-pro-free";
export const DEFAULT_FISH_VOICE_ID = "933563129e564b19a115bedd57b7406a";
const MAX_ERROR_LENGTH = 240;
const PAGE_SIZE = 100;
const MAX_OWNED_PAGES = 100;
export const FALLBACK_FISH_VOICES = [
    { id: "933563129e564b19a115bedd57b7406a", label: "Sarah (Fish Free)", description: "Warm, natural conversational voice" },
    { id: "8ec9973300874562962bbcb300f82213", label: "Guyzo (Fish Free)", description: "Clear, expressive male voice" },
    { id: "35a41c4c9e754e49a124a4bab5aa47e6", label: "Aria (Fish Free)", description: "Bright, energetic assistant voice" },
    { id: "90e65eaaf50e4470b8e6d43ee6afd7d5", label: "Announcer (Fish Free)", description: "Bold studio announcer voice" },
    { id: "d13f84b987ad4f22b56d2b47f4eb838e", label: "Narrator (Fish Free)", description: "Deep cinematic narrator voice" },
];
async function safeBody(res) {
    try {
        const text = await res.text();
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch {
            return { message: text };
        }
    }
    catch {
        return null;
    }
}
function serviceDetail(body) {
    if (!body || typeof body !== "object")
        return "";
    const record = body;
    const detail = record.detail;
    const message = (typeof detail === "string" && detail) ||
        (detail && typeof detail === "object" && typeof detail.message === "string"
            ? detail.message
            : "") ||
        (typeof record.message === "string" && record.message) ||
        (typeof record.error === "string" && record.error) ||
        "";
    return message.trim().slice(0, MAX_ERROR_LENGTH);
}
function errorMessage(status, action, body) {
    const detail = serviceDetail(body);
    if (status === 401 || status === 403) {
        return "Fish Audio rejected that API key, or the key cannot access voice models.";
    }
    if (status === 402)
        return detail || "Fish Audio says this account has insufficient balance.";
    if (status === 429)
        return detail || "Fish Audio is rate-limiting this account — wait a moment and try again.";
    return detail ? `${action} failed: ${detail}` : `${action} failed (${status})`;
}
/** Verify the exact permission the voice picker needs. */
export async function verifyKey(key) {
    if (!key.trim() || key.trim() === "free")
        return { ok: true };
    try {
        // The public catalog is intentionally readable without authentication,
        // so it cannot prove a supplied key. `self=true` crosses the account
        // boundary and returns 401 for an absent or invalid Bearer token.
        const res = await fetch(`${API}/model?page_size=1&self=true`, {
            headers: { authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(20_000),
        });
        if (res.ok)
            return { ok: true };
        return { ok: false, message: errorMessage(res.status, "checking that key", await safeBody(res)) };
    }
    catch {
        return { ok: false, message: "Couldn't reach Fish Audio to check that key — check your connection." };
    }
}
async function modelPage(key, query) {
    let response;
    const headers = {};
    if (key && key !== "free")
        headers.authorization = `Bearer ${key}`;
    try {
        response = await fetch(`${API}/model?${query}`, {
            headers,
            signal: AbortSignal.timeout(20_000),
        });
    }
    catch {
        throw new Error("Couldn't reach Fish Audio to list voices — check your connection.");
    }
    const body = await safeBody(response);
    if (!response.ok)
        throw new Error(errorMessage(response.status, "listing voices", body));
    if (!body || typeof body !== "object")
        return { items: [], hasMore: false };
    const page = body;
    return {
        items: Array.isArray(page.items) ? page.items : [],
        hasMore: page.has_more === true,
    };
}
export async function listVoices(key) {
    try {
        const hasPersonalKey = Boolean(key && key.trim() && key.trim() !== "free");
        const [publicPage, owned] = await Promise.all([
            modelPage(hasPersonalKey ? key : undefined, `page_size=${PAGE_SIZE}&sort_by=task_count`).catch(() => ({
                items: [],
                hasMore: false,
            })),
            hasPersonalKey
                ? (async () => {
                    const items = [];
                    for (let pageNumber = 1; pageNumber <= MAX_OWNED_PAGES; pageNumber += 1) {
                        const page = await modelPage(key, `page_size=${PAGE_SIZE}&self=true&sort_by=created_at&page_number=${pageNumber}`);
                        items.push(...page.items);
                        if (!page.hasMore)
                            return items;
                    }
                    return items;
                })().catch(() => [])
                : Promise.resolve([]),
        ]);
        const items = [...publicPage.items, ...owned];
        const voices = items.flatMap((item) => {
            if (!item || typeof item !== "object")
                return [];
            const model = item;
            if (model.type !== "tts" || model.state !== "trained")
                return [];
            const id = typeof model._id === "string" ? model._id.trim() : "";
            if (!id)
                return [];
            const label = typeof model.title === "string" && model.title.trim() ? model.title.trim() : "Voice";
            const description = typeof model.description === "string" && model.description.trim()
                ? model.description.trim().slice(0, MAX_ERROR_LENGTH)
                : undefined;
            return [{ id, label, description }];
        });
        const combined = [...FALLBACK_FISH_VOICES, ...voices];
        return [...new Map(combined.map((voice) => [voice.id, voice])).values()];
    }
    catch {
        return FALLBACK_FISH_VOICES;
    }
}
function splitFreeTtsChunks(text, maxLen = 180) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned)
        return [];
    if (cleaned.length <= maxLen)
        return [cleaned];
    const words = cleaned.split(" ");
    const chunks = [];
    let current = "";
    for (const word of words) {
        if (!current) {
            current = word.slice(0, maxLen);
        }
        else if (current.length + 1 + word.length <= maxLen) {
            current += ` ${word}`;
        }
        else {
            chunks.push(current);
            current = word.slice(0, maxLen);
        }
    }
    if (current)
        chunks.push(current);
    return chunks;
}
function accentForVoice(voiceId) {
    switch (voiceId) {
        case "8ec9973300874562962bbcb300f82213":
            return "en-GB";
        case "35a41c4c9e754e49a124a4bab5aa47e6":
            return "en-AU";
        case "90e65eaaf50e4470b8e6d43ee6afd7d5":
            return "en-CA";
        default:
            return "en-US";
    }
}
async function synthesizeFreeAudio(text, voiceId) {
    const chunks = splitFreeTtsChunks(text, 180);
    const tl = accentForVoice(voiceId);
    const buffers = await Promise.all(chunks.map(async (chunk) => {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(url, {
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok)
            throw new Error(`Free TTS synthesis returned ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
    }));
    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        merged.set(buf, offset);
        offset += buf.byteLength;
    }
    return { bytes: merged, mime: "audio/mpeg" };
}
export async function synthesize(text, voiceId, key, model = DEFAULT_FISH_MODEL) {
    const effectiveKey = (key || process.env.FISH_API_KEY || process.env.OMB_FISH_KEY || "").trim();
    const effectiveVoice = (voiceId || DEFAULT_FISH_VOICE_ID).trim();
    if (effectiveKey && effectiveKey !== "free") {
        try {
            const res = await fetch(`${API}/v1/tts`, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${effectiveKey}`,
                    "content-type": "application/json",
                    accept: "audio/mpeg",
                    model,
                },
                body: JSON.stringify({
                    text,
                    reference_id: effectiveVoice,
                    format: "mp3",
                    sample_rate: 44_100,
                    mp3_bitrate: 64,
                    latency: "normal",
                }),
                signal: AbortSignal.timeout(30_000),
            });
            if (res.ok) {
                return { bytes: new Uint8Array(await res.arrayBuffer()), mime: "audio/mpeg" };
            }
        }
        catch {
            // Fall through to free audio synthesis so replies are always read aloud
        }
    }
    return synthesizeFreeAudio(text, effectiveVoice);
}
