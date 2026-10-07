// What bots with Memory upkeep added to the shared About me on their own.
// A durable fact about the person, taken from the person's own words, is
// appended to About me as a dated, attributed line — every bot then knows
// it — and recorded here so Settings can list it with a Remove button.
// A removed fact is remembered (by identity only) and never added again.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { writeFileAtomic } from "./atomic.js";
import { DATA_DIR } from "./config.js";
import { factIdentity } from "./memory-entries.js";
import { redactSecretsInText } from "./redact.js";
const MAX_KEPT = 200;
const MAX_REMOVED = 500;
const TEXT_MAX = 300;
function filePath() {
    return join(DATA_DIR, "profile-learned.json");
}
function load() {
    try {
        const parsed = JSON.parse(readFileSync(filePath(), "utf8"));
        const learned = Array.isArray(parsed.learned)
            ? parsed.learned.filter((f) => Boolean(f) && typeof f.id === "string" && typeof f.text === "string" && typeof f.line === "string" && typeof f.botId === "string" && typeof f.botName === "string" && typeof f.at === "number")
            : [];
        const removed = Array.isArray(parsed.removed) ? parsed.removed.filter((r) => typeof r === "string") : [];
        return { learned, removed };
    }
    catch {
        return { learned: [], removed: [] };
    }
}
function save(file) {
    mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    writeFileAtomic(filePath(), `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
}
/** Newest first, as Settings lists them. */
export function listLearnedFacts() {
    return [...load().learned].reverse();
}
/** A fact as the line About me gains: dated and attributed, like a memory entry. */
export function aboutMeLine(fact, today) {
    return `- ${today} · learned by ${fact.botName.replace(/·/g, "-").replace(/\s+/g, " ").trim().slice(0, 60)} · ${fact.text}`;
}
/** The identity of an About me line, attributed or hand-written. */
function lineIdentity(line) {
    return factIdentity(line.replace(/^\s*-\s*\d{4}-\d{2}-\d{2} · learned by [^·\n]* · /, ""));
}
/** Facts not yet in About me and never removed by the person, as the lines
 * to append. Nothing is recorded until commitLearned. */
export function planLearned(from, texts, aboutMe, today, now = Date.now()) {
    const file = load();
    const known = new Set([...file.removed, ...aboutMe.split("\n").map(lineIdentity)]);
    const out = [];
    for (const raw of texts) {
        const text = redactSecretsInText(raw.replace(/\s+/g, " ").trim()).slice(0, TEXT_MAX);
        const key = factIdentity(text);
        if (!key || known.has(key))
            continue;
        known.add(key);
        out.push({ id: randomUUID(), text, line: aboutMeLine({ text, botName: from.botName }, today), botId: from.botId, botName: from.botName, at: now });
    }
    return out;
}
export function commitLearned(facts) {
    if (!facts.length)
        return;
    const file = load();
    file.learned = [...file.learned, ...facts].slice(-MAX_KEPT);
    save(file);
}
/** About me with the lines appended, or null when it would pass the limit. */
export function appendAboutMe(aboutMe, lines, maxChars = 24_000) {
    if (!lines.length)
        return aboutMe;
    const base = aboutMe.replace(/\s+$/, "");
    const next = base ? `${base}\n${lines.join("\n")}` : lines.join("\n");
    return next.length > maxChars ? null : next;
}
/** Forget one learned fact: its line leaves About me (when it is still
 * there, unedited) and it is never added again. Save About me before
 * committing removal so a failed profile save leaves the fact retryable. */
export function removeLearned(id, aboutMe, saveAboutMe) {
    const file = load();
    const fact = file.learned.find((f) => f.id === id);
    if (!fact)
        return null;
    const lines = aboutMe.split("\n");
    const at = lines.indexOf(fact.line);
    if (at !== -1)
        lines.splice(at, 1);
    const next = lines.join("\n");
    if (next !== aboutMe)
        saveAboutMe?.(next);
    file.learned = file.learned.filter((f) => f.id !== id);
    file.removed = [...file.removed, factIdentity(fact.text)].slice(-MAX_REMOVED);
    save(file);
    return { fact, aboutMe: next };
}
