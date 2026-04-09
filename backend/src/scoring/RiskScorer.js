const eventBus = require("../events/eventBus");
const Alert = require("../models/Alert");
const GeoRiskEvaluator = require("./GeoRiskEvaluator");
const SegmentAwareThresholdPolicy = require("../policy/SegmentAwareThresholdPolicy");

class RiskScorer {
    constructor({
        alertModel = Alert,
        thresholdConfig,
        geoRiskEvaluator = null,
        thresholdPolicy = null,
        emitter = eventBus,
        logger = console,
    } = {}) {
        this.alertModel = alertModel;
        this.thresholdConfig = thresholdConfig;
        this.geoRiskEvaluator = geoRiskEvaluator || new GeoRiskEvaluator({ thresholdConfig });
        this.thresholdPolicy = thresholdPolicy || new SegmentAwareThresholdPolicy({ thresholdConfig, logger });
        this.emitter = emitter;
        this.logger = logger;
    }

    async compute(detectionResult, geolocation) {
        const cycleScore = this.#extractCycleScore(detectionResult);
        const smurfingScore = Number(detectionResult.smurfing_signal?.smurfing_score || 0);
        const behavioralScore = this.#extractBehavioralScore(detectionResult);
        const geoScore = this.geoRiskEvaluator.score(geolocation);

        const weights = {
            cycle_weight: this.#getWeight("score_weight_cycle", 0.35),
            smurfing_weight: this.#getWeight("score_weight_smurfing", 0.30),
            behavioral_weight: this.#getWeight("score_weight_behavioral", 0.20),
            geographic_weight: this.#getWeight("score_weight_geo", 0.15),
        };

        const normalizedGeoScore = (geoScore / 15) * 100;

        const composite =
            cycleScore * weights.cycle_weight +
            smurfingScore * weights.smurfing_weight +
            behavioralScore * weights.behavioral_weight +
            normalizedGeoScore * weights.geographic_weight;

        const riskScore = Math.max(0, Math.min(100, composite));

        const patternType = this.#inferPatternType(detectionResult);
        const geoBand = this.#resolveGeoBand(geoScore);
        const segment = this.#resolveSegment(detectionResult);
        const policyResolution = this.thresholdPolicy.resolveWithContext({
            segment,
            patternType,
            geoBand,
        });
        const riskTier = this.#classifyTier(riskScore, policyResolution.thresholds);
        const involvedAccounts = this.#extractInvolvedAccounts(detectionResult);
        const transactionIds = this.#extractTransactionIds(detectionResult);
        const scoreBreakdown = {
            cycle_score: cycleScore,
            smurfing_score: smurfingScore,
            behavioral_score: behavioralScore,
            geographic_score: geoScore,
            ...weights,
        };
        const deterministicEvidence = this.#buildDeterministicEvidence({
            detectionResult,
            patternType,
            involvedAccounts,
            transactionIds,
        });
        const confidenceLevel = this.#deriveConfidenceLevel({
            riskScore,
            scoreBreakdown,
            deterministicEvidence,
            patternType,
        });
        const narrativeMapping = this.#buildNarrativeMapping({
            patternType,
            riskScore,
            riskTier,
            scoreBreakdown,
            deterministicEvidence,
            confidenceLevel,
        });
        const xaiNarrative = this.#buildNarrativeText({
            narrativeMapping,
            deterministicEvidence,
            confidenceLevel,
        });

        const explainabilityPacket = {
            deterministic_evidence: deterministicEvidence,
            score_decomposition: scoreBreakdown,
            narrative_mapping: narrativeMapping,
            confidence_level: confidenceLevel,
        };
        const lineage = this.#resolveConfigLineage(detectionResult);

        const alertDoc = {
            pattern_type: patternType,
            subject_account_id: detectionResult.subject_account_id,
            involved_accounts: involvedAccounts,
            transaction_ids: transactionIds,
            risk_score: riskScore,
            risk_tier: riskTier,
            confidence_level: confidenceLevel,
            score_breakdown: scoreBreakdown,
            explainability_packet: explainabilityPacket,
            cycle_detail: detectionResult.cycle_signals?.[0] || null,
            smurfing_detail: detectionResult.smurfing_signal || null,
            behavioral_detail: detectionResult.behavioral_signal || null,
            xai_narrative: xaiNarrative,
            config_version_id: lineage.config_version_id,
            published_change_id: lineage.published_change_id,
            precision_context: {
                segment: policyResolution.segment,
                pattern_type: policyResolution.pattern_type,
                geo_band: policyResolution.geo_band,
                threshold_source: policyResolution.threshold_source,
                thresholds: policyResolution.thresholds,
            },
        };

        const saved = await this.alertModel.create(alertDoc);
        const payload = saved.toObject ? saved.toObject() : saved;

        return payload;
    }

    #extractCycleScore(detectionResult) {
        if (!Array.isArray(detectionResult.cycle_signals) || detectionResult.cycle_signals.length === 0) {
            return 0;
        }

        return Math.max(...detectionResult.cycle_signals.map((signal) => Number(signal.cycle_score || 0)));
    }

    #extractBehavioralScore(detectionResult) {
        const anomalies = detectionResult.behavioral_signal?.anomalies || [];
        if (anomalies.length === 0) {
            return 0;
        }

        let score = 0;
        for (const anomaly of anomalies) {
            if (Number.isFinite(Number(anomaly.severity))) {
                score += Number(anomaly.severity);
                continue;
            }

            if (anomaly.anomalyType === "HIGH_VALUE_NEW_COUNTERPARTY") {
                score += 40;
            }
            if (anomaly.anomalyType === "FREQUENCY_SPIKE") {
                score += 35;
            }
            if (anomaly.anomalyType === "FREQUENCY_ELEVATION") {
                score += 20;
            }
        }

        return Math.min(100, score);
    }

    #classifyTier(score, thresholds = { high: 70, medium: 40 }) {
        if (score >= thresholds.high) {
            return "HIGH";
        }
        if (score >= thresholds.medium) {
            return "MEDIUM";
        }
        return "LOW";
    }

    #inferPatternType(detectionResult) {
        if (Array.isArray(detectionResult.cycle_signals) && detectionResult.cycle_signals.length > 0) {
            return "CIRCULAR_TRADING";
        }
        if (detectionResult.smurfing_signal) {
            return "SMURFING";
        }
        return "BEHAVIORAL_ANOMALY";
    }

    #extractInvolvedAccounts(detectionResult) {
        const ids = new Set();

        ids.add(detectionResult.subject_account_id);

        for (const signal of detectionResult.cycle_signals || []) {
            for (const id of signal.involved_accounts || []) {
                ids.add(id);
            }
        }

        if (detectionResult.smurfing_signal?.subject_account_id) {
            ids.add(detectionResult.smurfing_signal.subject_account_id);
        }

        return Array.from(ids).filter(Boolean);
    }

    #extractTransactionIds(detectionResult) {
        const ids = new Set();

        if (detectionResult.transaction_id) {
            ids.add(detectionResult.transaction_id);
        }

        for (const signal of detectionResult.cycle_signals || []) {
            for (const edge of signal.transaction_sequence || []) {
                if (edge.txId) {
                    ids.add(edge.txId);
                }
            }
        }

        for (const id of detectionResult.smurfing_signal?.transaction_ids || []) {
            ids.add(id);
        }

        return Array.from(ids);
    }

    #resolveSegment(detectionResult) {
        if (typeof detectionResult.customer_segment === "string" && detectionResult.customer_segment.trim().length > 0) {
            return detectionResult.customer_segment.trim().toLowerCase();
        }

        if (typeof detectionResult.account_segment === "string" && detectionResult.account_segment.trim().length > 0) {
            return detectionResult.account_segment.trim().toLowerCase();
        }

        return this.#getConfigValue("customer_segment_default", "default");
    }

    #resolveGeoBand(geoScore) {
        if (geoScore >= 10) {
            return "HIGH";
        }
        if (geoScore >= 5) {
            return "MEDIUM";
        }
        return "LOW";
    }

    #buildDeterministicEvidence({ detectionResult, patternType, involvedAccounts, transactionIds }) {
        const graphPattern = detectionResult.hybrid_boundary?.graph_pattern || null;
        const graphEvidence = graphPattern?.evidence || null;
        const cycleDetail = detectionResult.cycle_signals?.[0] || null;

        const graphSequence = this.#normalizeTransactionSequence(graphEvidence?.transaction_sequence || []);
        const cycleSequence = this.#normalizeTransactionSequence(cycleDetail?.transaction_sequence || []);
        const transactionSequence = graphSequence.length > 0 ? graphSequence : cycleSequence;

        const sequenceTransactionIds = transactionSequence
            .map((edge) => edge.txId)
            .filter(Boolean);

        const evidenceTransactionIds = Array.from(new Set([
            ...transactionIds,
            ...sequenceTransactionIds,
        ]));

        const primaryAccounts = Array.isArray(graphEvidence?.involved_accounts)
            && graphEvidence.involved_accounts.length > 0
            ? graphEvidence.involved_accounts
            : Array.isArray(cycleDetail?.involved_accounts) && cycleDetail.involved_accounts.length > 0
                ? cycleDetail.involved_accounts
                : involvedAccounts;

        return {
            pattern_type: graphPattern?.confirmed_pattern_type || patternType,
            transaction_ids: evidenceTransactionIds,
            involved_accounts: Array.from(new Set(primaryAccounts.filter(Boolean))),
            transaction_sequence: transactionSequence,
            window_metadata: graphEvidence?.window_metadata || cycleDetail?.window_metadata || null,
        };
    }

    #buildNarrativeMapping({
        patternType,
        riskScore,
        riskTier,
        scoreBreakdown,
        deterministicEvidence,
        confidenceLevel,
    }) {
        const contributions = [
            {
                key: "cycle",
                value: scoreBreakdown.cycle_score * scoreBreakdown.cycle_weight,
            },
            {
                key: "smurfing",
                value: scoreBreakdown.smurfing_score * scoreBreakdown.smurfing_weight,
            },
            {
                key: "behavioral",
                value: scoreBreakdown.behavioral_score * scoreBreakdown.behavioral_weight,
            },
            {
                key: "geographic",
                value: ((scoreBreakdown.geographic_score / 15) * 100) * scoreBreakdown.geographic_weight,
            },
        ].sort((left, right) => right.value - left.value);

        const dominant = contributions[0] || { key: "cycle", value: 0 };
        const evidenceTransactionIds = deterministicEvidence.transaction_ids.slice(0, 5);
        const evidenceAccountIds = deterministicEvidence.involved_accounts.slice(0, 5);

        return {
            summary: `${patternType} risk tier ${riskTier} (${riskScore.toFixed(2)}) with ${confidenceLevel} confidence.`,
            statements: [
                {
                    claim: `Dominant score contributor is ${dominant.key} (${dominant.value.toFixed(2)}).`,
                    evidence_refs: {
                        transaction_ids: evidenceTransactionIds,
                        account_ids: evidenceAccountIds,
                    },
                },
                {
                    claim: `Deterministic evidence contains ${deterministicEvidence.transaction_sequence.length} linked transactions.`,
                    evidence_refs: {
                        transaction_ids: evidenceTransactionIds,
                        account_ids: evidenceAccountIds,
                    },
                },
            ],
        };
    }

    #buildNarrativeText({ narrativeMapping, deterministicEvidence, confidenceLevel }) {
        const txRefs = deterministicEvidence.transaction_ids.slice(0, 3).join(", ") || "none";
        const accountRefs = deterministicEvidence.involved_accounts.slice(0, 3).join(", ") || "none";
        return `${narrativeMapping.summary} Evidence tx_ids=[${txRefs}] account_ids=[${accountRefs}] confidence=${confidenceLevel}.`;
    }

    #deriveConfidenceLevel({ riskScore, scoreBreakdown, deterministicEvidence, patternType }) {
        const weightedContributions = [
            scoreBreakdown.cycle_score * scoreBreakdown.cycle_weight,
            scoreBreakdown.smurfing_score * scoreBreakdown.smurfing_weight,
            scoreBreakdown.behavioral_score * scoreBreakdown.behavioral_weight,
            ((scoreBreakdown.geographic_score / 15) * 100) * scoreBreakdown.geographic_weight,
        ];

        const dominantContribution = Math.max(...weightedContributions);
        const evidenceDepth = Math.min(24, deterministicEvidence.transaction_ids.length * 4)
            + Math.min(18, deterministicEvidence.involved_accounts.length * 3)
            + (deterministicEvidence.transaction_sequence.length > 0 ? 12 : 0)
            + (deterministicEvidence.window_metadata ? 8 : 0)
            + (patternType === "CIRCULAR_TRADING" && deterministicEvidence.transaction_sequence.length > 0 ? 8 : 0);

        const compositionStrength = dominantContribution >= 30
            ? 16
            : dominantContribution >= 15
                ? 10
                : 4;

        const riskStrength = riskScore >= 70
            ? 24
            : riskScore >= 40
                ? 14
                : 6;

        const confidenceScore = evidenceDepth + compositionStrength + riskStrength;

        if (confidenceScore >= 70) {
            return "HIGH";
        }
        if (confidenceScore >= 40) {
            return "MEDIUM";
        }
        return "LOW";
    }

    #normalizeTransactionSequence(sequence) {
        return sequence
            .filter((edge) => edge && typeof edge === "object")
            .map((edge) => ({
                from: edge.from || null,
                to: edge.to || null,
                amount: Number(edge.amount || 0),
                timestamp: edge.timestamp || null,
                txId: edge.txId || edge.transaction_id || null,
            }));
    }

    #resolveConfigLineage(detectionResult) {
        const resultLineage = detectionResult?.config_lineage || null;
        if (resultLineage && typeof resultLineage === "object") {
            return {
                config_version_id: resultLineage.config_version_id || null,
                published_change_id: resultLineage.published_change_id || null,
            };
        }

        const configVersionId = this.#getConfigValue("config_version_id", null);
        const publishedChangeId = this.#getConfigValue("published_change_id", null);

        return {
            config_version_id: configVersionId,
            published_change_id: publishedChangeId,
        };
    }

    #getConfigValue(key, fallback) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallback;
        }

        return this.thresholdConfig.get(key, fallback);
    }

    #getWeight(key, fallback) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallback;
        }

        const value = Number(this.thresholdConfig.get(key));
        if (!Number.isFinite(value)) {
            return fallback;
        }

        return value;
    }
}

module.exports = RiskScorer;
