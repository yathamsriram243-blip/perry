export class TurnWatchdog {
    turns = new Map();
    timer = null;
    opts;
    // a plain field assignment, not a parameter property — the server runs
    // under Node's type-stripping, which cannot transform the latter
    constructor(opts) {
        this.opts = opts;
    }
    now() {
        return this.opts.now?.() ?? Date.now();
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => this.sweep(), this.opts.checkMs);
        // never hold the process open just to watch for stalls
        this.timer.unref?.();
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
        this.turns.clear();
    }
    /** A turn was admitted on this thread. */
    watch(threadId, botId) {
        const at = this.now();
        this.turns.set(threadId, { threadId, botId, startedAt: at, lastEventAt: at, waitingOnHuman: false, waitingOnComputer: false });
    }
    /** Any provider event for the thread proves the turn is alive. */
    touch(threadId) {
        const turn = this.turns.get(threadId);
        if (turn)
            turn.lastEventAt = this.now();
    }
    /** request.opened → true (a human is deciding; not a stall however long
     * they take); request.resolved → false (the clock restarts). */
    setWaitingOnHuman(threadId, waiting) {
        const turn = this.turns.get(threadId);
        if (!turn)
            return;
        turn.waitingOnHuman = waiting;
        turn.lastEventAt = this.now();
    }
    /** Shared-computer waits have their own bounded deadline. Waiting for
     * another turn to release the computer is not a silent provider stall. */
    setWaitingOnComputer(threadId, waiting) {
        const turn = this.turns.get(threadId);
        if (!turn)
            return;
        turn.waitingOnComputer = waiting;
        turn.lastEventAt = this.now();
    }
    /** The turn settled normally — stop watching it. */
    settle(threadId) {
        this.turns.delete(threadId);
    }
    watching(threadId) {
        return this.turns.has(threadId);
    }
    /** Visible for tests; the interval calls this. */
    sweep() {
        const at = this.now();
        for (const turn of this.turns.values()) {
            if (turn.waitingOnHuman || turn.waitingOnComputer)
                continue;
            if (at - turn.lastEventAt < this.opts.stallMs)
                continue;
            this.turns.delete(turn.threadId);
            this.opts.onStall(turn);
        }
    }
}
