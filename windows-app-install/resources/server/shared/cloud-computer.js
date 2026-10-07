// Which engines can work on a cloud computer: Hosted desktop on Boat, or a
// self-hosted VPS. One rule for the server (every attach, readiness check and
// select_computer offer) and the renderer (the Works on panel, the composer's
// place chip, Webhooks and Routines), so the two never disagree.
/** An engine with computer tools gets the cloud computer as one more stdio
 * computer server. The Computer engine (boxAgent) runs its whole turn on its
 * Boat, so it can work on a Boat but not on a VPS. */
export function canWorkOnCloud(engine, backend) {
    const runsOnBoat = engine?.driverKind === "boxAgent";
    const hasComputerTools = engine?.computerMcp === true;
    return backend === "vps" ? hasComputerTools && !runsOnBoat : hasComputerTools || runsOnBoat;
}
