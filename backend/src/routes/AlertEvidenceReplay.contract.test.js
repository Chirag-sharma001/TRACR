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

describe("Alert evidence replay route contract", () => {
    test("GET /api/alerts/:id/evidence-replay returns timeline ordered by timestamp", async () => {
        const alert = {
            alert_id: "AL-REPLAY-1",
            pattern_type: "CIRCULAR_TRADING",
            involved_accounts: ["A1", "A2", "A3"],
            transaction_ids: ["tx-1", "tx-2", "tx-3"],
            explainability_packet: {
                deterministic_evidence: {
                    pattern_type: "CIRCULAR_TRADING",
                    involved_accounts: ["A1", "A2", "A3"],
                    transaction_ids: ["tx-1", "tx-2", "tx-3"],
                    transaction_sequence: [
                        { from: "A2", to: "A3", txId: "tx-2", amount: 400, timestamp: "2026-04-10T10:20:00.000Z" },
                        { from: "A1", to: "A2", txId: "tx-1", amount: 400, timestamp: "2026-04-10T10:00:00.000Z" },
                        { from: "A3", to: "A1", txId: "tx-3", amount: 400, timestamp: "2026-04-10T10:50:00.000Z" },
                    ],
                    window_metadata: {
                        start_timestamp: "2026-04-10T10:00:00.000Z",
                        end_timestamp: "2026-04-10T10:50:00.000Z",
                        bounded: true,
                    },
                },
            },
        };

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-2", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-2", is_partial: false })) },
            alertModel: makeModel([alert]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/AL-REPLAY-1/evidence-replay");
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({
                alert_id: "AL-REPLAY-1",
                pattern_type: "CIRCULAR_TRADING",
                replay: expect.objectContaining({
                    timeline: expect.any(Array),
                    involved_accounts: expect.arrayContaining(["A1", "A2", "A3"]),
                }),
            }));

            const timeline = response.body.replay.timeline;
            expect(timeline).toHaveLength(3);
            expect(timeline.map((step) => step.transaction_id)).toEqual(["tx-1", "tx-2", "tx-3"]);
            expect(timeline.every((step, index) => step.index === index + 1)).toBe(true);
            expect(timeline.every((step) => step.source === "sequence")).toBe(true);
        } finally {
            await server.close();
        }
    });

    test("GET /api/alerts/:id/evidence-replay synthesizes fallback timeline from transaction_ids", async () => {
        const alert = {
            alert_id: "AL-REPLAY-2",
            pattern_type: "SMURFING",
            involved_accounts: ["S-1"],
            transaction_ids: ["t-3", "t-1", "t-2"],
            explainability_packet: {
                deterministic_evidence: {
                    pattern_type: "SMURFING",
                    involved_accounts: ["S-1"],
                    transaction_ids: ["t-3", "t-1", "t-2"],
                    transaction_sequence: [],
                    window_metadata: null,
                },
            },
        };

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-2", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-2", is_partial: false })) },
            alertModel: makeModel([alert]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/AL-REPLAY-2/evidence-replay");
            expect(response.status).toBe(200);

            const timeline = response.body.replay.timeline;
            expect(timeline.map((step) => step.transaction_id)).toEqual(["t-1", "t-2", "t-3"]);
            expect(timeline.every((step) => step.source === "transaction_ids")).toBe(true);
        } finally {
            await server.close();
        }
    });

    test("GET /api/alerts/:id/evidence-replay returns not_found when alert does not exist", async () => {
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "investigator-2", role: "INVESTIGATOR" };
            next();
        };

        const router = createAlertRoutes({
            jwtMiddleware,
            sarService: { generateSAR: jest.fn(async () => ({ sar_id: "sar-2", is_partial: false })) },
            alertModel: makeModel([]),
        });

        const app = createAppWithJson(router, "/api/alerts");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/alerts/nope/evidence-replay");
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: "not_found" });
        } finally {
            await server.close();
        }
    });
});
