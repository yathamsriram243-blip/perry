import { realpathSync } from "node:fs";
import { isAbsolute } from "node:path";
/** Approval identity preserves every command byte, including whitespace and
 * newlines. Callers must supply native shell input, never a display preview. */
export function permissionCommand(command, cwd) {
    if (typeof command !== "string" || !command.trim() || command.includes("\0"))
        return undefined;
    if (typeof cwd !== "string" || !isAbsolute(cwd) || cwd.includes("\0"))
        return undefined;
    return { command, cwd };
}
export function permissionLaunchCwd(cwd) {
    try {
        return realpathSync(cwd);
    }
    catch {
        return undefined;
    }
}
/** ACP's rawInput is provider-specific. Accept a complete command string and
 * unambiguous absolute directory fields. A relative/invalid/conflicting
 * directory is not evidence of where the agent will execute it. */
export function acpPermissionCommand(rawInput, launchCwd) {
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput))
        return undefined;
    const input = rawInput;
    const directories = ["cwd", "workdir", "working_directory", "directory", "dir"]
        .filter((key) => input[key] !== undefined)
        .map((key) => input[key]);
    if (directories.some((value) => typeof value !== "string" || !isAbsolute(value) || value.includes("\0")))
        return undefined;
    if (new Set(directories).size > 1)
        return undefined;
    return permissionCommand(input.command, directories[0] ?? launchCwd);
}
