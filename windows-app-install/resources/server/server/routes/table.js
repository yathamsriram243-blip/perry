/** "Not my route": the next handler, then index.ts's inline routes, get a turn. */
export const PASS = Symbol("route.pass");
import { perryModesRoute } from "./perry-modes.js";
export const ROUTES = [perryModesRoute];
/** Runs handlers in order until one answers; true means stop routing. A
 * handler that wrote a response but returned PASS by mistake still counts as
 * answered, so the request can never reach a second handler. */
export async function dispatchRoutes(routes, ctx) {
    for (const route of routes) {
        const out = await route(ctx);
        if (out !== PASS || ctx.res.headersSent || ctx.res.writableEnded)
            return true;
    }
    return false;
}
