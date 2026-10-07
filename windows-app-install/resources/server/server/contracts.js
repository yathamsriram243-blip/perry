// Canonical harness contracts — ported from upstream
// (apps/server/src/provider/ProviderDriver.ts, Services/ProviderAdapter.ts,
// packages/contracts/src/{provider,providerInstance,providerRuntime}.ts),
// de-Effect-ed: Promises instead of Effect, listener callbacks instead of
// Stream. The shapes and names are kept so the two codebases stay mutually
// readable.
export class ProviderError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "ProviderError";
        this.code = code;
    }
}
/** The driver proved this attempt never reached a prompt or client-side action,
 * and its owned process has stopped. The harness may safely recover it. */
export class TurnNotStartedError extends Error {
    turnId;
    constructor(turnId, message) {
        super(message);
        this.name = "TurnNotStartedError";
        this.turnId = turnId;
    }
}
/** Variants are opaque provider IDs, not the cross-engine effort enum. */
export function isModelVariant(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 256 &&
        value.trim() === value && !/\p{Cc}/u.test(value);
}
/** The picker label for a model id when the catalog row carries no display
 * name: split on the word breaks the catalog treats as separators and
 * capitalize each part ("gpt-5.4-mini" → "Gpt 5.4 Mini"). Each harness
 * passes its own break class so existing labels stay byte-for-byte. */
export function titleCaseModelId(id, wordBreaks) {
    return id
        .split(wordBreaks)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
/** A picker label that carries a second facet — a display name, a provider
 * host — beside the model id, unless the facet is already what the id says.
 * `redundantWhen` decides what counts as "already said" and `decorate` how
 * the facet is appended, so every harness's labels stay exactly what they
 * were while the shape is written once. */
export function qualifiedModelLabel(id, qualifier, options = {}) {
    const { redundantWhen = () => false, decorate = (facet) => ` — ${facet}` } = options;
    if (!qualifier || redundantWhen(id, qualifier))
        return id;
    return `${id}${decorate(qualifier)}`;
}
let eventCounter = 0;
export const newEventId = () => `ev-${Date.now().toString(36)}-${(eventCounter++).toString(36)}`;
export const newId = () => crypto.randomUUID();
