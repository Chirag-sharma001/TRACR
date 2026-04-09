const express = require("express");
const Alert = require("../models/Alert");

const CONFIDENCE_LEVELS = new Set(["LOW", "MEDIUM", "HIGH"]);
const SCORE_DECOMPOSITION_DEFAULTS = Object.freeze({
    cycle_score: 0,
    smurfing_score: 0,
    behavioral_score: 0,
    geographic_score: 0,
    cycle_weight: 0.35,
    smurfing_weight: 0.3,
    behavioral_weight: 0.2,
    geographic_weight: 0.15,
});

function mapTierToConfidence(riskTier) {
    if (riskTier === "HIGH") return "HIGH";
    if (riskTier === "MEDIUM") return "MEDIUM";
    return "LOW";
}

function normalizeScoreDecomposition(alert) {
    const source = alert.explainability_packet?.score_decomposition || alert.score_breakdown || {};

    return {
        cycle_score: Number(source.cycle_score || 0),
        smurfing_score: Number(source.smurfing_score || 0),
        behavioral_score: Number(source.behavioral_score || 0),
        geographic_score: Number(source.geographic_score || 0),
        cycle_weight: Number.isFinite(Number(source.cycle_weight))
            ? Number(source.cycle_weight)
            : SCORE_DECOMPOSITION_DEFAULTS.cycle_weight,
        smurfing_weight: Number.isFinite(Number(source.smurfing_weight))
            ? Number(source.smurfing_weight)
            : SCORE_DECOMPOSITION_DEFAULTS.smurfing_weight,
        behavioral_weight: Number.isFinite(Number(source.behavioral_weight))
            ? Number(source.behavioral_weight)
            : SCORE_DECOMPOSITION_DEFAULTS.behavioral_weight,
        geographic_weight: Number.isFinite(Number(source.geographic_weight))
            ? Number(source.geographic_weight)
            : SCORE_DECOMPOSITION_DEFAULTS.geographic_weight,
    };
}

function normalizeDeterministicEvidence(alert) {
    const source = alert.explainability_packet?.deterministic_evidence || {};
    const cycleDetail = alert.cycle_detail || {};

    const sequenceFromSource = Array.isArray(source.transaction_sequence)
        ? source.transaction_sequence
        : [];
    const sequenceFromCycle = Array.isArray(cycleDetail.transaction_sequence)
        ? cycleDetail.transaction_sequence
        : [];
    const transactionSequence = sequenceFromSource.length > 0 ? sequenceFromSource : sequenceFromCycle;

    const sequenceTransactionIds = transactionSequence
        .map((edge) => edge?.txId || edge?.transaction_id)
        .filter(Boolean);
    const baseTransactionIds = Array.isArray(source.transaction_ids)
        ? source.transaction_ids
        : Array.isArray(alert.transaction_ids)
            ? alert.transaction_ids
            : [];

    const sourceAccounts = Array.isArray(source.involved_accounts)
        ? source.involved_accounts
        : [];
    const cycleAccounts = Array.isArray(cycleDetail.involved_accounts)
        ? cycleDetail.involved_accounts
        : [];
    const alertAccounts = Array.isArray(alert.involved_accounts)
        ? alert.involved_accounts
        : [];

    return {
        pattern_type: source.pattern_type || alert.pattern_type || null,
        transaction_ids: Array.from(new Set([...baseTransactionIds, ...sequenceTransactionIds])),
        involved_accounts: Array.from(new Set([...sourceAccounts, ...cycleAccounts, ...alertAccounts].filter(Boolean))),
        transaction_sequence: transactionSequence,
        window_metadata: source.window_metadata || cycleDetail.window_metadata || null,
    };
}

