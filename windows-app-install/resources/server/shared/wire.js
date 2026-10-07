/** Reasoning-effort levels, ascending. A union of everything any engine
 * accepts; each driver declares the subset its CLI will take. Lives here
 * because it is part of ModelSelection, which rides the wire. */
export const EFFORT_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];
/** Narrow untrusted API/config input before it becomes a model selection. */
export function isEffortLevel(value) {
    return typeof value === "string" && EFFORT_LEVELS.includes(value);
}
/** Lowercased Composio service slug, e.g. `gmail`. */
export const CONNECTOR_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
/** Composio tool names are upper-snake, e.g. `GMAIL_SEND_EMAIL`. */
export const CONNECTOR_TOOL_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
