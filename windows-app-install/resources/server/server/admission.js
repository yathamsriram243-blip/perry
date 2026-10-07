// One admission decision for every surface that starts, steers, or parks
// work. Each seam used to hand-roll its own busy policy; they agreed by
// convention and drifted by accident. This module is the frozen record of
// what each surface does today (M1): same inputs, same outputs, one place.
//
// Purity is the contract: no IO, no store reads, no adapter calls. Callers
// gather state, call admit(), and apply the returned decision with their own
// side effects. Anything that can settle a turn (an awaited steer, a slow
// disk) belongs to the caller, which re-reads state and asks again.
// ── L2: ordering and batching on drain ─────────────────────────────────
// M2's drain rule: a sender's CONTIGUOUS burst inside a short window is one
// item; senders never merge, and a pause past the window reads as separate
// messages. The window is measured between consecutive queued items, so a
// rolling burst stays whole while hours-apart texts split.
/** How late one queued text may follow the previous one and still join the
 * same drained turn. Two minutes covers a person typing a burst in pieces;
 * anything slower is already a separate thought, not a continuation. */
export const DRAIN_COALESCE_WINDOW_MS = 120_000;
/** The most items one drained head group may carry. Room turns read the
 * transcript through the room-context window (its last N messages), so a
 * group larger than that window would append lines the responder never
 * sees; the excess stays queued and drains with the next turn instead.
 * The 1:1 drain carries every group item in its prompt directly, so it
 * passes no cap. */
export const DRAIN_COALESCE_MAX_ITEMS = 30;
/** The leading run of queued items that drain together: consecutive items
 * with the same merge identity, each arriving within the coalescing window
 * of the one before it. Pure and shape-agnostic — each queue supplies its
 * own identity (sender + provenance kind) and timestamp accessors, and the
 * first item always drains, so an empty identity never strands a queue.
 * `maxItems`, when given, stops the group before it outgrows a bound the
 * consuming turn can actually carry. */
export function drainCoalesceHead(items, identityOf, queuedAtOf, maxItems) {
    const head = [];
    let previousIdentity;
    let previousAt;
    for (const item of items) {
        if (maxItems !== undefined && head.length >= maxItems)
            break;
        const identity = identityOf(item);
        const at = queuedAtOf(item);
        // The gap must be non-negative AND inside the window: a regressed
        // timestamp (clock skew, a rewritten row) is not "within the window".
        const gap = at - (previousAt ?? at);
        if (head.length === 0 || (identity === previousIdentity && gap >= 0 && gap <= DRAIN_COALESCE_WINDOW_MS)) {
            head.push(item);
        }
        else {
            break;
        }
        previousIdentity = identity;
        previousAt = at;
    }
    return head;
}
/** The shared admission decision. Pure: same surface, message, and state
 * always return the same decision, with no side effects. */
export function admit(surface, message = {}, state = {}) {
    switch (surface) {
        case "direct-busy": {
            // Steer-first for plain text into a capable engine; every mechanical
            // clamp (attachments, a pending surface choice, an incapable engine)
            // parks the words for the next ordinary turn instead.
            const steerable = !message.carriesImages && !message.pendingComputerSelection && message.engineCanSteer === true;
            return steerable ? { action: "steer" } : { action: "queue" };
        }
        case "direct": {
            if (state.atCapacity || state.threadBusy || state.groupTurn || state.parksBehindCoordination) {
                // Capacity outranks a room turn in the receipt because the person
                // can fix it (finish a thread); coordination parking is reasonless.
                const reason = state.atCapacity ? "capacity" : state.groupTurn ? "group-turn" : undefined;
                return { action: "queue", reason };
            }
            return { action: "start" };
        }
        case "room":
            // Room sends never auto-steer; the queue is the policy. Human override
            // is the head-only manual steer below.
            return state.roomWorking ? { action: "queue" } : { action: "start" };
        case "room-steer": {
            if (!message.speakerPresent || message.engineCanSteer !== true) {
                // An incapable room keeps its queue, exactly like an incapable 1:1
                // engine; the request succeeds without delivering.
                return { action: "queue" };
            }
            if (!message.isQueueHead) {
                return { action: "refuse", code: "queue-head-only" };
            }
            return { action: "steer" };
        }
        case "guarded": {
            // A guarded send is an external contract: never queued, never steered,
            // never started under stale permissions. Any busy shape refuses.
            if (state.botBusy || state.threadBusy || state.atCapacity || state.parksBehindCoordination || state.groupTurn) {
                return { action: "refuse", code: "guarded_busy" };
            }
            return { action: "start" };
        }
        case "unattended": {
            // Routines and webhooks share startTurn's admission; busy means a
            // missed or failed run, not a queue — their receipts are the
            // monitoring feature.
            if (state.botPresent === false)
                return { action: "refuse", code: "missing" };
            if (state.atCapacity || state.groupTurn)
                return { action: "refuse", code: "busy" };
            return { action: "start" };
        }
        case "peer": {
            // Exactly what startTurn admits for a direct thread: the landing
            // thread free, a free slot, no live room turn. Never the whole-bot
            // busy flag.
            if (state.threadBusy || state.atCapacity || state.groupTurn)
                return { action: "refuse", code: "busy" };
            return { action: "start" };
        }
        case "opened-thread": {
            // A self-opened thread is brand new: its own busy flag is impossible,
            // so only a full slot list or a live room turn can park it. Provenance
            // (peerAsk, unattended) survives the wait in the queue payload.
            if (state.atCapacity || state.groupTurn) {
                return { action: "queue", reason: state.atCapacity ? "capacity" : "group-turn" };
            }
            return { action: "start" };
        }
    }
}
