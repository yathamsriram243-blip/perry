const jsonHooks = new WeakMap();
const parsedBodies = new WeakMap();
/** Pass every JSON body sent on this response through `hook` first (it may
 * return a narrowed copy). Set once a request is authenticated: index.ts
 * narrows what a member is sent and notes what an admin change answered.
 * Hooks added later run after earlier ones. */
export function onJsonBody(res, hook) {
    const previous = jsonHooks.get(res);
    jsonHooks.set(res, previous ? (body) => hook(previous(body)) : hook);
}
/** The JSON body readBody parsed for this request, if it read one. */
export function parsedBodyOf(req) {
    return parsedBodies.get(req);
}
export function json(res, status, body) {
    const hook = jsonHooks.get(res);
    const data = JSON.stringify(hook ? hook(body) : body);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(data);
}
export function readBody(req, limit = 1_000_000) {
    return new Promise((resolve, reject) => {
        let data = "";
        let bytes = 0;
        let done = false;
        const fail = (status, msg) => {
            if (done)
                return;
            done = true;
            const err = Object.assign(new Error(msg), { status });
            reject(err);
        };
        req.on("data", (c) => {
            if (done)
                return;
            bytes += typeof c === "string" ? Buffer.byteLength(c) : c.length;
            if (bytes > limit) {
                // Keep draining the socket, but stop retaining attacker-controlled
                // bytes. Destroying the request here prevents the caller from
                // receiving the useful 413 response.
                return fail(413, "body too large");
            }
            data += c;
        });
        req.on("end", () => {
            if (done)
                return;
            let body;
            try {
                body = data ? JSON.parse(data) : {};
            }
            catch {
                return fail(400, "invalid JSON body");
            }
            done = true;
            parsedBodies.set(req, body);
            resolve(body);
        });
        req.on("error", (e) => fail(400, e instanceof Error ? e.message : String(e)));
    });
}
