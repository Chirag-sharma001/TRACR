const DEFAULT_MAX_WINDOW_HOURS = 72;

function markAiCandidate(candidate = {}) {
    return {
        status: "CANDIDATE_ONLY",
        candidate_type: candidate.candidate_type || "GRAPH_ANOMALY",
        model: candidate.model || "unknown",
        rationale: candidate.rationale || null,
        detected_at: candidate.detected_at || new Date().toISOString(),
        raw: candidate.raw || null,
    };
}

function buildDeterministicEvidence(cycleSignal = {}, { maxWindowHours = DEFAULT_MAX_WINDOW_HOURS } = {}) {
    const sequence = Array.isArray(cycleSignal.transaction_sequence) ? cycleSignal.transaction_sequence : [];
    if (sequence.length === 0) {
        return null;
    }

    const normalizedSequence = sequence.map((edge) => ({
        from: edge.from,
        to: edge.to,
        amount: Number(edge.amount),
        timestamp: new Date(edge.timestamp).toISOString(),
        txId: edge.txId || null,
    }));

    const inferredAccounts = new Set();
    for (const edge of normalizedSequence) {
        if (edge.from) {
            inferredAccounts.add(edge.from);
        }
        if (edge.to) {
            inferredAccounts.add(edge.to);
        }
    }

    const involvedAccounts = Array.isArray(cycleSignal.involved_accounts) && cycleSignal.involved_accounts.length > 0
        ? Array.from(new Set(cycleSignal.involved_accounts))
        : Array.from(inferredAccounts);

    const timestamps = normalizedSequence.map((edge) => new Date(edge.timestamp).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const windowHours = (maxTimestamp - minTimestamp) / (60 * 60 * 1000);
    const bounded = Number.isFinite(maxWindowHours) ? windowHours <= maxWindowHours : true;

    return {
        pattern_type: cycleSignal.pattern_type || "GRAPH_PATTERN",
        transaction_sequence: normalizedSequence,
        path_edges: normalizedSequence,
        involved_accounts: involvedAccounts,
        window_metadata: {
            window_type: cycleSignal.window_type || "STRICT",
            start_timestamp: new Date(minTimestamp).toISOString(),
            end_timestamp: new Date(maxTimestamp).toISOString(),
            window_hours: windowHours,
            max_window_hours: maxWindowHours,
            bounded,
        },
    };
}

function confirmDeterministicGraphHit({
    cycleSignals = [],
    aiCandidate = null,
    maxWindowHours = DEFAULT_MAX_WINDOW_HOURS,
} = {}) {
    const deterministicCycle = cycleSignals.find((signal) => {
        const evidence = buildDeterministicEvidence(signal, { maxWindowHours });
        return Boolean(evidence && evidence.window_metadata.bounded);
    });

    if (deterministicCycle) {
        return {
            status: "CONFIRMED",
            confirmed: true,
            confirmed_pattern_type: deterministicCycle.pattern_type || "GRAPH_PATTERN",
            evidence: buildDeterministicEvidence(deterministicCycle, { maxWindowHours }),
            ai_candidate: aiCandidate ? markAiCandidate(aiCandidate) : null,
        };
    }

    if (aiCandidate) {
        return {
            status: "CANDIDATE_ONLY",
            confirmed: false,
            confirmed_pattern_type: null,
            evidence: null,
            ai_candidate: markAiCandidate(aiCandidate),
        };
    }

    return {
        status: "NO_SIGNAL",
        confirmed: false,
        confirmed_pattern_type: null,
        evidence: null,
        ai_candidate: null,
    };
}

module.exports = {
    confirmDeterministicGraphHit,
    buildDeterministicEvidence,
    markAiCandidate,
};
