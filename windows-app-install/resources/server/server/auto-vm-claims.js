/** Lazy exclusive claims for auto-resolved Local VM attaches (issue #1361).
 * The table is keyed by thread and owned by the dispatch generation; the
 * claim closure itself lives in index.ts next to the turn state it needs.
 * Kept free of index.ts imports so the fire-once semantics stay unit-testable. */
/** Fire a thread's lazy claim exactly once, fenced by the dispatch
 * generation. A rejected claim KEEPS the slot and marks it failed: the
 * computer-control gate then keeps answering held for that generation, so
 * the bridge refuses every later screen call instead of forwarding it onto
 * a VM this turn never claimed. `begin` staying set means the claim never
 * re-fires; turn settle (releaseTurnResources / releaseLocalVmThread in
 * index.ts) clears the slot, fenced by owner generation. A rejection
 * mutates only the slot it fired from, so a stale claim can never remove
 * or mark a newer generation's slot on the same thread. */
export function startAutoVmClaim(table, threadId, generation) {
    const slot = table.get(threadId);
    if (!slot || slot.owner.threadId !== threadId || slot.owner.generation !== generation || slot.begin)
        return;
    slot.begin = slot.claim().then(() => { slot.claimed = true; }, (error) => {
        slot.failed = true;
        slot.failure = error instanceof Error ? error.message : String(error);
        slot.onRejected?.(slot.failure);
    });
}
