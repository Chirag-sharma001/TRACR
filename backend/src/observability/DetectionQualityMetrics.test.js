const RiskScorer = require("../scoring/RiskScorer");

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
