import { containerComputerExists, perBotLocalVmTarget, poolLocalVmTarget, } from "./container-computer.js";
/** Idle cleanup is destructive. An exact derived name alone is not ownership:
 * a pre-existing container must also carry OpenMausBot's verified labels. */
export function shouldArmLocalVmIdle(status) {
    return status?.container === "running" && status.managed;
}
/** Discover only exact, bot-derived container identities. Bot destination is
 * deliberately irrelevant: an existing VM must stay visible after its bot is
 * moved to Cloud, Browser, This computer, Auto, or Off. */
export async function discoverExistingPerBotLocalVms(bots, runtime, exists = containerComputerExists) {
    const candidates = [...new Map(bots.map((bot) => {
            const target = perBotLocalVmTarget(bot.id);
            return [target.key, { bot, target }];
        })).values()];
    const existing = await Promise.all(candidates.map(({ target }) => exists(runtime, target)));
    return candidates.filter((_, index) => existing[index]);
}
/** Discover the pool-mode seats that actually have containers (issue #1654).
 * Same exactness rule as the per-bot walk above: a derived name alone is not
 * ownership, so a pre-existing container must also carry this target's
 * verified labels. */
export async function discoverExistingPoolLocalVms(seatCount, runtime, exists = containerComputerExists) {
    const seats = Math.max(1, Math.floor(seatCount));
    const targets = Array.from({ length: seats }, (_, seat) => poolLocalVmTarget(seat));
    const existing = await Promise.all(targets.map((target) => exists(runtime, target)));
    return targets.filter((_, index) => existing[index]);
}
/** The public inventory is an explicit allow-list. In particular, it cannot
 * leak viewer passwords/URLs, host workspace paths, runtime commands, or
 * target hashes from the full Local VM status object. */
export function localVmInventoryEntry(bot, status, inUse) {
    if (status.container === "missing")
        return null;
    return {
        botId: bot.id,
        name: bot.name,
        destination: bot.computer ?? "auto",
        container: status.container,
        managed: status.managed,
        ready: status.ready,
        problem: status.problem,
        inUse,
    };
}
