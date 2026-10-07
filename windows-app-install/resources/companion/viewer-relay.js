import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
const VIEWER_PATH = /^\/vps-viewer\/([A-Za-z0-9_-]{32})(\/.*)?$/;
/** Both joins hand back a loopback noVNC address: a VPS through its SSH
 * tunnel, and the Local VM's own published port. */
const BOT_JOIN_PATH = /^\/api\/bots\/([\w-]+)\/(computer|local-computer)\/join$/;
const CONTROL_LEASE = /^[A-Za-z0-9_-]{16,120}$/;
const CONTROL_CHECK_MS = 3_000;
const SESSION_TTL_MS = 8 * 60 * 60_000;
const MAX_SESSIONS = 64;
function safeLoopbackViewer(raw) {
    if (typeof raw !== "string")
        return null;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        return null;
    }
    const port = Number(url.port);
    if (url.protocol !== "http:"
        || url.hostname !== "127.0.0.1"
        || url.username
        || url.password
        || url.pathname !== "/vnc.html"
        || url.search
        || !Number.isSafeInteger(port)
        || port < 1024
        || port > 65_535) {
        return null;
    }
    return url;
}
function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        "cache-control": "private, no-store",
        "content-length": Buffer.byteLength(text),
        "content-type": "application/json",
    });
    res.end(text);
}
function socketError(socket, status, message) {
    if (socket.destroyed)
        return;
    const body = JSON.stringify({ error: message });
    socket.end(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Not Found"}\r\n`
        + "Connection: close\r\n"
        + "Content-Type: application/json\r\n"
        + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
function websocketHeaders(req) {
    if (req.method !== "GET" || String(req.headers.upgrade ?? "").toLowerCase() !== "websocket")
        return null;
    const headers = { connection: "Upgrade", upgrade: "websocket" };
    for (const name of [
        "sec-websocket-key",
        "sec-websocket-version",
        "sec-websocket-protocol",
        "sec-websocket-extensions",
    ]) {
        const value = req.headers[name];
        if (typeof value === "string")
            headers[name] = value;
    }
    return headers;
}
function acceptUpgrade(socket, response) {
    const headers = [];
    for (const name of [
        "upgrade",
        "connection",
        "sec-websocket-accept",
        "sec-websocket-protocol",
        "sec-websocket-extensions",
    ]) {
        const value = response.headers[name];
        if (typeof value === "string")
            headers.push(`${name}: ${value}`);
    }
    socket.write(`HTTP/1.1 ${response.statusCode ?? 101} ${response.statusMessage ?? "Switching Protocols"}\r\n`
        + `${headers.join("\r\n")}\r\n\r\n`);
}
export class CompanionViewerRelay {
    #sessions = new Map();
    #checkControl;
    #checkMs;
    constructor(options = {}) {
        this.#checkControl = options.checkControl;
        this.#checkMs = options.checkIntervalMs ?? CONTROL_CHECK_MS;
    }
    #prune() {
        const now = Date.now();
        for (const session of this.#sessions.values()) {
            if (session.expiresAt <= now)
                this.#remove(session);
        }
        while (this.#sessions.size >= MAX_SESSIONS) {
            const oldest = this.#sessions.values().next().value;
            if (!oldest)
                break;
            this.#remove(oldest);
        }
    }
    #remove(session) {
        if (session.watch)
            clearInterval(session.watch);
        this.#sessions.delete(session.id);
        for (const socket of session.sockets)
            socket.destroy();
        session.sockets.clear();
    }
    #isActive(session) {
        return this.#sessions.get(session.id) === session;
    }
    close(deviceId, botId) {
        for (const session of this.#sessions.values()) {
            if (session.deviceId === deviceId && session.botId === botId)
                this.#remove(session);
        }
    }
    closeDevice(deviceId) {
        for (const session of this.#sessions.values()) {
            if (session.deviceId === deviceId)
                this.#remove(session);
        }
    }
    rewriteJoinResponse(path, value, deviceId, controlLeaseId) {
        const join = BOT_JOIN_PATH.exec(path);
        const botId = join?.[1];
        if (!botId || !value || typeof value !== "object" || Array.isArray(value))
            return value;
        const body = value;
        const viewer = safeLoopbackViewer(body.joinUrl);
        if (!viewer)
            return value;
        if (!deviceId)
            throw new Error("the paired device has no viewer identity");
        // A Local VM viewer is bound to the control lease that asked for it, and
        // is closed the moment that lease stops holding the computer. Without a
        // lease, or nothing to check it with, it is never handed out at all.
        const localVm = join[2] === "local-computer";
        if (localVm && (!controlLeaseId || !CONTROL_LEASE.test(controlLeaseId) || !this.#checkControl)) {
            throw new Error("a Local VM viewer needs a control lease");
        }
        this.#prune();
        this.close(deviceId, botId);
        const id = randomBytes(24).toString("base64url");
        const session = {
            id,
            botId,
            deviceId,
            origin: viewer.origin,
            expiresAt: Date.now() + SESSION_TTL_MS,
            sockets: new Set(),
        };
        this.#sessions.set(id, session);
        if (localVm) {
            const check = this.#checkControl;
            const lease = controlLeaseId;
            let checking = false;
            session.watch = setInterval(() => {
                if (checking)
                    return;
                checking = true;
                check(deviceId, botId, lease)
                    .catch(() => false)
                    .then((owned) => {
                    checking = false;
                    if (!owned && this.#isActive(session))
                        this.#remove(session);
                });
            }, this.#checkMs);
            session.watch.unref?.();
        }
        const settings = new URLSearchParams(viewer.hash.slice(1));
        settings.set("path", `vps-viewer/${id}/websockify`);
        return {
            ...body,
            joinUrl: `/vps-viewer/${id}${viewer.pathname}#${settings.toString()}`,
        };
    }
    #target(rawUrl, device) {
        this.#prune();
        if (!device?.id || !device.cloudDesktopAccess)
            return null;
        const incoming = new URL(rawUrl ?? "/", "http://companion.invalid");
        const match = VIEWER_PATH.exec(incoming.pathname);
        if (!match)
            return null;
        const session = this.#sessions.get(match[1]);
        if (!session || session.deviceId !== device.id || session.expiresAt <= Date.now())
            return null;
        const suffix = match[2] || "/";
        const target = new URL(`${suffix}${incoming.search}`, session.origin);
        if (target.origin !== session.origin)
            return null;
        session.expiresAt = Date.now() + SESSION_TTL_MS;
        return { session, target };
    }
    isViewerPath(rawUrl) {
        const pathname = new URL(rawUrl ?? "/", "http://companion.invalid").pathname;
        return pathname.startsWith("/vps-viewer/");
    }
    handleHttp(req, res, device) {
        const resolved = this.#target(req.url, device);
        if (!device)
            return sendJson(res, 401, { error: "pair this device first" });
        if (!device.cloudDesktopAccess)
            return sendJson(res, 403, { error: "cloud desktop access is off for this device" });
        if (!resolved || req.method !== "GET")
            return sendJson(res, 404, { error: "viewer session not found" });
        const headers = { accept: String(req.headers.accept ?? "*/*") };
        for (const name of ["range", "if-none-match", "if-modified-since"]) {
            const value = req.headers[name];
            if (typeof value === "string")
                headers[name] = value;
        }
        const upstream = httpRequest(resolved.target, { method: "GET", headers }, (remote) => {
            upstream.setTimeout(0);
            const responseHeaders = {
                "cache-control": "private, no-store",
            };
            for (const name of [
                "content-type",
                "content-length",
                "content-encoding",
                "content-range",
                "accept-ranges",
                "etag",
                "last-modified",
            ]) {
                const value = remote.headers[name];
                if (value !== undefined)
                    responseHeaders[name] = value;
            }
            res.writeHead(remote.statusCode ?? 502, responseHeaders);
            remote.once("error", () => res.destroy());
            remote.pipe(res);
        });
        upstream.setTimeout(30_000, () => upstream.destroy(new Error("viewer did not answer")));
        upstream.once("error", () => {
            if (res.headersSent)
                res.destroy();
            else
                sendJson(res, 502, { error: "the VPS viewer did not answer" });
        });
        res.once("close", () => upstream.destroy());
        upstream.end();
    }
    handleUpgrade(req, socket, head, device) {
        if (!device)
            return socketError(socket, 401, "pair this device first");
        if (!device.cloudDesktopAccess)
            return socketError(socket, 403, "cloud desktop access is off for this device");
        const resolved = this.#target(req.url, device);
        const headers = websocketHeaders(req);
        if (!resolved || !headers)
            return socketError(socket, 404, "viewer session not found");
        const upstream = httpRequest(resolved.target, { method: "GET", headers });
        resolved.session.sockets.add(socket);
        resolved.session.sockets.add(upstream);
        socket.once("close", () => resolved.session.sockets.delete(socket));
        upstream.once("close", () => resolved.session.sockets.delete(upstream));
        upstream.setTimeout(30_000, () => upstream.destroy(new Error("viewer upgrade timed out")));
        upstream.once("upgrade", (response, remote, remoteHead) => {
            upstream.setTimeout(0);
            remote.setTimeout(0);
            if (!this.#isActive(resolved.session) || socket.destroyed) {
                remote.destroy();
                socket.destroy();
                return;
            }
            resolved.session.sockets.delete(upstream);
            acceptUpgrade(socket, response);
            resolved.session.sockets.add(remote);
            const release = () => {
                resolved.session.sockets.delete(socket);
                resolved.session.sockets.delete(remote);
            };
            socket.once("close", release);
            remote.once("close", release);
            if (head.length)
                remote.write(head);
            if (remoteHead.length)
                socket.write(remoteHead);
            socket.pipe(remote).pipe(socket);
        });
        upstream.once("response", (response) => {
            response.resume();
            socketError(socket, 404, "viewer WebSocket was refused");
        });
        upstream.once("error", () => socket.destroy());
        socket.once("close", () => upstream.destroy());
        upstream.end();
    }
}
