// What the harness does with a provider's permission request.
//
// Nothing here decides whether an action is safe. Each approval level is a
// provider's own permission mode passed straight through (Claude `auto`,
// Grok `--permission-mode`, Codex `approvalsReviewer`, …), and a request that
// reaches this process is one the provider left for a person. The grants the
// app applies are Full access and the person's exact saved commands. Approve
// for me also allows a web search, and that is the one action the app itself
// grants. Questions never come through here: a bot's question always reaches
// a human.
import { supportsApprovalMode } from "../shared/approval-mode.js";
import { isOutboundTool } from "../shared/outbound.js";
/** A failed delivery is a runtime error, not another permission decision.
 * An expired ask must never become a fresh Allow/Deny card. */
export async function deliverFullAccessApproval(adapter, threadId, requestId, turnId, isCurrent = () => false) {
    if (!adapter)
        return "failed";
    try {
        return await adapter.respondToRequest(threadId, requestId, { behavior: "allow" });
    }
    catch {
        // Some adapters ignore the optional native turn id. Recheck the
        // server's owning generation before interrupting that thread.
        if (turnId && isCurrent())
            await adapter.interruptTurn(threadId, turnId).catch(() => { });
        return "failed";
    }
}
/** Full access is the person's explicit grant to this receiving bot, including
 * delegated work. It never inherits the sender's mode or elevates another bot
 * — with the one exception below (delegatedApprovalMode), applied
 * where a Chief's delegated thread is created rather than here.
 * Custom is a provider-config choice rather than an app Full-access grant, so
 * peer-started Custom turns use Auto. Provider support and grant confirmation
 * are checked by the caller. */
export function approvalModeForOrigin(mode, origin) {
    if (mode === "custom" && origin.peerInitiated)
        return "auto";
    return mode;
}
/** Levels by how much runs without asking. Custom is a provider config of
 * its own and is never compared. */
const LEVEL_RANK = { ask: 0, edits: 1, auto: 2, full: 3 };
/** The level work a bot hands to a teammate starts at, or null to keep the
 * teammate's own. A Chief of Staff's level flows down: the person set it on
 * the Chief so the team's work runs that way, and switching every thread the
 * Chief opens with a teammate back off "Ask for approval" was the friction
 * people reported. Only a Chief passes its level on, only the level of the
 * conversation it delegates from, and only upward: a teammate already on a
 * higher level keeps it, and one on Custom keeps its own config. The level
 * is capped at what the teammate's engine implements (Full or Auto-accept
 * edits are not everywhere), stepping down to the next level it has. A bot
 * never raises itself this way. */
export function delegatedApprovalMode(input) {
    if (!input.senderIsChief || input.sameBot)
        return null;
    // A Chief's Custom config is its own; for a teammate it reads as Approve
    // for me, as for any peer-started Custom turn (approvalModeForOrigin).
    const sender = LEVEL_RANK[approvalModeForOrigin(input.senderMode, { peerInitiated: true })] ?? 0;
    const own = LEVEL_RANK[input.recipientMode];
    if (own === undefined)
        return null;
    for (const mode of ["full", "auto", "edits"]) {
        const rank = LEVEL_RANK[mode];
        if (rank > sender)
            continue;
        if (rank <= own)
            return null;
        if (supportsApprovalMode(input.recipientDriverKind, mode))
            return mode;
    }
    return null;
}
// Tools that ask a PERSON something. A question exists so that a human
// decides; any mode answering one on their behalf defeats the only reason
// it was asked. They normally arrive typed as questions and never reach a
// verdict at all — this is the backstop for the path where one arrives
// mis-typed as a permission (a malformed AskUserQuestion call falls back to
// the permission path in permission-proxy). Approving it there does not
// produce an answer: the CLI runs the tool with none and the model is told
// "The user did not answer the questions." — a question silently lost.
const ASKS_A_PERSON = new Set(["askuserquestion", "ask_user", "omb-ask"]);
// A web search is a low-level read. Approve for me allows these names and
// nothing wider: a bare search, a page fetch, and every other tool stay a
// prompt. The name is the same shape as a question — one mcp__<server>__
// prefix removed, then compared case-insensitively.
const WEB_SEARCH = new Set(["websearch", "web_search", "web-search", "search_web"]);
function bareToolName(tool) {
    return tool.replace(/^mcp__[^_]+__/, "").toLowerCase();
}
export function autoVerdict(mode, tool, context) {
    // A question is for a person, whatever channel it arrived on — and
    // whatever the mode: even Full has no answer to give, only an approval
    // that would run the tool with none.
    if (ASKS_A_PERSON.has(bareToolName(tool))) {
        return { approve: null, source: "no-grant" };
    }
    // Full's promise is literal: even a sandbox widening is approved. Entering
    // Full is separately consent-gated by the bot PATCH endpoint, and the
    // request.opened caller invokes this for permissions only, never questions.
    if (mode === "full")
        return { approve: `approved ${tool} (full access)`, source: "full-access" };
    if (context?.requiresExplicitApproval)
        return { approve: null, source: "explicit-approval-block" };
    if (isOutboundTool(tool))
        return { approve: null, source: "outbound-guard" };
    if (context?.commandAllowed)
        return { approve: `approved ${tool} (saved command)`, source: "command-allowlist" };
    // The one action the app itself grants. A fetch of an arbitrary URL is not
    // a search and stays a prompt, in this mode and every other.
    if (mode === "auto" && WEB_SEARCH.has(bareToolName(tool))) {
        return { approve: `approved ${tool} (web search)`, source: "web-search" };
    }
    if (mode === "auto" || mode === "custom")
        return { approve: null, source: "native-approval" };
    return { approve: null, source: "no-grant" };
}
/** Every fixed note a held card can show, by catalog key.
 *
 * The card is the last thing between a bot and someone's filesystem, so the
 * one line explaining why it stopped should not be the one line still in
 * English. The client translates by key and falls back to this text, which
 * the server keeps sending: cards saved before the key existed still render,
 * and so do the free-text apply errors that have no key at all. */
export const HELD_NOTE = {
    "approval.held.outbound": "This sends something on your behalf, so it always asks first.",
    "approval.held.native": "The provider requires your approval for this action.",
    "approval.held.sandbox": "This changes the provider sandbox, so only Full access can approve it automatically.",
    "approval.held.undeliveredFull": "Full access couldn't deliver this approval.",
    "approval.held.undelivered": "Approve for me couldn't answer this one.",
};
/** Which note, as a key. approvalHeldReason is this plus the English text, so
 * the branching that decides the note lives in exactly one place. */
export function approvalHeldNote(context) {
    if (!context.permission)
        return undefined;
    if (context.source === "outbound-guard")
        return "approval.held.outbound";
    if (context.source === "explicit-approval-block")
        return "approval.held.sandbox";
    if (context.source === "native-approval")
        return "approval.held.native";
    return undefined;
}
/** The note a card shows above its buttons, explaining why the bot stopped
 * rather than answering for itself. */
export function approvalHeldReason(context) {
    const key = approvalHeldNote(context);
    return key && HELD_NOTE[key];
}
