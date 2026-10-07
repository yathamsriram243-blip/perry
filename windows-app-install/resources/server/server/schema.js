/** JSON.parse without a reviver can only produce JSON-compatible values. */
export function parseJson(text) {
    return JSON.parse(text);
}
export function schemaIssue(error, fallback) {
    const issue = error.issues[0];
    if (!issue)
        return fallback;
    const path = issue.path.map(String).join(".");
    return path ? `${path} ${issue.message}` : issue.message;
}
