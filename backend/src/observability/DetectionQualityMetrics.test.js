const RiskScorer = require("../scoring/RiskScorer");
const DetectionQualityMetrics = require("./DetectionQualityMetrics");

describe("Detection quality telemetry foundations", () => {
    test("persists config lineage on alerts when threshold lineage is available", async () => {
        let createdDoc = null;

        const alertModel = {
            create: async (doc) => {
                createdDoc = doc;
                return { ...doc, toObject: () => doc };
            },
        };

        const thresholdValues = {
            score_weight_cycle: 0.35,
            score_weight_smurfing: 0.3,
            score_weight_behavioral: 0.2,
            score_weight_geo: 0.15,
            config_version_id: "cfg-v42",
            published_change_id: "chg-9001",
        };

        const scorer = new RiskScorer({
            alertModel,
            thresholdConfig: {
                get: (key, fallback = null) => Object.prototype.hasOwnProperty.call(thresholdValues, key)
                    ? thresholdValues[key]
                    : fallback,
            },
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        await scorer.compute(
            {
                transaction_id: "tx-1",
                subject_account_id: "ACC-1",
                cycle_signals: [{ cycle_score: 88, involved_accounts: ["ACC-1"], transaction_sequence: [] }],
                smurfing_signal: null,
                behavioral_signal: null,
            },
            { sender_country: "US", receiver_country: "GB" }
        );

        expect(createdDoc).toEqual(expect.objectContaining({
            config_version_id: "cfg-v42",
            published_change_id: "chg-9001",
        }));
    });

    test("keeps alert creation backward compatible when lineage is unavailable", async () => {
        let createdDoc = null;

        const scorer = new RiskScorer({
            alertModel: {
                create: async (doc) => {
                    createdDoc = doc;
                    return { ...doc, toObject: () => doc };
                },
            },
            thresholdConfig: {
                get: (_key, fallback = null) => fallback,
            },
            geoRiskEvaluator: { score: () => 0 },
            emitter: { emit: jest.fn() },
        });

        await scorer.compute(
            {
                transaction_id: "tx-2",
                subject_account_id: "ACC-2",
                cycle_signals: [],
                smurfing_signal: { smurfing_score: 45, transaction_ids: ["tx-2"] },
                behavioral_signal: null,
            },
            { sender_country: "US", receiver_country: "GB" }
        );

        expect(createdDoc).toEqual(expect.objectContaining({
            config_version_id: null,
            published_change_id: null,
        }));
    });
});

describe("DetectionQualityMetrics", () => {
    test("returns detector and risk-tier segmented daily and weekly windows", async () => {
        const aggregate = jest.fn(async (pipeline) => {
            const unit = pipeline[1]?.$group?._id?.bucket?.unit;

            if (unit === "day") {
                return [
                    {
                        _id: {
                            bucket_start: new Date("2026-04-10T00:00:00.000Z"),
                            pattern_type: "CIRCULAR_TRADING",
                            risk_tier: "HIGH",
                            config_version_id: "cfg-v42",
                            published_change_id: "chg-9001",
                        },
                        count: 3,
                    },
                    {
                        _id: {
                            bucket_start: new Date("2026-04-10T00:00:00.000Z"),
                            pattern_type: "SMURFING",
                            risk_tier: "MEDIUM",
                            config_version_id: "cfg-v42",
                            published_change_id: "chg-9001",
                        },
                        count: 2,
                    },
                ];
            }

            if (unit === "week") {
                return [
                    {
                        _id: {
                            bucket_start: new Date("2026-04-07T00:00:00.000Z"),
                            pattern_type: "BEHAVIORAL_ANOMALY",
                            risk_tier: "LOW",
                            config_version_id: "cfg-v43",
                            published_change_id: "chg-9002",
                        },
                        count: 5,
                    },
                ];
            }

            return [];
        });

        const service = new DetectionQualityMetrics({
            alertModel: { aggregate },
            now: () => new Date("2026-04-10T12:00:00.000Z"),
        });

        const result = await service.getDetectionQualityTelemetry({ day_window_days: 7, week_window_weeks: 4 });

        expect(result).toEqual(expect.objectContaining({
            generated_at: "2026-04-10T12:00:00.000Z",
            windows: expect.objectContaining({
                daily: expect.any(Array),
                weekly: expect.any(Array),
            }),
        }));

        expect(result.windows.daily).toHaveLength(1);
        expect(result.windows.weekly).toHaveLength(1);

        const dailyBucket = result.windows.daily[0];
        expect(dailyBucket.detectors.cycle.total).toBe(3);
        expect(dailyBucket.detectors.cycle.risk_tiers.high).toBe(3);
        expect(dailyBucket.detectors.smurfing.total).toBe(2);
        expect(dailyBucket.detectors.smurfing.risk_tiers.medium).toBe(2);
        expect(dailyBucket.detectors.behavioral.total).toBe(0);
        expect(dailyBucket.lineage_versions).toEqual([
            {
                config_version_id: "cfg-v42",
                published_change_id: "chg-9001",
                total: 5,
            },
        ]);

        const weeklyBucket = result.windows.weekly[0];
        expect(weeklyBucket.detectors.behavioral.total).toBe(5);
        expect(weeklyBucket.detectors.behavioral.risk_tiers.low).toBe(5);
        expect(weeklyBucket.lineage_versions).toEqual([
            {
                config_version_id: "cfg-v43",
                published_change_id: "chg-9002",
                total: 5,
            },
        ]);
    });

    test("normalizes unknown detector/risk values and still returns stable schema", async () => {
        const service = new DetectionQualityMetrics({
            alertModel: {
                aggregate: jest.fn(async () => [
                    {
                        _id: {
                            bucket_start: new Date("2026-04-10T00:00:00.000Z"),
                            pattern_type: "UNKNOWN_PATTERN",
                            risk_tier: "VERY_HIGH",
                            config_version_id: null,
                            published_change_id: null,
                        },
                        count: 99,
                    },
                ]),
            },
            now: () => new Date("2026-04-10T12:00:00.000Z"),
        });

        const result = await service.getDetectionQualityTelemetry({ day_window_days: 1, week_window_weeks: 1 });
        const dailyBucket = result.windows.daily[0];

        expect(dailyBucket.detectors.cycle).toEqual({
            total: 0,
            risk_tiers: { low: 0, medium: 0, high: 0 },
        });
        expect(dailyBucket.detectors.smurfing).toEqual({
            total: 0,
            risk_tiers: { low: 0, medium: 0, high: 0 },
        });
        expect(dailyBucket.detectors.behavioral).toEqual({
            total: 0,
            risk_tiers: { low: 0, medium: 0, high: 0 },
        });
    });

    test("returns dashboard-ready before/after/delta comparison by config version", async () => {
        const service = new DetectionQualityMetrics({
            alertModel: {
                aggregate: jest.fn(async () => [
                    {
                        _id: {
                            cohort: "before",
                            config_version_id: "cfg-v41",
                            published_change_id: "chg-9000",
                            segment: "retail",
                            pattern_type: "CIRCULAR_TRADING",
                            confidence_level: "HIGH",
                        },
                        count: 4,
                    },
                    {
                        _id: {
                            cohort: "after",
                            config_version_id: "cfg-v42",
                            published_change_id: "chg-9001",
                            segment: null,
                            pattern_type: "SMURFING",
                            confidence_level: null,
                        },
                        count: 2,
                    },
                ]),
            },
            now: () => new Date("2026-04-10T12:00:00.000Z"),
        });

        const result = await service.getDetectionQualityComparisonTelemetry({
            before_config_version_id: "cfg-v41",
            after_config_version_id: "cfg-v42",
            day_window_days: 9,
            week_window_weeks: 8,
        });

        expect(result).toEqual(expect.objectContaining({
            generated_at: "2026-04-10T12:00:00.000Z",
            selectors: {
                before: { config_version_id: "cfg-v41", published_change_id: null },
                after: { config_version_id: "cfg-v42", published_change_id: null },
            },
            windows: { day_window_days: 9, week_window_weeks: 8 },
            before: expect.any(Object),
            after: expect.any(Object),
            delta: expect.any(Object),
        }));

        expect(result.before).toEqual(expect.objectContaining({
            total: 4,
            lineage: {
                config_version_id: "cfg-v41",
                published_change_id: "chg-9000",
            },
            breakdowns: expect.objectContaining({
                segment: {
                    retail: { total: 4 },
                },
                pattern_type: {
                    CIRCULAR_TRADING: { total: 4 },
                },
                confidence_level: {
                    HIGH: { total: 4 },
                },
            }),
        }));

        expect(result.after.breakdowns.segment).toEqual({
            unknown: { total: 2 },
        });
        expect(result.after.breakdowns.confidence_level).toEqual({
            unknown: { total: 2 },
        });
        expect(result.delta).toEqual({ total: -2 });
    });
});
