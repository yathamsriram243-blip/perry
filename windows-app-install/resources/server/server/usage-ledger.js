// The USAGE ledger: one row per settled turn, append-only, month by month
// under <data>/usage/, so "what did this workspace spend, by bot, by model,
// by person, by day" is answerable after a restart and exportable for an
// invoice. The per-task tally (store.ts addTaskUsage) is a running total
// that lives and dies with the task; this is the durable record.
//
// Same discipline as the decision log: 0600 files, serialized appends per
// directory, fire-and-forget. Bookkeeping must never fail the turn it is
// booking. Rows carry who asked and what it cost, never message text.
import { readFileSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { billableFor } from "./prices.js";
export const USAGE_GROUPINGS = ["bot", "model", "user", "day", "engine", "routine"];
const DIR = "usage";
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60_000;
const writeQueues = new Map();
const clean = (value) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const finiteOrNull = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const promptBytesOf = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const record = value;
    return typeof record.stable === "number" && typeof record.volatile === "number"
        ? { stable: clean(record.stable), volatile: clean(record.volatile) }
        : null;
};
/** The UTC month a row belongs to, `YYYY-MM`: the name of its month file.
 * The decision, admin-activity and decider logs use the same layout. */
export function monthKey(at) {
    return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function usageFileFor(dataDir, at) {
    return join(dataDir, DIR, `${monthKey(at)}.jsonl`);
}
/** Identifies one row: a thread runs one turn at a time, so a bot cannot
 * settle two turns on the same thread in the same millisecond. Lets the
 * spend cap tell a booked row it already counted from memory apart from the
 * same row read back from the file. */
export function usageRowKey(row) {
    return `${row.at}|${row.threadId}|${row.botId}`;
}
/** Append one settled turn. Fire-and-forget (see the module comment): the
 * returned promise never rejects, and says whether the row reached disk. */
export function appendUsage(dataDir, row) {
    const { promptBytes: rawPromptBytes, ...rest } = row;
    const promptBytes = promptBytesOf(rawPromptBytes);
    const record = {
        ...rest,
        at: row.at ?? new Date().toISOString(),
        input: clean(row.input),
        output: clean(row.output),
        ...(typeof row.cachedInput === "number" ? { cachedInput: clean(row.cachedInput) } : {}),
        ...(promptBytes ? { promptBytes } : {}),
        costUsd: finiteOrNull(row.costUsd),
    };
    // A cost is labelled with where it came from; an unpriced row carries no label.
    if (record.costUsd === null)
        delete record.costSource;
    else
        record.costSource = row.costSource === "estimated" ? "estimated" : "reported";
    const previous = writeQueues.get(dataDir) ?? Promise.resolve();
    const attempt = previous.then(() => write(dataDir, record));
    const queued = attempt.then(() => undefined, () => {
        /* bookkeeping must never take down the turn */
    });
    writeQueues.set(dataDir, queued);
    void queued.finally(() => {
        if (writeQueues.get(dataDir) === queued)
            writeQueues.delete(dataDir);
    });
    return attempt.then(() => true, () => false);
}
async function write(dataDir, record) {
    await mkdir(join(dataDir, DIR), { recursive: true, mode: 0o700 });
    await appendFile(usageFileFor(dataDir, new Date(record.at)), JSON.stringify(record) + "\n", { mode: 0o600 });
}
/** Test/shutdown seam: wait until everything queued for this directory is on disk. */
export async function flushUsageLedger(dataDir) {
    await writeQueues.get(dataDir);
}
const isTrigger = (value) => typeof value === "object" && value !== null && typeof value.kind === "string";
const isUsageRow = (value) => typeof value === "object" &&
    value !== null &&
    typeof value.at === "string" &&
    typeof value.botId === "string" &&
    typeof value.model === "string" &&
    typeof value.input === "number" &&
    typeof value.output === "number" &&
    isTrigger(value.trigger);
function monthsBetween(from, to) {
    const keys = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (cursor.getTime() <= to.getTime()) {
        keys.push(monthKey(cursor));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
}
/** Every row whose time falls inside the range, oldest first. */
export function readUsage(dataDir, range) {
    const rows = [];
    const from = range.from.getTime();
    const to = range.to.getTime();
    for (const key of monthsBetween(range.from, range.to)) {
        let text;
        try {
            text = readFileSync(join(dataDir, DIR, `${key}.jsonl`), "utf8");
        }
        catch {
            continue;
        }
        for (const line of text.split("\n")) {
            if (!line)
                continue;
            try {
                const value = JSON.parse(line);
                if (!isUsageRow(value))
                    continue;
                const at = Date.parse(value.at);
                if (at >= from && at <= to)
                    rows.push(value);
            }
            catch {
                /* a line torn mid-write: skip the fragment, keep the rest */
            }
        }
    }
    return rows;
}
/** A date range from query strings: `YYYY-MM-DD` each, `to` inclusive to
 * the end of its day (UTC). Defaults to the current month to date. Null
 * for anything malformed, reversed, or longer than a year. */
export function parseUsageRange(from, to, now = new Date()) {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/;
    const parse = (value, endOfDay) => {
        const match = day.exec(value);
        if (!match)
            return null;
        const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
        // Reject 2026-02-31 style rollovers.
        return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null;
    };
    const start = from ? parse(from, false) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = to ? parse(to, true) : now;
    if (!start || !end || start.getTime() > end.getTime())
        return null;
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS)
        return null;
    return { from: start, to: end };
}
/** A stable key and a display label for who asked. Labels for the
 * non-person kinds are English fallbacks; the app localizes by key. */
export function triggerKey(trigger) {
    switch (trigger.kind) {
        case "user":
            return `user:${(trigger.email ?? trigger.label ?? "").toLowerCase() || "unknown"}`;
        case "owner":
            return "owner";
        case "routine":
            return `routine:${trigger.routineId ?? trigger.label ?? "unknown"}`;
        default:
            return "bot";
    }
}
export function triggerLabel(trigger) {
    switch (trigger.kind) {
        case "user":
            return trigger.email ?? trigger.label ?? "Signed-in user";
        case "owner":
            return "This computer";
        case "routine":
            return `Routine: ${trigger.label ?? trigger.routineId ?? "unknown"}`;
        default:
            return "Bot to bot";
    }
}
function groupOf(row, groupBy) {
    switch (groupBy) {
        case "bot":
            return { key: `bot:${row.botId}`, label: row.botName || row.botId };
        case "model":
            return { key: `model:${row.driverKind}/${row.model}`, label: row.model };
        case "user":
            return { key: triggerKey(row.trigger), label: triggerLabel(row.trigger) };
        case "day":
            return { key: `day:${row.at.slice(0, 10)}`, label: row.at.slice(0, 10) };
        case "routine":
            // Turns a routine started are grouped by routine; everything else
            // (people, the owner, other bots) shares one "manual" bucket.
            return row.trigger.kind === "routine"
                ? { key: triggerKey(row.trigger), label: row.trigger.label ?? row.trigger.routineId ?? "unknown" }
                : { key: "manual", label: "Not from a routine" };
        default:
            return { key: `engine:${row.driverKind}`, label: row.driverKind };
    }
}
function emptyGroup(key, label) {
    return { key, label, turns: 0, input: 0, output: 0, cachedInput: 0, costUsd: null, estimatedUsd: null, unpriced: 0, billableUsd: null };
}
/** Where a row's cost came from, for rows old and new; null when it has none. */
export function costSourceOf(row) {
    if (finiteOrNull(row.costUsd) === null)
        return null;
    return row.costSource === "estimated" ? "estimated" : "reported";
}
function add(group, row, prices) {
    group.turns += 1;
    group.input += clean(row.input);
    group.output += clean(row.output);
    group.cachedInput += clean(row.cachedInput);
    const cost = finiteOrNull(row.costUsd);
    if (cost === null)
        group.unpriced += 1;
    else {
        group.costUsd = (group.costUsd ?? 0) + cost;
        if (costSourceOf(row) === "estimated")
            group.estimatedUsd = (group.estimatedUsd ?? 0) + cost;
    }
    const billable = prices ? billableFor(row, prices) : null;
    if (billable !== null)
        group.billableUsd = (group.billableUsd ?? 0) + billable;
}
/** Totals per group, money first then volume; days stay chronological. */
export function summarizeUsage(rows, groupBy, prices = null) {
    const groups = new Map();
    const total = emptyGroup("total", "total");
    for (const row of rows) {
        const { key, label } = groupOf(row, groupBy);
        let group = groups.get(key);
        if (!group) {
            group = emptyGroup(key, label);
            groups.set(key, group);
        }
        add(group, row, prices);
        add(total, row, prices);
    }
    const ordered = [...groups.values()];
    if (groupBy === "day")
        ordered.sort((a, b) => a.key.localeCompare(b.key));
    else {
        ordered.sort((a, b) => {
            const costA = a.costUsd ?? Number.NEGATIVE_INFINITY;
            const costB = b.costUsd ?? Number.NEGATIVE_INFINITY;
            return costB - costA || b.input + b.output - (a.input + a.output);
        });
    }
    return { groups: ordered, total };
}
export function csvCell(value) {
    if (value === null)
        return "";
    const text = String(value);
    // A leading formula character is neutralised so a spreadsheet never
    // executes a bot name or an email address.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
/** One line per turn, spreadsheet-ready; a billable column when a price list is given. */
export function usageCsv(rows, prices = null) {
    const header = ["time", "bot", "model", "engine", "triggered_by", "input_tokens", "output_tokens", "cached_input_tokens", "cost_usd", "cost_source", ...(prices ? ["billable_usd"] : []), "thread"];
    const lines = [header.join(",")];
    for (const row of rows) {
        lines.push([
            row.at,
            row.botName || row.botId,
            row.model,
            row.driverKind,
            triggerLabel(row.trigger),
            clean(row.input),
            clean(row.output),
            clean(row.cachedInput),
            finiteOrNull(row.costUsd),
            costSourceOf(row),
            ...(prices ? [billableFor(row, prices)] : []),
            row.threadId,
        ].map(csvCell).join(","));
    }
    return lines.join("\n") + "\n";
}
