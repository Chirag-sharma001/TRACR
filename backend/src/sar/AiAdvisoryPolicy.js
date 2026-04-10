const REGULATED_ACTION_KEYWORDS = ["CLOSE", "SUPPRESS", "FILE"];

function normalizeDecisionSource(decisionSource) {
    if (typeof decisionSource !== "string") {
        return "";
    }

    return decisionSource.trim().toUpperCase();
}

function isRegulatedAction(action) {
    if (typeof action !== "string") {
        return false;
    }

    const normalized = action.toUpperCase();
    return REGULATED_ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function assertHumanDecisionGate({ action, decision_source, decisionSource } = {}) {
    const source = normalizeDecisionSource(decision_source || decisionSource);

    if (isRegulatedAction(action) && source !== "HUMAN") {
        const error = new Error("human decision required for regulated action");
        error.code = "human_decision_required";
        error.status = 400;
        throw error;
    }
}

function normalizeEvidenceList(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return Array.from(new Set(values.filter(Boolean)));
}

function attachEvidenceTrace(payload = {}, evidence = {}) {
    const evidenceTrace = {
        alert_id: evidence.alert_id || payload.alert_id || null,
        case_id: evidence.case_id || payload.case_id || null,
        account_id: evidence.account_id || payload.subject_account_id || null,
        transaction_ids: normalizeEvidenceList(evidence.transaction_ids || payload.transaction_ids),
    };

    return {
        ...payload,
        ai_advisory: {
            mode: "ADVISORY_ONLY",
            decision_authority: "HUMAN_REQUIRED",
            decision_source: "AI",
            human_review_required: true,
            filing_decision_finalized: false,
        },
        evidence_trace: evidenceTrace,
    };
}

module.exports = {
    assertHumanDecisionGate,
    attachEvidenceTrace,
};
