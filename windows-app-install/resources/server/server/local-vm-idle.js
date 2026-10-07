/** Renewable idle deadline for one Local VM.
 *
 * Activity resets the full window. The caller decides how to suspend or
 * recycle the disposable VM, and an active turn or lifecycle operation defers
 * that work for another full window instead of racing current work.
 */
export class LocalVmIdleTimer {
    timer = null;
    lastActivityAt = 0;
    idleMs;
    isBusy;
    suspend;
    constructor(idleMs, isBusy, suspend) {
        this.idleMs = checkedIdleMs(idleMs);
        this.isBusy = isBusy;
        this.suspend = suspend;
    }
    touch() {
        this.lastActivityAt = Date.now();
        this.arm(this.idleMs);
    }
    cancel() {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
    }
    /** Apply a new idle window. A pending deadline is re-armed against the
     * last activity, so a shorter window takes effect without waiting out the
     * old one and a longer window extends the current one. A cancelled timer
     * stays cancelled. */
    setIdleMs(idleMs) {
        this.idleMs = checkedIdleMs(idleMs);
        if (!this.timer)
            return;
        this.arm(Math.max(0, this.lastActivityAt + this.idleMs - Date.now()));
    }
    arm(delayMs) {
        this.cancel();
        this.timer = setTimeout(() => void this.expire(), delayMs);
        this.timer.unref?.();
    }
    async expire() {
        this.timer = null;
        if (this.isBusy()) {
            this.touch();
            return;
        }
        try {
            await this.suspend();
        }
        catch {
            // A transient runtime failure must not disable the cost/resource
            // backstop forever. Retry after a fresh full idle window.
            this.touch();
        }
    }
}
function checkedIdleMs(idleMs) {
    if (!Number.isFinite(idleMs) || idleMs <= 0)
        throw new Error("Local VM idle timeout must be positive");
    return idleMs;
}
