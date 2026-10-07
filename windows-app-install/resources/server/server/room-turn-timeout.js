export function roomTurnTimeoutMs(minutes) {
    return minutes * 60_000;
}
/**
 * One room turn's slice of the configured room ceiling.
 *
 * Counts work, not wall time: the clock holds while the turn is parked on
 * an approval or question card (request.opened → request.resolved) —
 * waiting on a person is not work, and stopping the turn under an open
 * card manufactures the stranded-approval state the harness otherwise has
 * to repair after the fact. Streaming, tool runs, and provider latency
 * still burn the budget normally; a turn that goes silent entirely is
 * separately caught by the stall watchdog.
 *
 * Requests pair opened→resolved per thread, but resolves can also arrive
 * for cards this turn never opened (stale cleanup after an interrupt), so
 * the count clamps at zero instead of trusting perfect pairing.
 */
export class RoomTurnDeadline {
    remainingMs;
    timer = null;
    openRequests = 0;
    stopped = false;
    fired = false;
    armedAt = 0;
    fire;
    // plain field assignments, not parameter properties — the server runs
    // under Node's type-stripping, which cannot transform the latter
    constructor(minutes, fire) {
        this.remainingMs = roomTurnTimeoutMs(minutes);
        this.fire = fire;
    }
    /** Begin counting down the budget. */
    start() {
        this.arm();
    }
    /** request.opened → true (a person is deciding; hold however long they take),
     * request.resolved → false (the budget resumes where it left off). */
    setWaitingOnHuman(waiting) {
        if (this.stopped || this.fired)
            return;
        if (waiting) {
            const wasIdle = this.openRequests === 0;
            this.openRequests += 1;
            if (wasIdle)
                this.hold();
        }
        else if (this.openRequests > 0) {
            this.openRequests -= 1;
            if (this.openRequests === 0)
                this.arm();
        }
    }
    /** The turn settled — cancel whatever remains. Idempotent. */
    stop() {
        this.stopped = true;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    hold() {
        if (this.timer === null)
            return;
        this.remainingMs -= Date.now() - this.armedAt;
        clearTimeout(this.timer);
        this.timer = null;
        // A delayed event loop can deliver the card event after the deadline
        // already passed; a person's wait must not extend an exhausted budget.
        if (this.remainingMs <= 0)
            this.expired();
    }
    arm() {
        if (this.stopped || this.fired || this.openRequests > 0)
            return;
        if (this.remainingMs <= 0) {
            this.expired();
            return;
        }
        this.armedAt = Date.now();
        this.timer = setTimeout(() => {
            this.timer = null;
            this.expired();
        }, this.remainingMs);
    }
    expired() {
        if (this.stopped || this.fired)
            return;
        this.fired = true;
        this.fire();
    }
}
/** Completes the active room turn when its activity watchdog stalls. */
export class RoomTurnStallRegistry {
    handlers = new Map();
    register(threadId, handler) {
        this.handlers.set(threadId, handler);
        return () => {
            if (this.handlers.get(threadId) === handler)
                this.handlers.delete(threadId);
        };
    }
    stall(threadId) {
        const handler = this.handlers.get(threadId);
        if (!handler)
            return false;
        this.handlers.delete(threadId);
        handler();
        return true;
    }
}
export function roomTurnTimeoutMessage(botName, minutes) {
    const unit = minutes === 1 ? "minute" : "minutes";
    return `${botName}'s room turn exceeded ${minutes} ${unit} and was stopped`;
}
