// The proxy-side half of computer control. The harness keeps the record of
// who is driving (server/computer-control.ts); the per-turn computer
// processes consult it through this client before acting, because the
// action paths themselves never traverse the harness — a boat click goes
// straight to the boat's REST API, and a Local VM / VPS click rides a
// transparent stdio bridge into Cua Driver.
//
// Failure posture: CLOSED once configured. A missing/expired turn capability
// must never be interpreted as "the person released control": that would let
// a stale computer proxy resume acting underneath them. An unconfigured
// client remains disengaged because there is no control surface to consult.
//
// The state is cached briefly so a computer_batch of two dozen actions
// doesn't turn into two dozen loopback round trips.
const DISENGAGED = { held: false, helpOpen: false };
const UNAVAILABLE = { held: true, helpOpen: false };
export function createControlClient(options) {
    const url = options?.url ?? process.env.OMB_CONTROL_URL ?? "";
    const token = options?.token ?? process.env.OMB_CONTROL_TOKEN ?? "";
    const cacheMs = options?.cacheMs ?? 750;
    const fetchImpl = options?.fetchImpl ?? fetch;
    const configured = Boolean(url && token);
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    let cachedAt = 0;
    let cached = DISENGAGED;
    async function read() {
        try {
            const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(2_000) });
            if (!res.ok)
                return UNAVAILABLE;
            const body = await res.json().catch(() => null);
            if (typeof body?.held !== "boolean" || typeof body?.helpOpen !== "boolean")
                return UNAVAILABLE;
            return {
                held: body.held,
                helpOpen: body.helpOpen,
                ...(typeof body.blockedReason === "string" && body.blockedReason.trim() ? { blockedReason: body.blockedReason } : {}),
            };
        }
        catch {
            return UNAVAILABLE;
        }
    }
    return {
        configured,
        async state(fresh = false) {
            if (!configured)
                return DISENGAGED;
            const now = Date.now();
            if (!fresh && now - cachedAt < cacheMs)
                return cached;
            cached = await read();
            cachedAt = Date.now();
            return cached;
        },
        async requestHelp(reason) {
            if (!configured)
                return null;
            try {
                const res = await fetchImpl(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ reason }),
                    signal: AbortSignal.timeout(2_000),
                });
                if (!res.ok)
                    return null;
                const body = await res.json().catch(() => null);
                return typeof body?.requestId === "string" && body.requestId ? body.requestId : null;
            }
            catch {
                return null;
            }
        },
        async expireHelp(requestId) {
            if (!configured || !requestId)
                return;
            try {
                await fetchImpl(url, {
                    method: "DELETE",
                    headers,
                    body: JSON.stringify({ requestId }),
                    signal: AbortSignal.timeout(2_000),
                });
            }
            catch {
                // Best effort: the harness also clears the in-memory request on
                // release/restart, and an unavailable harness cannot show the card.
            }
        },
    };
}
/** The one sentence every refused computer action gets, on every computer.
 * Deliberately does not vary per tool: the model needs the same three facts
 * every time — nothing happened, don't retry blindly, and wait for the
 * person. */
export const CONTROL_REFUSAL_PLAIN = "A person has taken control of this computer, so this call was NOT performed. " +
    "Do not retry it — the screen is changing under their hands. " +
    "Pause this task, tell the person you are waiting for them to hand control back, " +
    "and take a fresh screenshot before your next action once they have.";
