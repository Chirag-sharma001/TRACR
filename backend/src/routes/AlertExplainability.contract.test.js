const createAlertRoutes = require("./alerts");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function makeModel(items) {
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

describe("Alert explainability route contract", () => {
    test("GET /api/alerts/:id/explainability returns decomposition, evidence path, and narrative sections", async () => {
        const alert = {
            alert_id: "AL-XAI-1",
            pattern_type: "CIRCULAR_TRADING",
            subject_account_id: "ACC-1",
            involved_accounts: ["ACC-1", "ACC-2", "ACC-3"],
            transaction_ids: ["tx-1", "tx-2", "tx-3"],
            risk_score: 86,
            risk_tier: "HIGH",
            confidence_level: "HIGH",
            xai_narrative: "Circular trading loop with linked counterparties.",
            explainability_packet: {
                score_decomposition: {
                    cycle_score: 91,
                    smurfing_score: 30,
                    behavioral_score: 20,
                    geographic_score: 11,
                    cycle_weight: 0.35,
                    smurfing_weight: 0.3,
                    behavioral_weight: 0.2,
                    geographic_weight: 0.15,
                },
                deterministic_evidence: {
                    pattern_type: "CIRCULAR_TRADING",
                    transaction_ids: ["tx-1", "tx-2", "tx-3"],
                    involved_accounts: ["ACC-1", "ACC-2", "ACC-3"],
                    transaction_sequence: [
                        {
                            from: "ACC-1",
                            to: "ACC-2",
                            txId: "tx-1",
                            amount: 1200,
                            timestamp: "2026-04-10T10:00:00.000Z",
                        },
                        {
                            from: "ACC-2",
                            to: "ACC-3",
                            txId: "tx-2",
                            amount: 1200,
                            timestamp: "2026-04-10T10:12:00.000Z",
                        },
                    ],
                    window_metadata: {
                        start_timestamp: "2026-04-10T10:00:00.000Z",
                        end_timestamp: "2026-04-10T10:12:00.000Z",
                        bounded: true,
                    },
                },
                narrative_mapping: {
                    summary: "Cycle evidence dominates the risk signal.",
                    statements: [
                        {
                            claim: "Cycle score dominates weighted contribution.",
                            evidence_refs: {
                                transaction_ids: ["tx-1", "tx-2"],
                                account_ids: ["ACC-1", "ACC-2", "ACC-3"],
                            },
                        },
                    ],
                },
                confidence_level: "HIGH",
            },
        };

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-1", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-1", is_partial: false })) },
            alertModel: makeModel([alert]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/AL-XAI-1/explainability");
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({
                alert_id: "AL-XAI-1",
                risk_tier: "HIGH",
                confidence_level: "HIGH",
                score_decomposition: expect.objectContaining({
                    cycle_score: expect.any(Number),
                    smurfing_score: expect.any(Number),
                    behavioral_score: expect.any(Number),
                    geographic_score: expect.any(Number),
                }),
                evidence_path: expect.objectContaining({
                    involved_accounts: expect.arrayContaining(["ACC-1", "ACC-2", "ACC-3"]),
                    transaction_ids: expect.arrayContaining(["tx-1", "tx-2"]),
                    transaction_sequence: expect.any(Array),
                }),
                narrative: expect.objectContaining({
                    summary: expect.any(String),
                    statements: expect.any(Array),
                    text: expect.any(String),
                }),
            }));
        } finally {
            await server.close();
        }
    });

    test("GET /api/alerts/:id/explainability returns not_found for unknown ids", async () => {
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-1", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-1", is_partial: false })) },
            alertModel: makeModel([]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/missing/explainability");
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: "not_found" });
        } finally {
            await server.close();
        }
    });

    test("POST /api/alerts/:id/sar denies non-privileged roles", async () => {
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "analyst-1", role: "ANALYST" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-1", is_partial: false })) },
            alertModel: makeModel([
                {
                    alert_id: "AL-RESTRICT-1",
                    subject_account_id: "ACC-1",
                    risk_tier: "HIGH",
                },
            ]),
            auditLogger: { log: jest.fn(async () => { }) },
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/AL-RESTRICT-1/sar", {
                method: "POST",
                body: { account: { account_id: "ACC-1" } },
            });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "forbidden" });
        } finally {
            await server.close();
        }
    });
});
