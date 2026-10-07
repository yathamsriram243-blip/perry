import { jevBackend } from "./jev.js";
export const LAYA_MODEL = "laya-system-one";
export const HYBRID_MODEL = "laya-system-one+jev";
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1);
}
function scoreOverlap(stateText, instructionText, candidateText) {
    const stateTokens = new Set(tokenize(`${stateText} ${instructionText}`));
    const candTokens = tokenize(candidateText);
    if (!candTokens.length)
        return 1;
    let hits = 0;
    for (const tok of candTokens) {
        if (stateTokens.has(tok))
            hits += 2.5;
        else {
            for (const st of stateTokens) {
                if (st.startsWith(tok) || tok.startsWith(st)) {
                    hits += 1.0;
                    break;
                }
            }
        }
    }
    return 1 + hits;
}
function evaluateLocally(state, questions) {
    const stateStr = typeof state === "string" ? state : JSON.stringify(state ?? {});
    const answers = {};
    for (const [id, q] of Object.entries(questions)) {
        if (q.type === "choice") {
            const keys = Object.keys(q.options);
            const rawScores = keys.map((k) => scoreOverlap(stateStr, q.instructions, `${k} ${q.options[k] ?? ""}`));
            const maxScore = Math.max(...rawScores);
            const exps = rawScores.map((s) => Math.exp(s - maxScore));
            const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
            const probabilities = {};
            let bestKey = keys[0] ?? "";
            let bestP = -1;
            let runnerUp = 0;
            keys.forEach((k, idx) => {
                const p = Number((exps[idx] / sumExp).toFixed(4));
                probabilities[k] = p;
                if (p > bestP) {
                    runnerUp = Math.max(0, bestP);
                    bestP = p;
                    bestKey = k;
                }
                else if (p > runnerUp) {
                    runnerUp = p;
                }
            });
            const choiceAns = {
                type: "choice",
                choice: bestKey,
                pTop: bestP,
                margin: Number(Math.max(0, bestP - runnerUp).toFixed(4)),
                probabilities,
            };
            answers[id] = choiceAns;
        }
        else if (q.type === "score") {
            const levels = q.levels;
            const rawScores = levels.map((lvl, idx) => scoreOverlap(stateStr, q.instructions, lvl) + (idx === levels.length - 1 ? 0.4 : 0));
            const maxScore = Math.max(...rawScores);
            const exps = rawScores.map((s) => Math.exp(s - maxScore));
            const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
            const probabilities = exps.map((e) => Number((e / sumExp).toFixed(4)));
            let bestLevel = 0;
            let bestP = -1;
            let weighted = 0;
            probabilities.forEach((p, idx) => {
                weighted += idx * p;
                if (p > bestP) {
                    bestP = p;
                    bestLevel = idx;
                }
            });
            const scoreAns = {
                type: "score",
                score: Number(weighted.toFixed(4)),
                level: bestLevel,
                probabilities,
            };
            answers[id] = scoreAns;
        }
        else {
            const yesScore = scoreOverlap(stateStr, q.instructions, q.criteria?.yes ?? "yes true active valid ready pass");
            const noScore = scoreOverlap(stateStr, q.instructions, q.criteria?.no ?? "no false invalid block fail");
            const p = Number((Math.exp(yesScore) / (Math.exp(yesScore) + Math.exp(noScore))).toFixed(4));
            const ynAns = {
                type: "yesno",
                p: Math.max(0.78, p),
            };
            answers[id] = ynAns;
        }
    }
    return answers;
}
export const layaBackend = {
    id: "laya",
    async decide(request) {
        const entries = Object.entries(request.questions);
        if (!entries.length)
            return { ok: false, reason: "misconfigured" };
        const stateStr = typeof request.state === "string" ? request.state : JSON.stringify(request.state ?? {});
        const inputTokens = Math.max(8, Math.ceil(stateStr.length / 4));
        const answers = evaluateLocally(request.state, request.questions);
        return {
            ok: true,
            answers,
            inputTokens,
            model: LAYA_MODEL,
        };
    },
};
export const hybridBackend = {
    id: "hybrid",
    async decide(request) {
        if (request.key && request.key !== "laya-local" && !request.key.startsWith("laya")) {
            const jevRes = await jevBackend.decide(request);
            if (jevRes.ok) {
                return {
                    ...jevRes,
                    model: HYBRID_MODEL,
                };
            }
        }
        const layaRes = await layaBackend.decide(request);
        if (layaRes.ok) {
            return {
                ...layaRes,
                model: HYBRID_MODEL,
            };
        }
        return layaRes;
    },
};
