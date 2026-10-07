const ROOT_COMBINATORS = ["anyOf", "oneOf", "allOf", "not"];
function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function branches(value) {
    return Array.isArray(value) ? value.filter(isObject) : [];
}
/** The object shape a schema implies, gathered through its combinators.
 * Its own declarations win over a branch's narrower copy; a property that
 * only a branch declares is kept so the model still knows it exists. A name
 * is required when the schema or an allOf branch requires it, or when every
 * anyOf/oneOf choice does — a requirement of only one choice is not. */
function objectShape(schema) {
    const properties = isObject(schema.properties) ? { ...schema.properties } : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required.filter((key) => typeof key === "string") : []);
    const adopt = (shape) => {
        for (const [key, value] of Object.entries(shape.properties))
            if (!(key in properties))
                properties[key] = value;
    };
    for (const branch of branches(schema.allOf)) {
        const shape = objectShape(branch);
        adopt(shape);
        for (const key of shape.required)
            required.add(key);
    }
    for (const keyword of ["anyOf", "oneOf"]) {
        const choices = branches(schema[keyword]).map(objectShape);
        if (choices.length === 0)
            continue;
        for (const choice of choices)
            adopt(choice);
        for (const key of choices[0].required) {
            if (choices.every((choice) => choice.required.includes(key)))
                required.add(key);
        }
    }
    return { properties, required: [...required] };
}
function describesObject(type) {
    return type === undefined || type === "object" || (Array.isArray(type) && type.includes("object"));
}
/** A strict-provider-safe version of an MCP tool's inputSchema. A schema
 * that is already safe is returned as the same object, so callers can tell
 * whether anything changed. The input is never mutated. */
export function providerSafeInputSchema(schema) {
    if (!isObject(schema) || !describesObject(schema.type))
        return { type: "object", properties: {} };
    if (schema.type === "object" && ROOT_COMBINATORS.every((keyword) => !(keyword in schema)))
        return schema;
    const { properties, required } = objectShape(schema);
    const safe = { ...schema, type: "object", properties };
    for (const keyword of ROOT_COMBINATORS)
        delete safe[keyword];
    if (required.length > 0)
        safe.required = required;
    else
        delete safe.required;
    return safe;
}
/** Rewrites tools/list responses on an MCP stdio stream. Only a response to
 * a tools/list the agent actually sent is touched; every other line — tool
 * results, notifications, errors, non-JSON — passes through byte-for-byte. */
export function createToolListNormalizer() {
    // JSON-RPC ids may be numbers or strings, and 7 is not "7".
    const pending = new Set();
    const idKey = (id) => `${typeof id}:${String(id)}`;
    return {
        observeRequest(line) {
            let frame;
            try {
                frame = JSON.parse(line);
            }
            catch {
                return;
            }
            if (isObject(frame) && frame.method === "tools/list" && (typeof frame.id === "number" || typeof frame.id === "string")) {
                pending.add(idKey(frame.id));
            }
        },
        rewriteResponse(line) {
            if (pending.size === 0)
                return line;
            let frame;
            try {
                frame = JSON.parse(line);
            }
            catch {
                return line;
            }
            if (!isObject(frame) || "method" in frame || !pending.delete(idKey(frame.id)))
                return line;
            if (!isObject(frame.result) || !Array.isArray(frame.result.tools))
                return line;
            let changed = false;
            const tools = frame.result.tools.map((tool) => {
                if (!isObject(tool))
                    return tool;
                const inputSchema = providerSafeInputSchema(tool.inputSchema);
                if (inputSchema === tool.inputSchema)
                    return tool;
                changed = true;
                return { ...tool, inputSchema };
            });
            return changed ? JSON.stringify({ ...frame, result: { ...frame.result, tools } }) : line;
        },
    };
}
