const claudeFirst = (instances) => instances.find((instance) => instance.driverKind === "claudeAgent") ??
    instances.find((instance) => instance.instanceId === "openaiCompat") ??
    instances.find((instance) => instance.driverKind === "openai-compat") ??
    instances[0];
/** A saved choice is intentional: an unavailable provider or removed model
 * sends new bots to setup instead of silently changing their provider. */
export function selectDefaultModelSelection(instances, preferred, context = {}) {
    if (preferred) {
        const instance = instances.find((candidate) => candidate.instanceId === preferred.instanceId);
        if (instance?.snapshot.state !== "available" ||
            instance.snapshot.authenticated === false ||
            // An organisation that disallows the saved engine makes it unusable,
            // exactly like an unavailable one: setup, never another provider.
            context.refusal?.(instance) !== undefined ||
            (preferred.variant !== undefined && !instance.capabilities?.modelVariants) ||
            !(instance.models.default === preferred.model || instance.models.options.some((model) => model.id === preferred.model))) {
            return { instanceId: "", model: "" };
        }
        const selection = { ...preferred };
        // A saved effort can outlive driver support. Keep the intentional model,
        // but let the provider use its own effort default instead of failing turn 1.
        if (selection.effort && !instance.capabilities?.effortLevels?.includes(selection.effort))
            delete selection.effort;
        return selection;
    }
    // The organisation's policy is inert (no refusal) unless this desktop is enrolled.
    const available = instances.filter((instance) => instance.snapshot.state === "available" && context.refusal?.(instance) === undefined);
    const company = context.company;
    let pick;
    if (company && instances.some((instance) => company(instance.instanceId))) {
        // Enrolled: an installed but signed-out personal Claude would send every
        // new bot to setup although a Company model can run. Prefer instances that
        // can run a turn now; a working personal engine still wins, so billing
        // stays the person's explicit choice.
        const ready = available.filter((instance) => instance.access === "custom" || instance.snapshot.authenticated !== false);
        pick = claudeFirst(ready.filter((instance) => !company(instance.instanceId))) ?? claudeFirst(ready) ?? claudeFirst(available);
    }
    else {
        pick = claudeFirst(available);
    }
    return { instanceId: pick?.instanceId ?? "", model: pick?.models.default ?? "" };
}
/** Complete a new bot's selection with the workspace's new-bot effort. An
 * explicit effort or model variant is the caller's choice and wins; an engine
 * that does not offer the level keeps sending none rather than failing turn 1. */
export function withNewBotEffort(selection, effort, offered) {
    if (!effort || selection.effort !== undefined || selection.variant !== undefined || !offered?.includes(effort)) {
        return selection;
    }
    return { ...selection, effort };
}
