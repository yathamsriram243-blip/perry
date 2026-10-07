// Delivery receipts for bot-to-bot messages: what actually happened to a
// send the moment the coordination/delegation tool returned, one receipt
// per recipient. The outcomes are the bot-facing half of the same honesty
// discipline SteerOutcome applies to steering — a tri-state that can always
// be answered truthfully, where an indeterminate send reads "queued", never
// "delivered":
//
//   queued   — accepted into a durable lane; the recipient's turn has not
//              started, so nothing has been delivered yet
//   injected — the recipient's turn started with this message (it may still
//              be running, or it may have run and failed)
//   failed   — not delivered; the detail says why
//
// The rule that overrides every other consideration: never report delivery
// that did not happen. A failed live hand-off may stay buffered for a later
// drain, but its receipt stays failed.
import { clip, peerName } from "./peer-roster.js";
// Detail lines are built from harness error text that can carry
// peer- or provider-authored content, so they are flattened and clipped like
// a roster entry (peer-roster.ts) rather than trust the sender of the failure.
const DETAIL_MAX = 200;
/** Build a receipt with the detail flattened onto one clipped line. */
export function peerDeliveryReceipt(receipt) {
    return {
        botId: receipt.botId,
        ...(receipt.botName ? { botName: receipt.botName } : {}),
        outcome: receipt.outcome,
        detail: clip(receipt.detail, DETAIL_MAX) || "no detail recorded",
        ...(receipt.taskId ? { taskId: receipt.taskId } : {}),
        ...(receipt.requestId ? { requestId: receipt.requestId } : {}),
        ...(receipt.threadId ? { threadId: receipt.threadId } : {}),
    };
}
const named = (receipt) => peerName(receipt.botName ?? "") || peerName(receipt.botId) || "teammate";
/** Render receipts as the tool-result prose a sender reads. One receipt
 * becomes a single "Delivery to …" line; several become a fenced list with
 * one line per recipient, in the order the caller addressed them. An empty
 * list renders nothing, so callers can append unconditionally. */
export function renderPeerDeliveryReceipts(receipts) {
    if (!receipts.length)
        return "";
    const line = (receipt) => `${named(receipt)}: ${receipt.outcome} — ${receipt.detail}`;
    if (receipts.length === 1)
        return `Delivery to ${line(receipts[0])}`;
    return ["Delivery receipts:", ...receipts.map(receipt => `- ${line(receipt)}`)].join("\n");
}
