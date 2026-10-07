/** These admission failures can resume after another thread frees a slot.
 * Keep control flow independent of the user-facing error wording. */
export function isTurnAdmissionBlocked(error) {
    return typeof error === "object" && error !== null && "code" in error &&
        (error.code === "thread_busy" || error.code === "thread_limit");
}
/** Close the Stop-vs-provider-handshake race shared by direct and room turns.
 * An adapter may not publish its active process until sendTurn resolves, so
 * an interrupt during that await can be an honest no-op. Re-check once setup
 * completes and issue a second interrupt only when cancellation won. */
export async function guardTurnDispatch(started, cancelled, stopAfterSetup) {
    const value = await started;
    if (!cancelled())
        return { value, cancelled: false };
    await stopAfterSetup();
    return { value, cancelled: true };
}
/** Bounded tombstones for provider turns cancelled during asynchronous
 * startup. Their late completion/session events must not settle a newer turn
 * that reused the same conversation thread. */
export class RetiredTurnRegistry {
    #turnIds = new Set();
    #limit;
    constructor(limit = 4_096) {
        this.#limit = limit;
    }
    retire(turnId) {
        this.#turnIds.add(turnId);
        while (this.#turnIds.size > this.#limit) {
            const oldest = this.#turnIds.values().next().value;
            if (oldest === undefined)
                break;
            this.#turnIds.delete(oldest);
        }
    }
    has(turnId) {
        return turnId !== undefined && this.#turnIds.has(turnId);
    }
}
/** Correlate an internal capability generation with its provider turn without
 * leaving a bearer alive when a very fast provider completes before
 * sendTurn() returns its id. Completed ids are kept in a bounded tombstone
 * registry, so a late bind fails closed instead of publishing stale ownership. */
export class ProviderTurnGenerationRegistry {
    #owners = new Map();
    #completed;
    #earlyCompletions = new Map();
    #limit;
    constructor(limit = 4_096) {
        this.#completed = new RetiredTurnRegistry(limit);
        this.#limit = limit;
    }
    bind(threadId, generation, turnId) {
        if (this.#completed.has(turnId))
            return false;
        this.#owners.set(turnId, { threadId, generation });
        return true;
    }
    complete(threadId, turnId, outcome) {
        if (this.#completed.has(turnId))
            return null;
        const owner = this.#owners.get(turnId);
        if (owner && owner.threadId !== threadId)
            return null;
        this.#completed.retire(turnId);
        if (!owner) {
            // Only a later ACK for this exact provider id may consume the result.
            // Never attribute an unbound event to the thread's current generation.
            if (outcome !== undefined) {
                this.#earlyCompletions.set(turnId, { threadId, outcome });
                while (this.#earlyCompletions.size > this.#limit) {
                    this.#earlyCompletions.delete(this.#earlyCompletions.keys().next().value);
                }
            }
            return null;
        }
        this.#owners.delete(turnId);
        return owner;
    }
    takeEarlyCompletion(threadId, turnId) {
        const receipt = this.#earlyCompletions.get(turnId);
        if (receipt?.threadId !== threadId)
            return undefined;
        this.#earlyCompletions.delete(turnId);
        return receipt.outcome;
    }
    deleteGeneration(threadId, generation) {
        const removed = [];
        for (const [turnId, owner] of this.#owners) {
            if (owner.threadId === threadId && owner.generation === generation) {
                this.#owners.delete(turnId);
                this.#completed.retire(turnId);
                removed.push(turnId);
            }
        }
        return removed;
    }
    clear() {
        this.#owners.clear();
        this.#earlyCompletions.clear();
    }
}
/** Thread gate for the narrow interval after Stop wins but before an async
 * adapter returns the provider turn id that can be retired. Multiple queued
 * room operations may share a thread, so ownership is reference-counted.
 *
 * A broken adapter is allowed to leave its sendTurn promise pending forever.
 * The gate therefore expires each owner independently: by then any turn id
 * observed during the vulnerable handshake has been moved to the longer-lived
 * RetiredTurnRegistry, while a replacement turn's new id can flow normally. */
export class PendingTurnCancellations {
    #ownersByThread = new Map();
    #clearWaitersByThread = new Map();
    #ttlMs;
    constructor(ttlMs = 30_000) {
        this.#ttlMs = Math.max(1, Math.floor(ttlMs));
    }
    mark(threadId, ownerId) {
        const owners = this.#ownersByThread.get(threadId) ?? new Map();
        const previous = owners.get(ownerId);
        if (previous)
            clearTimeout(previous);
        const expiry = setTimeout(() => {
            // A clear + re-mark may have installed a newer timer for the same
            // owner. The stale callback must not clear that renewed quarantine.
            if (this.#ownersByThread.get(threadId)?.get(ownerId) !== expiry)
                return;
            this.clear(threadId, ownerId);
        }, this.#ttlMs);
        expiry.unref?.();
        owners.set(ownerId, expiry);
        this.#ownersByThread.set(threadId, owners);
    }
    clear(threadId, ownerId) {
        const owners = this.#ownersByThread.get(threadId);
        const expiry = owners?.get(ownerId);
        if (expiry)
            clearTimeout(expiry);
        owners?.delete(ownerId);
        if (owners?.size !== 0)
            return;
        this.#ownersByThread.delete(threadId);
        const waiters = this.#clearWaitersByThread.get(threadId);
        this.#clearWaitersByThread.delete(threadId);
        for (const resolve of waiters ?? [])
            resolve();
    }
    /** Do not overlap a replacement dispatch with the ambiguous pre-id window.
     * Re-check after every wake: a cancellation can be renewed in the same
     * microtask turn that clears an older owner. Each owner has its own bounded
     * expiry, so a broken adapter cannot strand this await forever. */
    async waitForClear(threadId) {
        while (this.has(threadId)) {
            await new Promise((resolve) => {
                const waiters = this.#clearWaitersByThread.get(threadId) ?? new Set();
                waiters.add(resolve);
                this.#clearWaitersByThread.set(threadId, waiters);
                // clear() cannot interleave with this synchronous block, but keeping
                // the second check makes the registration safe if the implementation
                // later gains an externally supplied scheduler.
                if (!this.has(threadId)) {
                    waiters.delete(resolve);
                    if (waiters.size === 0)
                        this.#clearWaitersByThread.delete(threadId);
                    resolve();
                }
            });
        }
    }
    has(threadId) {
        return this.#ownersByThread.has(threadId);
    }
}
/** Apply the two-stage cancellation quarantine. While the unresolved
 * handshake owns the thread, every event is ignored and any stable provider
 * turn id it reveals is retired. After the bounded gate expires, that old id
 * remains ignored but an unrelated replacement id is admitted. */
export function isTurnEventQuarantined(pending, retired, event) {
    if (retired.has(event.turnId))
        return true;
    if (!pending.has(event.threadId))
        return false;
    if (event.turnId)
        retired.retire(event.turnId);
    return true;
}
