import { hostedWorkspaceConfiguration } from "./enterprise.js";
/** The hosted Admin owns Slack installation and authorization. This link
 * carries identifiers only; opening it never grants access to that service. */
export function hostedSlackManagement(botId, runtimeReady, env = process.env) {
    const hosted = hostedWorkspaceConfiguration(env);
    if (!runtimeReady || !hosted?.portalMembership)
        return { available: false };
    const management = new URL("/slack", hosted.admin);
    management.search = new URLSearchParams({ workspace: hosted.workspace, bot: botId }).toString();
    return { available: true, managementUrl: management.href };
}
