import { supportsWorkspaceFiles } from "./workspace.js";
/** An automatic switch must not strand the task without its tools or move
 * its filesystem to another machine. Approval and organisation policy are
 * checked by the ordinary model-switch and turn-admission gates. */
export function recoveryCapabilityError(from, to) {
    if (from.capabilities.remoteAgent || to.capabilities.remoteAgent ||
        supportsWorkspaceFiles(from.driverKind) !== supportsWorkspaceFiles(to.driverKind)) {
        return "The backup cannot use the same workspace.";
    }
    const tools = ["agentsMcp", "computerMcp", "composioMcp",
        "phoneMcp", "browserMcp", "localComputerMcp", "customMcp", "images"];
    if (tools.some(key => from.capabilities[key] === true && to.capabilities[key] !== true)) {
        return "The backup does not support all of this engine's tools and attachments.";
    }
}
