// Lets a bot hand a finished file to the user as a real chat attachment.
// The source is opened with the same hardened resolver the message-file route
// uses (realpath containment, O_NOFOLLOW, size cap), then copied into the
// private attachment store, so the chat never needs to reach into a bot's
// workspace or VM home afterwards.
import { basename, join, posix } from "node:path";
import { extensionForFileMime, extensionForMime, FILE_MAX_BYTES, IMAGE_MAX_BYTES, saveFile, saveImage, } from "./attachments.js";
import { mimeFor, openMessageFile } from "./message-file.js";
export const ATTACH_SUPPORTED_TYPES = "images (png, jpg, gif, webp), video (mp4, webm, mov), audio (mp3, m4a, aac, wav, ogg, opus, flac), " +
    "pdf, Word/Excel/PowerPoint and OpenDocument files, and csv, tsv, txt, md, json, rtf";
function statusError(status, message) {
    return Object.assign(new Error(message), { status });
}
/** Map a path inside a VM's durable workspace (for example
 * /home/cua/workspace/report.pdf, optionally as a file:// URL) onto the host
 * directory that is bind-mounted there. Anything outside the guest workspace,
 * including `..` escapes, is not a VM path and returns null. */
export function guestWorkspaceToHost(input, guestRoot, hostRoot) {
    let value = input.trim();
    if (/^file:\/\//i.test(value)) {
        try {
            value = decodeURIComponent(new URL(value).pathname);
        }
        catch {
            return null;
        }
    }
    if (!value.startsWith("/"))
        return null;
    const normalized = posix.normalize(value);
    const relative = posix.relative(guestRoot, normalized);
    if (!relative || relative === ".." || relative.startsWith("../") || posix.isAbsolute(relative))
        return null;
    return join(hostRoot, ...relative.split("/"));
}
/** A display name for the chat: the model's suggestion if it gave one, else
 * the file's own name. Directory parts are dropped, never trusted. */
function displayNameFor(requested, fallback) {
    const cleaned = requested?.trim().replace(/\\/g, "/");
    const name = cleaned ? posix.basename(cleaned) : "";
    return name || fallback;
}
export async function saveBotAttachment(input) {
    const requested = input.path.trim();
    if (!requested)
        throw statusError(400, "path is required");
    const guestHost = input.guest ? guestWorkspaceToHost(requested, input.guest.root, input.guest.host) : null;
    // A bot with a VM works in it: a relative path means its VM workspace first.
    const roots = input.guest ? [input.guest.host, ...input.roots] : input.roots;
    const file = await openMessageFile(guestHost ?? requested, roots);
    try {
        const mime = mimeFor(file.name);
        const name = displayNameFor(input.name, file.name);
        if (extensionForMime(mime)) {
            if (file.bytes > IMAGE_MAX_BYTES)
                throw statusError(413, `image exceeds ${IMAGE_MAX_BYTES} bytes`);
            const saved = saveImage(await file.handle.readFile(), mime);
            return { attachment: { kind: "image", path: saved.path, mime: saved.mime }, bytes: saved.bytes };
        }
        if (!extensionForFileMime(mime)) {
            throw statusError(415, `${file.name} is not a supported attachment type. Supported: ${ATTACH_SUPPORTED_TYPES}.`);
        }
        if (file.bytes > FILE_MAX_BYTES)
            throw statusError(413, `file exceeds ${FILE_MAX_BYTES} bytes`);
        const saved = await saveFile(file.handle.createReadStream({ start: 0, autoClose: false }), name || basename(file.name), mime, {
            expectedBytes: file.bytes,
        });
        return { attachment: { kind: "file", path: saved.path, mime: saved.mime, name: saved.name }, bytes: saved.bytes };
    }
    finally {
        await file.handle.close().catch(() => undefined);
    }
}
/**
 * Attach one file for one provider turn. Two things must hold while the copy
 * is awaited, so both are handled here rather than in the route:
 *
 * - The per-turn count is exact under parallel calls: the slot is reserved
 *   before the await, so simultaneous calls cannot all pass the same check.
 *   A call that fails or is refused gives its slot back.
 * - Nothing is published for a turn that ended (stopped, replaced, deleted, or
 *   moved) while the copy ran. `stillLive` is asked again after the await,
 *   just before `publish`, and the copy is discarded when it says no.
 */
export async function attachForTurn(turn, max, hooks) {
    const used = turn.attachedFiles ?? 0;
    if (used >= max)
        return { status: "limit" };
    turn.attachedFiles = used + 1;
    let saved;
    let published = false;
    try {
        saved = await hooks.save();
        if (!hooks.stillLive())
            return { status: "ended" };
        hooks.publish(saved);
        published = true;
        return { status: "attached", saved };
    }
    finally {
        if (!published) {
            turn.attachedFiles = Math.max(0, (turn.attachedFiles ?? 1) - 1);
            if (saved !== undefined)
                hooks.discard(saved);
        }
    }
}
