import { modelContextWindow } from "./model-context-window.js";
export const DEFAULT_CONTEXT_WINDOW = 128_000;
const positive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
export function contextWindowFor(model, catalog, reported) {
    if (positive(reported))
        return reported;
    const declared = catalog?.options.find((option) => option.id === model)?.contextWindow;
    if (positive(declared))
        return declared;
    const inferred = model ? modelContextWindow(model) : undefined;
    return positive(inferred) ? inferred : DEFAULT_CONTEXT_WINDOW;
}
/** Leave headroom even for a small local model. An 8k lower bound would
 * make compaction unreachable on models whose entire window is 8k. */
export function compactBudget(window, compactAt, nativeCompactAt) {
    if (!positive(window))
        throw new Error("invalid model context window");
    const configured = positive(compactAt) ? (compactAt < 1 ? window * compactAt : compactAt) : window * 0.8;
    return Math.max(1, Math.floor(Math.min(configured, window * 0.9, positive(nativeCompactAt) ? nativeCompactAt * 0.9 : Infinity)));
}
export function shouldCompact(input) {
    // Summed input across tool rounds is NOT a context-window measurement.
    const size = positive(input.contextTokens) ? input.contextTokens : Math.ceil(input.estimatedBytes / 4);
    // Regrowth avoids repeatedly folding an irreducible prompt, but cannot
    // delay the harness beyond a known provider-native compaction boundary.
    const ceiling = compactBudget(input.window, input.window, input.nativeCompactAt);
    const threshold = Math.min(ceiling, positive(input.floor) ? Math.max(input.budget, input.floor * 1.25) : input.budget);
    return size >= threshold;
}
