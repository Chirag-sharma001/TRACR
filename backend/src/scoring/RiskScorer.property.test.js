const fc = require("fast-check");
const GeoRiskEvaluator = require("./GeoRiskEvaluator");
const RiskScorer = require("./RiskScorer");
const Alert = require("../models/Alert");
const { randomUUID } = require("crypto");

// Feature: intelligent-aml-framework, Property 16: Composite Risk Score Invariants
// Feature: intelligent-aml-framework, Property 17: Geographic Risk Score for FATF Jurisdictions
// Feature: intelligent-aml-framework, Property 18: Score Decomposition Recorded in Alert
// Feature: intelligent-aml-framework, Property 19: Config Weight Changes Applied to Subsequent Scores

describe("RiskScorer property tests", () => {
    const confidenceRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };

    function makeDetectionResult(cycle, smurfing, hasBehavior) {
        return {
            transaction_id: randomUUID(),
            subject_account_id: "ACC-1",
            cycle_signals: cycle > 0 ? [{ cycle_score: cycle, involved_accounts: ["ACC-1"], transaction_sequence: [] }] : [],
            smurfing_signal: smurfing > 0 ? { smurfing_score: smurfing, transaction_ids: [] } : null,
            behavioral_signal: hasBehavior ? { anomalies: [{ anomalyType: "HIGH_VALUE_NEW_COUNTERPARTY" }] } : null,
        };
    }

    test("composite score remains in bounds and tiers match ranges", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                fc.boolean(),
                fc.constantFrom(0, 15),
                async (cycle, smurfing, hasBehavior, geoScore) => {
                    let createdDoc = null;
                    const alertModel = {
                        create: async (doc) => {
                            createdDoc = doc;
                            return { ...doc, toObject: () => doc };
                        },
                    };

                    const weights = {
                        score_weight_cycle: 0.35,
                        score_weight_smurfing: 0.3,
                        score_weight_behavioral: 0.2,
                        score_weight_geo: 0.15,
                    };

                    const thresholdConfig = { get: (key) => weights[key] };
                    const scorer = new RiskScorer({
                        alertModel,
                        thresholdConfig,
                        geoRiskEvaluator: { score: () => geoScore },
                        emitter: { emit: jest.fn() },
                    });

                    const result = makeDetectionResult(cycle, smurfing, hasBehavior);
                    const alert = await scorer.compute(result, { sender_country: "US", receiver_country: "GB" });

                    expect(alert.risk_score).toBeGreaterThanOrEqual(0);
                    expect(alert.risk_score).toBeLessThanOrEqual(100);

                    if (alert.risk_score >= 70) expect(alert.risk_tier).toBe("HIGH");
                    else if (alert.risk_score >= 40) expect(alert.risk_tier).toBe("MEDIUM");
                    else expect(alert.risk_tier).toBe("LOW");

                    const behavioralScore = hasBehavior ? 40 : 0;
                    const expected = Math.max(
                        0,
                        Math.min(
                            100,
                            cycle * 0.35 +
                            smurfing * 0.3 +
                            behavioralScore * 0.2 +
                            ((geoScore / 15) * 100) * 0.15
                        )
                    );
                    expect(alert.risk_score).toBeCloseTo(expected, 6);
                    expect(createdDoc).toBeTruthy();
                }
            ),
            { numRuns: 100 }
        );
    });

    test("geographic risk assigns positive score only for FATF jurisdictions", async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom("IR", "KP", "MM", "US", "GB", "IN"), async (country) => {
                const evaluator = new GeoRiskEvaluator({ thresholdConfig: null });
                const score = evaluator.score({ sender_country: country, receiver_country: "US" });

                if (["IR", "KP", "MM"].includes(country)) {
                    expect(score).toBeGreaterThan(0);
                    expect(score).toBeLessThanOrEqual(15);
                } else {
                    expect(score).toBe(0);
                }
            }),
            { numRuns: 100 }
        );
    });

    test("score breakdown always permits full score reconstruction", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                fc.boolean(),
                async (cycle, smurfing, hasBehavior) => {
                    const alertModel = {
                        create: async (doc) => ({ ...doc, toObject: () => doc }),
                    };

                    const thresholdConfig = {
                        get: (key) => ({
                            score_weight_cycle: 0.4,
                            score_weight_smurfing: 0.3,
                            score_weight_behavioral: 0.2,
                            score_weight_geo: 0.1,
                        }[key]),
                    };

                    const scorer = new RiskScorer({
                        alertModel,
                        thresholdConfig,
                        geoRiskEvaluator: { score: () => 15 },
                        emitter: { emit: jest.fn() },
                    });

                    const detectionResult = makeDetectionResult(cycle, smurfing, hasBehavior);
                    const alert = await scorer.compute(detectionResult, { sender_country: "IR", receiver_country: "US" });

                    const b = alert.score_breakdown;
                    expect(b).toEqual(
                        expect.objectContaining({
                            cycle_score: expect.any(Number),
                            smurfing_score: expect.any(Number),
                            behavioral_score: expect.any(Number),
                            geographic_score: expect.any(Number),
                            cycle_weight: expect.any(Number),
                            smurfing_weight: expect.any(Number),
                            behavioral_weight: expect.any(Number),
                            geographic_weight: expect.any(Number),
                        })
                    );

                    const reconstructed = Math.max(
                        0,
                        Math.min(
                            100,
                            b.cycle_score * b.cycle_weight +
                            b.smurfing_score * b.smurfing_weight +
                            b.behavioral_score * b.behavioral_weight +
                            ((b.geographic_score / 15) * 100) * b.geographic_weight
                        )
                    );
                    expect(alert.risk_score).toBeCloseTo(reconstructed, 6);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("updated config weights affect only subsequent scores", async () => {
        const state = {
            score_weight_cycle: 0.35,
            score_weight_smurfing: 0.3,
            score_weight_behavioral: 0.2,
            score_weight_geo: 0.15,
        };

        const thresholdConfig = { get: (key) => state[key] };
        const alertModel = { create: async (doc) => ({ ...doc, toObject: () => doc }) };
        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig,
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        const detectionResult = makeDetectionResult(90, 90, true);
        const before = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });

        state.score_weight_cycle = 0.6;
        state.score_weight_smurfing = 0.2;
        state.score_weight_behavioral = 0.1;
        state.score_weight_geo = 0.1;

        const after = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });

        expect(after.risk_score).not.toBeCloseTo(before.risk_score, 8);

        const expectedBefore = Math.max(0, Math.min(100, 90 * 0.35 + 90 * 0.3 + 40 * 0.2));
        expect(before.risk_score).toBeCloseTo(expectedBefore, 8);
    });

    test("canonical explainability packet always includes decomposition and confidence", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                fc.integer({ min: 0, max: 100 }),
                fc.boolean(),
                fc.constantFrom(0, 15),
                async (cycle, smurfing, hasBehavior, geoScore) => {
                    const alertModel = {
                        create: async (doc) => ({ ...doc, toObject: () => doc }),
                    };

                    const thresholdConfig = {
                        get: (key) => ({
                            score_weight_cycle: 0.35,
                            score_weight_smurfing: 0.3,
                            score_weight_behavioral: 0.2,
                            score_weight_geo: 0.15,
                        }[key]),
                    };

                    const scorer = new RiskScorer({
                        alertModel,
                        thresholdConfig,
                        geoRiskEvaluator: { score: () => geoScore },
                        emitter: { emit: jest.fn() },
                    });

                    const alert = await scorer.compute(
                        makeDetectionResult(cycle, smurfing, hasBehavior),
                        { sender_country: "US", receiver_country: "GB" }
                    );

                    expect(alert.explainability_packet).toEqual(
                        expect.objectContaining({
                            deterministic_evidence: expect.any(Object),
                            score_decomposition: expect.any(Object),
                            narrative_mapping: expect.any(Object),
                            confidence_level: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
                        })
                    );

                    const decomposition = alert.explainability_packet.score_decomposition;
                    expect(decomposition).toEqual(
                        expect.objectContaining({
                            cycle_score: expect.any(Number),
                            smurfing_score: expect.any(Number),
                            behavioral_score: expect.any(Number),
                            geographic_score: expect.any(Number),
                            cycle_weight: expect.any(Number),
                            smurfing_weight: expect.any(Number),
                            behavioral_weight: expect.any(Number),
                            geographic_weight: expect.any(Number),
                        })
                    );

                    const reconstructed = Math.max(
                        0,
                        Math.min(
                            100,
                            decomposition.cycle_score * decomposition.cycle_weight +
                            decomposition.smurfing_score * decomposition.smurfing_weight +
                            decomposition.behavioral_score * decomposition.behavioral_weight +
                            ((decomposition.geographic_score / 15) * 100) * decomposition.geographic_weight
                        )
                    );
                    expect(alert.risk_score).toBeCloseTo(reconstructed, 6);
                    expect(alert.explainability_packet.confidence_level).toBe(alert.confidence_level);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("narrative rationale maps claims to transaction and account evidence", async () => {
        const alertModel = {
            create: async (doc) => ({ ...doc, toObject: () => doc }),
        };

        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig: null,
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        const detectionResult = {
            transaction_id: "tx-root",
            subject_account_id: "ACC-1",
            cycle_signals: [
                {
                    cycle_score: 82,
                    involved_accounts: ["ACC-1", "ACC-2", "ACC-3"],
                    transaction_sequence: [
                        { from: "ACC-1", to: "ACC-2", txId: "tx-a", amount: 4000, timestamp: "2026-04-10T00:00:00.000Z" },
                        { from: "ACC-2", to: "ACC-3", txId: "tx-b", amount: 3900, timestamp: "2026-04-10T00:20:00.000Z" },
                    ],
                    window_metadata: {
                        start_timestamp: "2026-04-10T00:00:00.000Z",
                        end_timestamp: "2026-04-10T00:20:00.000Z",
                        max_window_hours: 72,
                        bounded: true,
                    },
                },
            ],
            smurfing_signal: null,
            behavioral_signal: null,
        };

        const alert = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });
        expect(alert.xai_narrative).toContain("tx-a");
        expect(alert.xai_narrative).toContain("ACC-1");

        const statements = alert.explainability_packet.narrative_mapping.statements;
        expect(Array.isArray(statements)).toBe(true);
        expect(statements.length).toBeGreaterThan(0);

        const hasEvidenceRefs = statements.some((statement) => {
            const refs = statement?.evidence_refs || {};
            return Array.isArray(refs.transaction_ids)
                && refs.transaction_ids.length > 0
                && Array.isArray(refs.account_ids)
                && refs.account_ids.length > 0;
        });

        expect(hasEvidenceRefs).toBe(true);
    });

    test("confidence level is deterministic and tracks evidence strength", async () => {
        const alertModel = {
            create: async (doc) => ({ ...doc, toObject: () => doc }),
        };

        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig: null,
            geoRiskEvaluator: { score: () => 10 },
            emitter: { emit: jest.fn() },
        });

        const strongDetection = {
            transaction_id: "tx-strong",
            subject_account_id: "ACC-STRONG-1",
            cycle_signals: [
                {
                    cycle_score: 95,
                    involved_accounts: ["ACC-STRONG-1", "ACC-STRONG-2", "ACC-STRONG-3"],
                    transaction_sequence: [
                        { from: "ACC-STRONG-1", to: "ACC-STRONG-2", txId: "tx-s-1" },
                        { from: "ACC-STRONG-2", to: "ACC-STRONG-3", txId: "tx-s-2" },
                    ],
                },
            ],
            smurfing_signal: { smurfing_score: 70, transaction_ids: ["tx-s-3", "tx-s-4"] },
            behavioral_signal: { anomalies: [{ anomalyType: "HIGH_VALUE_NEW_COUNTERPARTY" }] },
        };

        const weakDetection = {
            transaction_id: "tx-weak",
            subject_account_id: "ACC-WEAK-1",
            cycle_signals: [],
            smurfing_signal: null,
            behavioral_signal: { anomalies: [] },
        };

        const strongAlertA = await scorer.compute(strongDetection, { sender_country: "IR", receiver_country: "US" });
        const strongAlertB = await scorer.compute(strongDetection, { sender_country: "IR", receiver_country: "US" });
        const weakAlert = await scorer.compute(weakDetection, { sender_country: "US", receiver_country: "GB" });

        expect(strongAlertA.confidence_level).toBe(strongAlertB.confidence_level);
        expect(confidenceRank[strongAlertA.confidence_level]).toBeGreaterThanOrEqual(
            confidenceRank[weakAlert.confidence_level]
        );
    });

    test("alert schema includes confidence_level constrained to LOW, MEDIUM, HIGH", () => {
        const confidencePath = Alert.schema.path("confidence_level");
        expect(confidencePath).toBeDefined();
        expect(confidencePath.options.enum).toEqual(["LOW", "MEDIUM", "HIGH"]);
    });

    test("alert schema includes deterministic evidence references in explainability_packet", () => {
        expect(Alert.schema.path("explainability_packet")).toBeDefined();
        expect(Alert.schema.path("explainability_packet.deterministic_evidence")).toBeDefined();
        expect(Alert.schema.path("explainability_packet.deterministic_evidence.transaction_ids")).toBeDefined();
        expect(Alert.schema.path("explainability_packet.deterministic_evidence.involved_accounts")).toBeDefined();
    });

    test("segment-aware thresholds can change tier from global default for same score", async () => {
        const alertModel = {
            create: async (doc) => ({ ...doc, toObject: () => doc }),
        };

        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig: {
                get: (key, fallback = null) => {
                    const map = {
                        score_weight_cycle: 1,
                        score_weight_smurfing: 0,
                        score_weight_behavioral: 0,
                        score_weight_geo: 0,
                        customer_segment_default: "retail",
                    };
                    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
                },
            },
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        const detectionResult = {
            transaction_id: randomUUID(),
            subject_account_id: "ACC-SEG-1",
            customer_segment: "retail",
            cycle_signals: [{ cycle_score: 65, involved_accounts: ["ACC-SEG-1"], transaction_sequence: [] }],
            smurfing_signal: null,
            behavioral_signal: { anomalies: [] },
        };

        const alert = await scorer.compute(detectionResult, { sender_country: "IR", receiver_country: "US" });

        expect(alert.risk_score).toBe(65);
        expect(alert.risk_tier).toBe("HIGH");
    });

    test("confidence remains supplementary and precision context is persisted separately", async () => {
        const alertModel = {
            create: async (doc) => ({ ...doc, toObject: () => doc }),
        };

        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig: {
                get: (key, fallback = null) => {
                    const map = {
                        score_weight_cycle: 1,
                        score_weight_smurfing: 0,
                        score_weight_behavioral: 0,
                        score_weight_geo: 0,
                    };
                    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
                },
            },
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        const detectionResult = {
            transaction_id: randomUUID(),
            subject_account_id: "ACC-PREC-1",
            customer_segment: "enterprise",
            cycle_signals: [{ cycle_score: 72, involved_accounts: ["ACC-PREC-1"], transaction_sequence: [] }],
            smurfing_signal: null,
            behavioral_signal: { anomalies: [] },
        };

        const alert = await scorer.compute(detectionResult, { sender_country: "US", receiver_country: "GB" });

        expect(alert.risk_tier).toBe("HIGH");
        expect(alert.confidence_level).toMatch(/^(LOW|MEDIUM|HIGH)$/);
        expect(alert.precision_context).toEqual(
            expect.objectContaining({
                segment: expect.any(String),
                geo_band: expect.any(String),
                threshold_source: expect.any(String),
                thresholds: expect.objectContaining({
                    high: expect.any(Number),
                    medium: expect.any(Number),
                }),
            })
        );
    });
});
