const asMcpImage = (c) => !!c &&
    typeof c === "object" &&
    c.type === "image" &&
    typeof c.data === "string" &&
    typeof c.mimeType === "string"
    ? c
    : null;
// Claude CLI reformats MCP image content into Anthropic Messages API shape
// before drivers ever see it — {type:"image", source:{type:"base64",
// media_type, data}} — rather than the MCP-native {type, data, mimeType}.
// Other drivers (codex/acp) pass the MCP-native shape through unchanged.
const asAnthropicImage = (c) => {
    const source = c?.type === "image"
        ? c.source
        : null;
    if (!source || typeof source !== "object")
        return null;
    const { type, media_type, data } = source;
    return type === "base64" && typeof media_type === "string" && typeof data === "string"
        ? { data, mimeType: media_type }
        : null;
};
const asImageBlock = (c) => asMcpImage(c) ?? asAnthropicImage(c);
/** MCP tool_result content mixes text/image blocks. toolDetailPreview redacts
 * the image bytes for the activity-log line (by design — that preview is
 * never meant to carry raw base64); this pulls the images out separately so
 * a caller can fold them into the message as attachments instead of losing
 * them. Accepts either a raw MCP content array or a `{ content: [...] }`
 * wrapper, since drivers hand this differently-shaped payloads. */
export function extractMcpImages(value) {
    const arr = Array.isArray(value)
        ? value
        : Array.isArray(value?.content)
            ? value.content
            : null;
    return arr ? arr.map(asImageBlock).filter((v) => v !== null) : [];
}
