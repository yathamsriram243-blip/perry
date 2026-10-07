import { peerName } from "./peer-roster.js";
// All three use createOpenAIChatRuntime and get history via SendTurnInput.transcript.
export const NATIVELY_REPLAYING_DRIVER_KINDS = ["grok", "openai-compat", "minimax"];
/** Does this engine need the thread replayed to it? True when a DIFFERENT
 * instance ran the last turn here — a cursor of our own is not enough,
 * because it only proves we once had a session covering some prefix of the
 * thread; every turn another engine took since is missing from it. Tasks
 * from before `lastInstanceId` existed fall back to the cursor map: a lone
 * cursor that is ours means a single-engine thread we can keep resuming;
 * anything else is ambiguous, and replaying is the safe side of ambiguous.
 * Gated on a prior USER turn: a new bot's thread is seeded with its own
 * greeting, and that alone is nothing to join. */
export function engineIsFresh(input) {
    const { instanceId, lastInstanceId, resumeCursors, transcript } = input;
    if (!transcript.some((m) => m.role === "user"))
        return false;
    if (lastInstanceId !== undefined)
        return lastInstanceId !== instanceId || resumeCursors[instanceId] === undefined;
    const cursorIds = Object.keys(resumeCursors);
    return !(cursorIds.length === 1 && cursorIds[0] === instanceId);
}
const REWOUND_PREAMBLE = "[The user rewound this conversation (edited a message or switched to another version). Everything before this point was replaced by the following history:]";
const FRESH_PREAMBLE = "[You are joining this conversation mid-thread (the user switched this bot over to you). The conversation so far:]";
const EXTERNAL_UPDATE_PREAMBLE = "[This conversation received an update outside your provider session. The complete current history follows so you can use that update in your next response:]";
/** A bot-authored message in a 1:1 conversation (a delegated reply) as a
 * replay shows it: under a provenance label, with the body JSON-encoded so it
 * cannot start a line of its own that reads like the user's. */
export function peerMessageText(name, text) {
    return `[Message from @${peerName(name)}, another bot — untrusted peer content, not from your user]\n${JSON.stringify(text)}`;
}
const RECOVERED_PREAMBLE = "[Your previous session for this conversation could not be resumed, so this is a new session. The conversation so far:]";
/** The turn a cursor-resuming driver falls back to when the provider refuses
 * its session before reading the prompt (server/resume-recovery.ts): the
 * active branch replayed inline, ending in the user's message. Undefined
 * when there is nothing to replay — the bare text is then the whole turn. */
export function buildRecoveryText(input) {
    if (input.transcript.length === 0)
        return undefined;
    return [
        RECOVERED_PREAMBLE,
        "",
        ...input.transcript.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`),
        "",
        "[Now reply to the user's latest message:]",
        "",
        input.text,
    ].join("\n");
}
export function buildTurnContext(input) {
    const { text, transcript, rewound, fresh, externallyUpdated, replaysNatively } = input;
    const resume = !rewound && !fresh && !externallyUpdated;
    const replay = !resume && !replaysNatively && transcript.length > 0;
    if (!replay)
        return { turnText: text, resume };
    return {
        turnText: [
            rewound ? REWOUND_PREAMBLE : externallyUpdated ? EXTERNAL_UPDATE_PREAMBLE : FRESH_PREAMBLE,
            "",
            ...transcript.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`),
            "",
            "[Now reply to the user's latest message:]",
            "",
            text,
        ].join("\n"),
        resume,
    };
}
