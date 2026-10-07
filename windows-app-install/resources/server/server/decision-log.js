// The authorization DECISION log: one fleet-wide, append-only NDJSON file
// answering "which tool call was allowed, denied, or carded — by which
// rule, when, for which bot".
//
// The per-thread event log (harness/bus.ts) cannot answer that. It records
// that a request opened and later resolved, but the WHY — a grant waved it
// through, a guard held it, an unattended block overrode a grant that
// would otherwise have fired — exists only for a moment at the fold point
// and is gone by the time the event is on disk. So the fold writes the
// reason down here at the moment it is known, and the human-answer path
// writes a second row when a card comes back.
//
// Same discipline as the event tee: 0600 (rows name tools and command
// lines), through redactSecrets (summaries carry whatever the agent typed,
// credentials included), and fire-and-forget — an audit log must never
// take down the decision it is auditing.
//
// Layout and retention follow the usage ledger: one file per UTC month under
// <data>/decisions/YYYY-MM.ndjson, and a month file is deleted only once the
// whole month is older than the retention window (default 180 days, config
// `decisions.retentionDays` or OMB_DECISION_RETENTION_DAYS), so at least that
// much history is always kept. Older servers wrote one decisions.ndjson that
// rotated to .1 at 4 MB; both are still read, never written, and removed by
// the same window once their last row is older than it.
//
// Deliberately NOT covered: ask_bot peer-approval cards. They never cross
// the runtime bus (peer-approval.ts appends its cards straight to the
// store), so wiring them here would mean a second, parallel tap — a
// separate change if it earns its keep.
import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";
import { appendFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { redactSecrets } from "./redact.js";
import { csvCell, monthKey } from "./usage-ledger.js";
const DIR = "decisions";
const LEGACY_FILE = "decisions.ndjson";
const MONTH_FILE = /^(\d{4})-(\d{2})\.ndjson$/;
const DAY_MS = 24 * 60 * 60_000;
const PRUNE_EVERY_MS = 60 * 60_000;
export const DEFAULT_DECISION_RETENTION_DAYS = 180;
export const MAX_DECISION_RETENTION_DAYS = 3650;
const writeQueues = new Map();
const lastPrune = new Map();
let retentionDays = () => DEFAULT_DECISION_RETENTION_DAYS;
/** The server binds its configured window once; see decisionRetentionDays. */
export function bindDecisionRetention(provider) {
    retentionDays = provider;
}
/** The window in force now. The admin activity log (admin-activity.ts)
 * keeps its months for the same time, so one setting covers both. */
export function boundRetentionDays() {
    return retentionDays();
}
/** The retention window in days: OMB_DECISION_RETENTION_DAYS when it is a
 * whole number in range, else the configured value, else 180. */
export function decisionRetentionDays(configured, env = process.env) {
    const fromEnv = env.OMB_DECISION_RETENTION_DAYS?.trim();
    const parsed = fromEnv ? Number(fromEnv) : NaN;
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_DECISION_RETENTION_DAYS)
        return parsed;
    if (typeof configured === "number" && Number.isInteger(configured) && configured >= 1 && configured <= MAX_DECISION_RETENTION_DAYS)
        return configured;
    return DEFAULT_DECISION_RETENTION_DAYS;
}
const actorScope = new AsyncLocalStorage();
/** Run `work` as a person's card answer: every `source: "user"` row it
 * writes names `actor` (and `via`, for an answer spoken on a Live call),
 * without each resolver having to thread it through. */
export function withDecisionActor(actor, work, via) {
    return actorScope.run(via ? { actor, via } : { actor }, work);
}
export function decisionFileFor(dataDir, at) {
    return join(dataDir, DIR, `${monthKey(at)}.ndjson`);
}
async function writeDecision(dataDir, record) {
    const at = new Date(record.at);
    await mkdir(join(dataDir, DIR), { recursive: true, mode: 0o700 });
    await appendFile(decisionFileFor(dataDir, at), JSON.stringify(record) + "\n", { mode: 0o600 });
    if (at.getTime() - (lastPrune.get(dataDir) ?? 0) >= PRUNE_EVERY_MS) {
        lastPrune.set(dataDir, at.getTime());
        await pruneDecisions(dataDir, retentionDays(), at);
    }
}
/** Append one decision row. Fire-and-forget, mirroring the event bus tee:
 * the fold that calls this is delivering approvals and cards, and a full
 * disk must not turn into denied tools. */
export function appendDecision(dataDir, row) {
    const scope = row.source === "user" ? actorScope.getStore() : undefined;
    const actor = row.actor ?? scope?.actor;
    const via = row.via ?? scope?.via;
    // Redact now, not when the queue drains: the row is what was true at the
    // moment of the decision.
    const record = redactSecrets({ at: new Date().toISOString(), ...row, ...(actor ? { actor } : {}), ...(via ? { via } : {}) });
    const previous = writeQueues.get(dataDir) ?? Promise.resolve();
    // Serialize appends (and the occasional prune) per directory, so two
    // simultaneous approvals keep their decision order.
    const queued = previous
        .then(() => writeDecision(dataDir, record))
        .catch(() => {
        /* logging must never take down the fold */
    });
    writeQueues.set(dataDir, queued);
    void queued.finally(() => {
        if (writeQueues.get(dataDir) === queued)
            writeQueues.delete(dataDir);
    });
}
/** Test/shutdown seam: wait until every decision already queued for this
 * directory has reached disk. Normal request paths deliberately do not wait. */
