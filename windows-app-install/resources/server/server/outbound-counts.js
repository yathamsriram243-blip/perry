// How many outbound calls each bot has made today. The daily cap in a
// bot's outbound policy is only as good as this number, so it lives on
// disk (0600, like every other record that names what a bot did) and is
// keyed by the local day, so it rolls over at midnight and not at the
// next restart.
//
// One day is kept per bot: the count exists to enforce today's cap, and
// the activity log already keeps the history.
import { readFileSync } from "node:fs";
import { writeFileAtomic } from "./atomic.js";
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export class OutboundCounts {
    file;
    stored;
    readable = true;
    constructor(file) {
        this.file = file;
        this.stored = this.load();
    }
    load() {
        try {
            const value = JSON.parse(readFileSync(this.file, "utf8"));
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error("invalid outbound counts");
            const stored = {};
            for (const [botId, entry] of Object.entries(value)) {
                if (!entry || typeof entry !== "object")
                    throw new Error("invalid outbound count");
                const { day, count } = entry;
                if (typeof day === "string" && typeof count === "number" && Number.isInteger(count) && count >= 0) {
                    stored[botId] = { day, count };
                }
                else
                    throw new Error("invalid outbound count");
            }
            return stored;
        }
        catch (error) {
            if (error.code !== "ENOENT")
                this.readable = false;
            return {};
        }
    }
    save() {
        writeFileAtomic(this.file, JSON.stringify(this.stored, null, 2), { mode: 0o600 });
    }
    /** How many outbound calls this bot has made on the day `now` falls in. */
    today(botId, now = new Date()) {
        if (!this.readable)
            throw new Error("the daily allowance could not be read");
        const entry = this.stored[botId];
        return entry && entry.day === dayKey(now) ? entry.count : 0;
    }
    /** Count one more, and return the new total for the day. */
    record(botId, now = new Date()) {
        return this.reserve(botId, 1, Number.MAX_SAFE_INTEGER, now);
    }
    /** Reserve before any provider await. An uncertain send keeps its slot:
     * refunding transport failures could repeat a send already delivered. */
    reserve(botId, amount, cap, now = new Date()) {
        const day = dayKey(now);
        const entry = this.stored[botId];
        const count = this.today(botId, now) + amount;
        if (count > cap)
            return null;
        this.stored[botId] = { day, count };
        try {
            this.save();
        }
        catch (error) {
            if (entry)
                this.stored[botId] = entry;
            else
                delete this.stored[botId];
            throw error;
        }
        return count;
    }
}
