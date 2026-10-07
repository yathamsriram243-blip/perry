import { captureOutsideHumanControl } from "./private-screen-capture.js";
/** One serialized preview source. A cached or in-flight desktop frame must
 * never become the browser's settled picture after the bot switches surfaces. */
export function createScreenFrameSource(input) {
    let current = null;
    let lastAt = 0;
    let attemptedSurface;
    let last = null;
    let lastSurface;
    const selectedSurface = () => input.captures[source.surface]
        ? source.surface
        : input.captures.computer ? "computer" : "browser";
    const source = {
        surface: (input.captures.computer ? "computer" : "browser"),
        get last() {
            return lastSurface === selectedSurface() ? last : null;
        },
        async capture(fresh = false) {
            // Wait for the previous source before selecting the next one. A final
            // capture bypasses the preview throttle, even if a poke just finished.
            while (current)
                await current;
            if (input.control().held)
                return;
            const surface = selectedSurface();
            if (!fresh && attemptedSurface === surface && Date.now() - lastAt < input.minGapMs)
                return;
            attemptedSurface = surface;
            current = (async () => {
                try {
                    const capture = input.captures[surface];
                    if (!capture)
                        return;
                    const frame = await captureOutsideHumanControl(input.control, capture);
                    if (!frame || surface !== selectedSurface())
                        return;
                    last = frame;
                    lastSurface = surface;
                    input.onFrame(frame);
                }
                catch {
                    // A sleeping or mid-command surface is retried by the next tick.
                }
                finally {
                    lastAt = Date.now();
                }
            })();
            try {
                await current;
            }
            finally {
                current = null;
            }
        },
    };
    return source;
}
