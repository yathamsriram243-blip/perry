// The line the harness prints when a turn starts (stderr, which the desktop
// app keeps in server.log). It shows the start of the prompt, so a stuck turn
// can be traced to what was asked. Words spoken on a Live call are never
// logged — the call's summary line (liveCallSummaryLine) has counters only —
// so a turn carrying any of them shows `text=(spoken)` instead.
const LOGGED_CHARS = 70;
export function turnStartLogLine(turn) {
    const text = turn.spoken ? "(spoken)" : JSON.stringify(turn.text.slice(0, LOGGED_CHARS));
    return `[omb-turn] bot=${turn.botId} text=${text} images=${turn.images} depth=${turn.depth} card=${turn.card}`;
}
