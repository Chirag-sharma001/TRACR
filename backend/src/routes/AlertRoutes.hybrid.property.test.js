const fc = require("fast-check");

const createAlertRoutes = require("./alerts");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 28: Alert API explainability packet serialization contract

describe("Alert routes hybrid property tests", () => {
    function makeListModel(items) {
        return {
            find: () => ({
                sort: () => ({
                    skip: () => ({
                        limit: () => ({
                            lean: async () => items,
                        }),
                    }),
                }),
            }),
            countDocuments: async () => items.length,
            findOne: ({ alert_id }) => ({
                lean: async () => items.find((item) => item.alert_id === alert_id) || null,
            }),
        };
    }

    test("GET /api/alerts always returns explainability packet contract fields", async () => {
        const baseItems = [
            {
                alert_id: "AL-1",
                pattern_type: "BEHAVIORAL_ANOMALY",
                subject_account_id: "ACC-1",
                involved_accounts: ["ACC-1"],
                transaction_ids: ["tx-1"],
                risk_score: 44,
                risk_tier: "MEDIUM",
            },
            {
                alert_id: "AL-2",
                pattern_type: "SMURFING",
                subject_account_id: "ACC-2",
                involved_accounts: ["ACC-2", "ACC-3"],
                transaction_ids: ["tx-2", "tx-3"],
                risk_score: 73,
                risk_tier: "HIGH",
            },
        ];

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "analyst-1", role: "ANALYST" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-1", is_partial: false })) },
            alertModel: makeListModel(baseItems),
            auditLogger: { log: jest.fn(async () => { }) },
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.constantFrom(1, 2, 10), async (limit) => {
                    const response = await jsonRequest(server.baseUrl, `/api/alerts?limit=${limit}`);
                    expect(response.status).toBe(200);
                    expect(Array.isArray(response.body.items)).toBe(true);

                    for (const item of response.body.items) {
                        expect(item.confidence_level).toMatch(/^(LOW|MEDIUM|HIGH)$/);
                        expect(item.explainability_packet).toEqual(
                            expect.objectContaining({
                                deterministic_evidence: expect.any(Object),
                                score_decomposition: expect.any(Object),
                                narrative_mapping: expect.any(Object),
                                confidence_level: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
                            })
                        );
                        expect(Object.keys(item.explainability_packet)).toEqual([
                            "deterministic_evidence",
                            "score_decomposition",
                            "narrative_mapping",
                            "confidence_level",
                        ]);
                    }
                }),
                { numRuns: 25 }
            );
        } finally {
            await server.close();
        }
    });

    test("GET /api/alerts/:id includes deterministic evidence payload for graph-pattern alerts", async () => {
        const graphAlert = {
            alert_id: "AL-GRAPH-1",
            pattern_type: "CIRCULAR_TRADING",
            subject_account_id: "ACC-ROOT",
            involved_accounts: ["ACC-ROOT", "ACC-2", "ACC-3"],
            transaction_ids: ["tx-root", "tx-a", "tx-b"],
            risk_score: 88,
            risk_tier: "HIGH",
            cycle_detail: {
                transaction_sequence: [
                    { from: "ACC-ROOT", to: "ACC-2", txId: "tx-a", timestamp: "2026-04-10T00:00:00.000Z" },
                    { from: "ACC-2", to: "ACC-3", txId: "tx-b", timestamp: "2026-04-10T00:10:00.000Z" },
                ],
                involved_accounts: ["ACC-ROOT", "ACC-2", "ACC-3"],
                window_metadata: {
                    start_timestamp: "2026-04-10T00:00:00.000Z",
                    end_timestamp: "2026-04-10T00:10:00.000Z",
                    max_window_hours: 72,
                    bounded: true,
                },
            },
        };

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-1", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-1", is_partial: false })) },
            alertModel: makeListModel([graphAlert]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/AL-GRAPH-1");
            expect(response.status).toBe(200);

            const deterministicEvidence = response.body.explainability_packet.deterministic_evidence;
            expect(deterministicEvidence.pattern_type).toBe("CIRCULAR_TRADING");
            expect(deterministicEvidence.involved_accounts.length).toBeGreaterThan(0);
            expect(deterministicEvidence.transaction_ids.length).toBeGreaterThan(0);
            expect(deterministicEvidence.transaction_sequence.length).toBeGreaterThan(0);
            expect(deterministicEvidence.window_metadata).toEqual(
                expect.objectContaining({
                    start_timestamp: expect.any(String),
                    end_timestamp: expect.any(String),
                })
            );
        } finally {
            await server.close();
        }
    });
});
