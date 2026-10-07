import { describeSpawnFailure, execCli } from "./procs.js";
const FALLBACK = "Run `claude update` in Terminal, then refresh Engines.";
function stderrOf(error) {
    const stderr = error.stderr;
    return typeof stderr === "string"
        ? stderr
        : Buffer.isBuffer(stderr)
            ? stderr.toString("utf8")
            : "";
}
function run(execute, cli, args, options) {
    return new Promise((resolve, reject) => {
        execute(cli, args, options, (error, stdout, stderr) => {
            if (error) {
                if (error.stderr === undefined && stderr) {
                    Object.assign(error, { stderr });
                }
                reject(error);
            }
            else
                resolve(stdout);
        });
    });
}
function updateFailure(error, cli) {
    const err = error instanceof Error ? error : new Error(String(error));
    const processError = err;
    if (processError.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        return new Error(`Claude update produced too much output. ${FALLBACK}`);
    }
    if (typeof processError.code === "string") {
        return new Error(`${describeSpawnFailure(processError, cli).message}. ${FALLBACK}`);
    }
    if (processError.killed) {
        return new Error(`Claude update timed out after 3 minutes. ${FALLBACK}`);
    }
    const detail = (stderrOf(err).trim() || err.message).split("\n")[0].slice(0, 400);
    return new Error(`Claude update failed${detail ? `: ${detail}` : ""}. ${FALLBACK}`);
}
/** Run Claude Code's own updater, then prove which version is now installed.
 * The caller owns the environment so credentials can be stripped before the
 * executable (including a configured wrapper) is launched. */
export async function updateClaudeCli(cli, env, execute = execCli) {
    try {
        await run(execute, cli, ["update"], {
            env,
            timeout: 180_000,
            killSignal: "SIGKILL",
            maxBuffer: 1024 * 1024,
        });
    }
    catch (error) {
        throw updateFailure(error, cli);
    }
    try {
        const stdout = await run(execute, cli, ["--version"], {
            env,
            timeout: 10_000,
            killSignal: "SIGKILL",
            maxBuffer: 64 * 1024,
        });
        const version = stdout.trim().split("\n")[0];
        if (!version)
            throw new Error("Claude returned an empty version");
        return { version };
    }
    catch {
        throw new Error("Claude finished updating, but OpenMausBot could not verify the installed version. Refresh Engines to check it.");
    }
}