export async function flushDecisionLog(dataDir) {
    await writeQueues.get(dataDir);
}
/** Delete what the window no longer covers: a month file once the first
 * instant after its month is at or before `now - days`, a legacy file once
 * its last write is. Returns the names removed. Never throws. */
export async function pruneDecisions(dataDir, days, now = new Date()) {
    const cutoff = now.getTime() - days * DAY_MS;
    const removed = await pruneMonthFiles(join(dataDir, DIR), days, now);
    for (const name of [`${LEGACY_FILE}.1`, LEGACY_FILE]) {
        try {
            if ((await stat(join(dataDir, name))).mtimeMs > cutoff)
                continue;
            await unlink(join(dataDir, name));
            removed.push(name);
        }
        catch {
            /* absent */
        }
    }
    return removed;
}
/** Delete the `YYYY-MM.ndjson` files in `dir` whose whole month is at or
 * before `now - days`. Returns the names removed. Never throws. Shared with
 * the admin activity log. */
export async function pruneMonthFiles(dir, days, now = new Date()) {
    const cutoff = now.getTime() - days * DAY_MS;
    const removed = [];
    let names = [];
    try {
        names = await readdir(dir);
    }
    catch {
        /* nothing written in the new layout yet */
    }
    for (const name of names) {
        const match = MONTH_FILE.exec(name);
        if (!match || Date.UTC(Number(match[1]), Number(match[2]), 1) > cutoff)
            continue;
        try {
            await unlink(join(dir, name));
            removed.push(name);
        }
        catch {
            /* already gone, or not ours to remove */
        }
    }
    return removed;
}
const isDecisionRow = (value) => typeof value === "object" &&
    value !== null &&
    typeof value.at === "string" &&
    typeof value.threadId === "string" &&
    typeof value.decision === "string" &&
    typeof value.source === "string";
function readRows(path) {
    let text;
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        return [];
    }
    const rows = [];
    for (const line of text.split("\n")) {
        if (!line)
            continue;
        try {
            const value = JSON.parse(line);
            if (isDecisionRow(value))
                rows.push(value);
        }
        catch {
            /* a line torn mid-write — skip the fragment, keep the rest */
        }
    }
    return rows;
}
/** Every file that may hold rows, oldest first: the legacy pair (which only
 * ever holds rows older than any month file), then the months in order. */
function sources(dataDir) {
    let months = [];
    try {
        months = readdirSync(join(dataDir, DIR)).filter((name) => MONTH_FILE.test(name)).sort();
    }
    catch {
        /* no month files yet */
    }
    return [join(dataDir, `${LEGACY_FILE}.1`), join(dataDir, LEGACY_FILE), ...months.map((name) => join(dataDir, DIR, name))];
}
/** The newest `limit` rows, oldest first — the same order the inspector
 * uses for thread events. Reads month files newest first and stops once it
 * has enough, so a long history costs no more than the page asked for. */
export function readDecisions(dataDir, limit) {
    const files = sources(dataDir);
    const chunks = [];
    let count = 0;
    for (let index = files.length - 1; index >= 0 && count < limit; index -= 1) {
        const rows = readRows(files[index]);
        chunks.unshift(rows);
        count += rows.length;
    }
    return chunks.flat().slice(-limit);
}
/** Every row whose time falls inside the range, oldest first. */
export function readDecisionRange(dataDir, range) {
    const from = range.from.getTime();
    const to = range.to.getTime();
    const first = monthKey(range.from);
    const last = monthKey(range.to);
    const rows = [];
    for (const file of sources(dataDir)) {
        // Month files outside the range are skipped unread; legacy files have no month.
        const month = MONTH_FILE.exec(basename(file));
        if (month && (`${month[1]}-${month[2]}` < first || `${month[1]}-${month[2]}` > last))
            continue;
        for (const row of readRows(file)) {
            const at = Date.parse(row.at);
            if (at >= from && at <= to)
                rows.push(row);
        }
    }
    return rows;
}
export function actorLabel(actor) {
    if (!actor)
        return "";
    if (actor.kind === "loopback")
        return "This computer";
    if (actor.kind === "worker")
        return "Local service";
    return actor.email ?? actor.label;
}
/** One line per decision, spreadsheet-ready. Cells go through the usage
 * CSV's formula neutralising, and every row through redaction again, so an
 * export never carries more than the log itself may. */
export function decisionsCsv(rows) {
    const header = ["time", "decision", "source", "bot", "tool", "summary", "rule", "unattended", "answered_by", "thread", "request"];
    const lines = [header.join(",")];
    for (const raw of rows) {
        const row = redactSecrets(raw);
        lines.push([
            row.at,
            row.decision,
            row.source,
            row.botName || row.botId || "",
            row.tool ?? "",
            row.summary ?? "",
            row.rule ?? "",
            row.unattended ? "yes" : "",
            row.via === "call" ? `${actorLabel(row.actor)} (by voice)` : actorLabel(row.actor),
            row.threadId,
            row.requestId ?? "",
        ].map(csvCell).join(","));
    }
    return lines.join("\n") + "\n";
}
