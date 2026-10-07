// Part hashes for records added from an organization's library (contract
// §1.6). Every part of an added team keeps two hashes: `r`, the value the
// release shipped, and `w`, the value OpenMausBot wrote at install. The
// automatic updater compares them later: `hash(local) ≠ w` means the person
// edited the part, `r(new release) ≠ r` means the publisher changed it. Only
// the hashes are kept, never a second copy of the content.
//
// The value shapes are frozen: a stamp written today must still compare
// correctly in a later version, so change nothing here without a new stamp
// version.
import { createHash } from "node:crypto";
import { canonicalJson, decodeBase64 } from "../shared/package-format.js";
export const AGENT_PARTS = ["name", "title", "description", "soul", "look", "playbooks", "skills", "connections", "approval"];
export const ROOM_PARTS = ["name", "bulletin", "members", "defaultResponder"];
export const ROUTINE_PARTS = ["name", "prompt", "schedule", "target"];
export const TEAM_PARTS = ["name", "brief", "leader"];
export const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** sha256hex(utf8(canonicalJson(value ?? null))) */
export function partHash(value) {
    return sha256Hex(canonicalJson(value ?? null));
}
export const pair = (release, written) => ({ r: partHash(release), w: partHash(written) });
export function releaseLook(appearance) {
    const bytes = appearance.avatar ? decodeBase64(appearance.avatar.data) : null;
    return {
        color: appearance.color,
        mascotExpression: appearance.mascotExpression ?? null,
        mascotBody: appearance.mascotBody ?? null,
        avatar: bytes ? sha256Hex(bytes) : null,
        crop: appearance.avatar?.crop ?? null,
    };
}
export function playbookValues(playbooks) {
    return playbooks.map(({ key, name, summary, triggers, instructions }) => ({ key, name, summary, triggers: [...triggers], instructions }));
}
/** The release side of every bot part. */
export function agentReleaseValues(agent, playbooks) {
    return {
        name: agent.name,
        title: agent.title ?? "",
        description: agent.description ?? "",
        soul: agent.soul ?? "",
        look: releaseLook(agent.appearance),
        playbooks: playbookValues((agent.playbooks ?? []).flatMap((key) => (playbooks.has(key) ? [playbooks.get(key)] : []))),
        skills: [...(agent.skills ?? [])].sort(),
        connections: [...(agent.connections ?? [])].sort(),
        approval: agent.approval ?? null,
    };
}
export const roomReleaseValues = (room) => ({
    name: room.name,
    bulletin: room.bulletin ?? "",
    members: [...room.members].sort(),
    defaultResponder: room.defaultResponder.kind === "agent"
        ? { kind: "agent", agent: room.defaultResponder.agent }
        : room.defaultResponder.kind === "auto" && room.defaultResponder.agent
            ? { kind: "auto", agent: room.defaultResponder.agent }
            : { kind: room.defaultResponder.kind },
});
/** One normal form for a routine's timing on both sides, so an untouched
 * routine compares equal: absent cap → null, absent overlap → "skip". */
export function scheduleValue(routine) {
    return {
        runOn: routine.runOn,
        schedule: routine.schedule,
        durationMinutes: routine.durationMinutes,
        timeoutMinutes: routine.timeoutMinutes ?? null,
        overlap: routine.overlap ?? "skip",
        continuity: routine.continuity === true,
    };
}
export const routineReleaseValues = (routine) => ({
    name: routine.name,
    prompt: routine.prompt,
    schedule: scheduleValue(routine),
    target: { agent: routine.agent, room: routine.room ?? null },
});
export const connectionReleaseValue = (connection) => ({
    transport: connection.mcp.transport,
    url: connection.mcp.url,
    valueNames: [...connection.mcp.valueNames],
});
export function connectionLocalValue(server) {
    const headers = server.headers && typeof server.headers === "object" ? Object.keys(server.headers) : [];
    return { transport: server.type ?? null, url: server.url ?? null, valueNames: headers.sort() };
}
export function pairs(keys, release, written) {
    return Object.fromEntries(keys.map((key) => [key, pair(release[key], written[key])]));
}
