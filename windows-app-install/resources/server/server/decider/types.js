// The decision model's vocabulary, shared by every backend and caller. A
// question is one of three typed shapes; an answer comes back typed to match.
// Nothing here names a vendor: `jev` is one backend, and another (a local
// Jev-compatible server, an LLM) plugs in behind the same types.
export const DECIDER_JOBS = ["roomRouting", "browserClicks", "toolSelection", "placement"];
