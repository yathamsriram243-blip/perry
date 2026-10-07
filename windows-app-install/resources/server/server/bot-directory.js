import { parseJson } from "./schema.js";
export const BOT_DIRECTORY_URL = "https://botdirectory.ai";
export const BOT_DIRECTORY_API_URL = "https://api.botdirectory.ai/api/bots";
const MAX_DIRECTORY_BYTES = 1_000_000;
const MAX_DIRECTORY_BOTS = 200;
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function text(value, max) {
    if (typeof value !== "string" || !value.trim())
        return null;
    const normalized = value.trim();
    return normalized.length > max ? null : normalized;
}
/** Validate the community-maintained index before any of it reaches the
 * renderer. Entries that do not parse are dropped, not fatal — one bad
 * community submission must not blank the whole directory. */
export function parseBotDirectory(value) {
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.bots)) {
        throw new Error("The bot directory response is not supported");
    }
    const bots = [];
    const seen = new Set();
    for (const raw of value.bots.slice(0, MAX_DIRECTORY_BOTS)) {
        if (!isRecord(raw))
            continue;
        const slug = text(raw.slug, 100);
        if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug) || seen.has(slug))
            continue;
        const name = text(raw.name, 100);
        const prompt = text(raw.prompt, 4_000);
        if (!name || !prompt)
            continue;
        const detailUrl = text(raw.detailUrl, 300);
        if (!detailUrl || !detailUrl.startsWith(`${BOT_DIRECTORY_URL}/`))
            continue;
        seen.add(slug);
        bots.push({
            slug,
            name,
            category: text(raw.category, 80) ?? "",
            integrations: Array.isArray(raw.integrations)
                ? raw.integrations.flatMap((item) => text(item, 80) ?? []).slice(0, 20)
                : [],
            prompt,
            detailUrl,
        });
    }
    return bots;
}
/** Read the body in bounded chunks: an oversized or endless response is
 * rejected the moment it crosses the cap, never buffered whole first. */
async function readBounded(response, maxBytes) {
    const oversized = () => new Error("The bot directory response is too large");
    const announced = Number(response.headers.get("content-length") ?? 0);
    if (announced > maxBytes)
        throw oversized();
    if (!response.body) {
        const raw = await response.text();
        if (Buffer.byteLength(raw) > maxBytes)
            throw oversized();
        return raw;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => { });
            throw oversized();
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
}
export async function fetchBotDirectory(fetcher = fetch) {
    const response = await fetcher(BOT_DIRECTORY_API_URL, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
        throw new Error(`The bot directory returned HTTP ${response.status}`);
    return parseBotDirectory(parseJson(await readBounded(response, MAX_DIRECTORY_BYTES)));
}
/** Rank directory bots against a scouted project: overlap between the
 * project's stacks/summary words and a bot's name, category and
 * integrations. Purely lexical on purpose — deterministic, explainable,
 * and honest about being a hint rather than a verdict. */
// Words that appear in nearly every project blurb and would match nearly
// every directory entry. A match on one of these is noise, not affinity —
// measured live: "Your own team of AI bots" matched a home-value tracker
// purely on "your".
const STOPWORDS = new Set([
    "your", "with", "that", "this", "from", "have", "what", "when", "where", "will",
    "them", "then", "than", "only", "also", "into", "over", "about", "after", "before",
    "every", "some", "most", "much", "many", "very", "just", "like", "each", "other",
    "their", "there", "these", "those", "using", "based", "open", "free", "fast",
    "simple", "easy", "apps", "tool", "tools", "project", "team", "chat", "bots",
]);
export function matchDirectoryBots(profile, bots, limit = 5) {
    const terms = new Set();
    for (const stack of profile.stacks) {
        const term = stack.toLowerCase();
        // a two- or three-letter stack ("go", "php") substring-matches half the
        // directory — "google", "django", "logo" are not Go affinity
        if (term.length >= 4)
            terms.add(term);
    }
    for (const signal of profile.signals)
        terms.add(signal.role);
    // "." and "#" stay word-internal for the likes of next.js and C#, but a
    // sentence-final "payments." must still match "Payments"
    for (const raw of `${profile.name} ${profile.summary}`.toLowerCase().split(/[^a-z0-9+.#-]+/)) {
        const word = raw.replace(/^[.#+-]+|[.#+-]+$/g, "");
        if (word.length >= 4 && !STOPWORDS.has(word))
            terms.add(word);
    }
    const scored = bots.flatMap((bot) => {
        const haystackParts = [bot.name, bot.category, ...bot.integrations].map((part) => part.toLowerCase());
        const matched = [...terms].filter((term) => haystackParts.some((part) => part.includes(term)));
        return matched.length > 0 ? [{ ...bot, matched }] : [];
    });
    return scored.sort((a, b) => b.matched.length - a.matched.length).slice(0, limit);
}
