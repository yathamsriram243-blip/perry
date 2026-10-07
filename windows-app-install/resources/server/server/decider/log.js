// The decision model's own log: one row per call that reached a backend,
// one file per UTC month under <data>/decider-log/YYYY-MM.ndjson.
//
// Not the authorization decision log (server/decision-log.ts, <data>/
// decisions/), which records approvals. This one records what a fast
// classifier picked and how sure it was, so its accuracy and cost can be
// measured later. A row never holds the message text, the options' text or
// the key: only the seam, the chosen option key (a bot id for room routing),
// the probabilities and a short hash of the state.
//
// Same discipline as the other logs: 0600, fire-and-forget, serialized per
// directory, and months older than the shared retention window pruned.
import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { boundRetentionDays, pruneMonthFiles } from "../decision-log.js";
import { monthKey } from "../usage-ledger.js";
export const DECIDER_LOG_DIR = "decider-log";
const PRUNE_EVERY_MS = 60 * 60_000;
const writeQueues = new Map();
const lastPrune = new Map();
export function stateHash(state) {
    let text;
    try {
        text = JSON.stringify(state) ?? "";
    }
    catch {
        text = "";
    }
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
export function deciderLogFileFor(dataDir, at) {
    return join(dataDir, DECIDER_LOG_DIR, `${monthKey(at)}.ndjson`);
}
async function write(dataDir, row) {
    const at = new Date(row.at);
    await mkdir(join(dataDir, DECIDER_LOG_DIR), { recursive: true, mode: 0o700 });
    await appendFile(deciderLogFileFor(dataDir, at), JSON.stringify(row) + "\n", { mode: 0o600 });
    if (at.getTime() - (lastPrune.get(dataDir) ?? 0) >= PRUNE_EVERY_MS) {
        lastPrune.set(dataDir, at.getTime());
        await pruneMonthFiles(join(dataDir, DECIDER_LOG_DIR), boundRetentionDays(), at);
    }
}
/** Append one row. Never throws and never waits: a full disk must not turn
 * into a slower or failed room turn. */
export function appendDeciderLog(dataDir, row) {
    const previous = writeQueues.get(dataDir) ?? Promise.resolve();
    const queued = previous.then(() => write(dataDir, row)).catch(() => {
        /* logging must never take down a decision */
    });
    writeQueues.set(dataDir, queued);
    void queued.finally(() => {
        if (writeQueues.get(dataDir) === queued)
            writeQueues.delete(dataDir);
    });
}
/** Test seam: wait until every queued row for this directory is on disk. */
export async function flushDeciderLog(dataDir) {
    await writeQueues.get(dataDir);
}
