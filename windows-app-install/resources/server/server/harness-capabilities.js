// What a bot gains or loses when its default engine (instanceId, hence
// driver) changes. Two per-driver facts decide it: whether the driver mounts
// the agents tool catalog at all (adapter capabilities.agentsMcp — a bot on
// a driver without it is never even told about the team tools), and which
// approval levels the destination driver implements. Turn-scoped catalog
// flags are identical on both sides of a switch, so the comparison below
// uses one envelope profile and lets the per-driver capability decide the
// delta; the tool names themselves come from the real catalog, so this
// never drifts from what a turn is actually shown.
import { APPROVAL_MODES, supportsApprovalMode as driverKindSupportsApprovalMode } from "../shared/approval-mode.js";
import { availableTools } from "./drivers/agents-catalog.js";
/** The widest turn the harness can build: every optional integration on and
 * a coordinating (room) turn, where the room-only coordination tools exist.
 * Both sides of a comparison get the same profile; only the driver's own
 * capability can differ. */
const ENVELOPE = {
    externalRuntime: false,
    coordinating: true,
    ownThreadCreation: true,
    skillAuthoring: true,
    sharedComputers: true,
    voiceNotes: true,
    // Not a tool it adds: a Cloud home only hides its Local VM shell.
    cloudHome: false,
    botId: "",
};
/** Extra card lines for an engine switch, empty when nothing changes. */
export function harnessCapabilityLines(from, to) {
    if (!from || !to)
        return [];
    const lines = [];
    if (from.agentsMcp !== to.agentsMcp) {
        const names = availableTools(ENVELOPE).map((tool) => tool.name);
        const coordination = ["coordinate_bots", "ask_bot", "delegate_bot"].filter((name) => names.includes(name));
        lines.push(to.agentsMcp
            ? "Gains peer coordination and the other team tools: " + names.length + " tools including " + coordination.join(", ") + "."
            : "Loses peer coordination and every team tool: " + names.length + " tools including " + coordination.join(", ") + " go away.");
    }
    if (from.driverKind !== to.driverKind) {
        const lost = APPROVAL_MODES.filter((mode) => driverKindSupportsApprovalMode(from.driverKind, mode) && !driverKindSupportsApprovalMode(to.driverKind, mode));
        const gained = APPROVAL_MODES.filter((mode) => !driverKindSupportsApprovalMode(from.driverKind, mode) && driverKindSupportsApprovalMode(to.driverKind, mode));
        if (lost.length)
            lines.push("Loses approval levels: " + lost.join(", ") + ".");
        if (gained.length)
            lines.push("Gains approval levels: " + gained.join(", ") + ".");
    }
    return lines;
}
/** Binds the registry to the approval-support check so each gate passes its
 * model selection — or a driver view it already holds — and stops
 * unwrapping registry.cliTarget(...)?.driverKind at every call site. The
 * lookup prefers shadow state, so a mid-reconfig instance answers with the
 * driver it would actually run. */
export function createApprovalModeSupport(registry) {
    return function supportsApprovalMode(target, mode) {
        const driverKind = target === undefined
            ? undefined
            : "driverKind" in target
                ? target.driverKind
                : registry.cliTarget(target.instanceId)?.driverKind;
        return driverKindSupportsApprovalMode(driverKind, mode);
    };
}
