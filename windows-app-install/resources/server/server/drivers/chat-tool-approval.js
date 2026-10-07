// Per-turn ask gate, adapted from the approval lifecycle in #780.
// Register before publishing: a harness listener may answer synchronously.
import { newId } from "../contracts.js";
export function createChatToolApproval(options) {
    const pending = new Map();
    let closed = false;
    return {
        ask(tool, summary) {
            if (closed || options.signal.aborted)
                return Promise.resolve(false);
            const ask = { id: newId(), tool, summary };
            return new Promise((resolve) => {
                let timer;
                const card = {
                    kind: "permission",
                    ask,
                    finish(source, decision) {
                        if (!pending.delete(ask.id))
                            return;
                        clearTimeout(timer);
                        options.signal.removeEventListener("abort", abort);
                        const allowed = decision?.allowed === true;
                        options.resolved(ask, allowed, source);
                        resolve(allowed);
                    },
                };
                const abort = () => card.finish("system");
                timer = setTimeout(() => card.finish("timeout"), options.timeoutMs ?? 15 * 60_000);
                timer.unref?.();
                pending.set(ask.id, card);
                options.signal.addEventListener("abort", abort, { once: true });
                options.open(ask);
            });
        },
        question(tool, summary, questions) {
            if (closed || options.signal.aborted)
                return Promise.resolve(null);
            const ask = { id: newId(), tool, summary };
            return new Promise((resolve) => {
                let timer;
                const card = {
                    kind: "question",
                    ask,
                    finish(source, decision) {
                        if (!pending.delete(ask.id))
                            return;
                        clearTimeout(timer);
                        options.signal.removeEventListener("abort", abort);
                        // Only the person's reply resolves a question; a timeout or
                        // abort resolves null so no system note can occupy the answer
                        // slot the model reads as the person's words.
                        const reply = typeof decision?.message === "string" && decision.message.length > 0 ? decision.message : null;
                        options.resolvedQuestion(ask, reply !== null, source);
                        resolve(reply);
                    },
                };
                const abort = () => card.finish("system");
                timer = setTimeout(() => card.finish("timeout"), options.timeoutMs ?? 15 * 60_000);
                timer.unref?.();
                pending.set(ask.id, card);
                options.signal.addEventListener("abort", abort, { once: true });
                options.openQuestion(ask, questions);
            });
        },
        answer(id, behavior, message) {
            const card = pending.get(id);
            if (!card || options.signal.aborted)
                return "unavailable";
            if (behavior === "deny") {
                card.finish("user");
                return "rejected";
            }
            if (card.kind === "permission") {
                // An answer is not a permission: only allow or deny settles it.
                if (behavior !== "allow")
                    return "unavailable";
                card.finish("user", { allowed: true });
                return "allowed-once";
            }
            // And an allow is not an answer: a question settles only on a real
            // reply, never a blank the model would have to interpret.
            if (behavior === "answer" && typeof message === "string" && message.trim()) {
                card.finish("user", { message });
                return "answered";
            }
            return "unavailable";
        },
        close() {
            closed = true;
            for (const card of pending.values())
                card.finish("system");
        },
    };
}
