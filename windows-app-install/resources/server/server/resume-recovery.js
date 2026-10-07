// Deciding whether a turn may be sent a second time.
//
// When a native session cannot be resumed, the harness still holds the
// canonical transcript and can rebuild the conversation. The question is not
// whether it CAN — it is whether doing so is safe. If the provider already
// accepted the prompt, the model may have run tools, written files, or sent
// messages. Replaying that turn would do it all again.
//
// So the boundary is classified from the driver's own protocol state — which
// request was in flight, whether the prompt was submitted, whether anything
// streamed — and never from error text. Provider error strings are prose:
// they get reworded between releases, they are localized, and a retry
// decision that turns on a regex over them is a duplicate side effect
// waiting for a vendor copy-edit.
//
// Lifted from #759 (aivsomkar), where the rebuild came from a context plan;
// here it is the recovery text the harness attaches to a resuming turn.
export function classifyResumeFailure(state) {
    // Output is the strongest evidence available and outranks everything: if
    // the model spoke, the prompt landed.
    if (state.producedOutput || state.promptSubmitted)
        return "after-accept";
    if (state.attempted && state.rejected)
        return "before-accept";
    return "unknown";
}
/** Whether this failure may be recovered by sending the turn again. */
export function mayReplay(failure) {
    return failure === "before-accept";
}
/** The prompt a recovered turn should carry.
 *
 * A fresh session started after a rejected resume has NO history: sending
 * only the current message drops the entire conversation silently, which
 * looks to the user like the bot forgot everything. The recovery text is the
 * rebuild, and it already contains the current message exactly once. */
export function recoveryPromptFor(input) {
    if (!mayReplay(input.failure))
        return { text: input.currentText, replayed: false };
    const replay = input.recoveryText?.trim();
    // No rebuild, or one with nothing to replay (a thread whose only history
    // is the message being sent): the current text is already the whole turn.
    if (!replay || replay === input.currentText.trim())
        return { text: input.currentText, replayed: false };
    return { text: replay, replayed: true };
}
