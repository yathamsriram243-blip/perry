/** The statuses both failure indicators count: a run that went wrong and has
 * not been acknowledged. One home so the sidebar dot, the errors pill, the
 * logs filter and the bulk-seen sweep cannot drift apart. */
export const ROUTINE_PROBLEM_STATUSES = ["failed", "missed"];
export function isRoutineProblemRun(run) {
    return ROUTINE_PROBLEM_STATUSES.includes(run.status);
}
