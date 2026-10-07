/** Stable persisted grant for one peer action and one target — a bot for
 * the two peer actions, the room for post_to_room. */
export function peerAllowKey(action, targetId) {
    return `${action}:${targetId}`;
}
