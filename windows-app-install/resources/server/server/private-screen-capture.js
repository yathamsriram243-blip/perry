/** Capture a preview only while nobody holds the human-control lease. The
 * second check matters for remote captures: a user can take over while the
 * screenshot request is in flight, and that result may already contain what
 * they started typing. */
export async function captureOutsideHumanControl(control, capture) {
    const before = control();
    if (before.held)
        return null;
    const { png, format } = await capture();
    const after = control();
    // Checking only `held` has a take→type→release race: a slow remote
    // screenshot can finish after the lease is already false again. Any control
    // transition during the request makes that frame private and disposable.
    if (after.held || after.revision !== before.revision)
        return null;
    return { png, mime: format === "jpeg" ? "image/jpeg" : "image/png" };
}