function normalizeNarrativeMapping(alert) {
    const source = alert.explainability_packet?.narrative_mapping || {};
    const summary = source.summary || alert.xai_narrative || null;
    const statements = Array.isArray(source.statements) ? source.statements : [];

    if (statements.length > 0) {
        return {
            summary,
            statements,
        };
    }

    return {
        summary,
        statements: summary
            ? [
                {
                    claim: summary,
                    evidence_refs: {
                        transaction_ids: Array.isArray(alert.transaction_ids) ? alert.transaction_ids : [],
                        account_ids: Array.isArray(alert.involved_accounts) ? alert.involved_accounts : [],
                    },
                },
            ]
            : [],
    };
}

function normalizeConfidenceLevel(alert) {
    const candidate = alert.explainability_packet?.confidence_level
        || alert.confidence_level
        || mapTierToConfidence(alert.risk_tier);

    return CONFIDENCE_LEVELS.has(candidate) ? candidate : mapTierToConfidence(alert.risk_tier);
}

function normalizeAlertPayload(alert) {
    const scoreDecomposition = normalizeScoreDecomposition(alert);
    const deterministicEvidence = normalizeDeterministicEvidence(alert);
    const narrativeMapping = normalizeNarrativeMapping(alert);
    const confidenceLevel = normalizeConfidenceLevel(alert);

    return {
        ...alert,
        confidence_level: confidenceLevel,
        score_breakdown: scoreDecomposition,
        explainability_packet: {
            deterministic_evidence: deterministicEvidence,
            score_decomposition: scoreDecomposition,
            narrative_mapping: narrativeMapping,
            confidence_level: confidenceLevel,
        },
    };
}

function createAlertRoutes({
    jwtMiddleware,
    sarService,
    auditLogger = null,
    alertModel = Alert,
} = {}) {
    const router = express.Router();

    router.get("/", jwtMiddleware, async (req, res) => {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

        const query = {};
        if (req.query.risk_tier) query.risk_tier = req.query.risk_tier;
        if (req.query.pattern_type) query.pattern_type = req.query.pattern_type;
        if (req.query.subject_account_id) query.subject_account_id = req.query.subject_account_id;

        if (req.query.start_date || req.query.end_date) {
            query.created_at = {};
            if (req.query.start_date) query.created_at.$gte = new Date(req.query.start_date);
            if (req.query.end_date) query.created_at.$lte = new Date(req.query.end_date);
        }

        const [items, total] = await Promise.all([
            alertModel
                .find(query)
                .sort({ risk_score: -1, created_at: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            alertModel.countDocuments(query),
        ]);

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "ALERT_VIEW",
                resourceType: "ALERT",
                resourceId: "LIST",
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

          return res.json({ page, limit, total, items: items.map(normalizeAlertPayload) });
    });

    router.get("/:id", jwtMiddleware, async (req, res) => {
        const alert = await alertModel.findOne({ alert_id: req.params.id }).lean();
        if (!alert) {
            return res.status(404).json({ error: "not_found" });
        }

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "ALERT_VIEW",
                resourceType: "ALERT",
                resourceId: req.params.id,
                outcome: "SUCCESS",
                ipAddress: req.ip,
            });
        }

          return res.json(normalizeAlertPayload(alert));
    });

    router.post("/:id/sar", jwtMiddleware, async (req, res) => {
        const alert = await alertModel.findOne({ alert_id: req.params.id }).lean();
        if (!alert) {
            return res.status(404).json({ error: "not_found" });
        }

        const sarDraft = await sarService.generateSAR({
            alert,
            account: req.body?.account || null,
            generatedBy: req.user.user_id,
            caseId: req.body?.case_id || null,
        });

        if (auditLogger) {
            await auditLogger.log({
                userId: req.user.user_id,
                userRole: req.user.role,
                actionType: "SAR_GENERATE",
                resourceType: "ALERT",
                resourceId: req.params.id,
                outcome: "SUCCESS",
                metadata: { sar_id: sarDraft.sar_id },
                ipAddress: req.ip,
            });
        }

        return res.status(202).json({ sar_id: sarDraft.sar_id, is_partial: sarDraft.is_partial });
    });

    return router;
}

module.exports = createAlertRoutes;
