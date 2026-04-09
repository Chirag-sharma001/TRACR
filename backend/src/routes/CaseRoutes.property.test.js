const fc = require("fast-check");
const createCaseRoutes = require("./cases");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 24: Case State Machine Validity

describe("Case routes property tests", () => {
    const transitions = {
        OPEN: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["ESCALATED", "CLOSED_DISMISSED"],
        ESCALATED: ["CLOSED_SAR_FILED", "CLOSED_DISMISSED"],
        CLOSED_SAR_FILED: [],
        CLOSED_DISMISSED: [],
    };

    test("only valid transitions are accepted and CLOSED_SAR_FILED requires SAR", async () => {
        const store = new Map();
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "u1", role: "ANALYST" };
            next();
        };

        const caseModel = {
            findOne: async ({ case_id }) => store.get(case_id) || null,
            create: async (doc) => {
                const created = {
                    ...doc,
                    case_id: doc.case_id || crypto.randomUUID(),
                    notes: doc.notes || [],
                    save: async function save() {
                        store.set(this.case_id, this);
                        return this;
                    },
                };
                store.set(created.case_id, created);
                return created;
            },
        };

        const router = createCaseRoutes({
            jwtMiddleware,
            auditLogger: { log: jest.fn(async () => { }) },
            caseModel,
        });

        const app = createAppWithJson(router, "/api/cases");
        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(
                    fc.constantFrom("OPEN", "UNDER_REVIEW", "ESCALATED", "CLOSED_SAR_FILED", "CLOSED_DISMISSED"),
                    fc.constantFrom("OPEN", "UNDER_REVIEW", "ESCALATED", "CLOSED_SAR_FILED", "CLOSED_DISMISSED"),
                    fc.boolean(),
                    fc.constantFrom("HUMAN", "AI", ""),
                    async (fromState, toState, hasSarDraft, decisionSource) => {
                        const id = crypto.randomUUID();
                        store.set(id, {
                            case_id: id,
                            state: fromState,
                            sar_draft_id: hasSarDraft ? "sar-1" : null,
                            state_history: [],
                            notes: [],
                            save: async function save() {
                                store.set(this.case_id, this);
                                return this;
                            },
                        });

                        const response = await jsonRequest(server.baseUrl, `/api/cases/${id}/state`, {
                            method: "PATCH",
                            body: {
                                to_state: toState,
                                reason_code: "TEST",
                                decision_source: decisionSource,
                            },
                        });

                        const validTransition = transitions[fromState].includes(toState);
                        const sarOk = toState !== "CLOSED_SAR_FILED" || hasSarDraft;
                        const regulatedTransition = toState === "CLOSED_SAR_FILED" || toState === "CLOSED_DISMISSED";
                        const humanSourceOk = !regulatedTransition || decisionSource === "HUMAN";
                        const expectedSuccess = validTransition && sarOk && humanSourceOk;

                        if (expectedSuccess) {
                            expect(response.status).toBe(200);
                        } else {
                            expect(response.status).toBe(400);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });

    test("regulated closure transitions reject payloads without decision_source HUMAN", async () => {
        const store = new Map();
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "u1", role: "ANALYST" };
            next();
        };

        const caseModel = {
            findOne: async ({ case_id }) => store.get(case_id) || null,
        };

        const caseId = crypto.randomUUID();
        store.set(caseId, {
            case_id: caseId,
            state: "UNDER_REVIEW",
            sar_draft_id: null,
            state_history: [],
            notes: [],
            save: async function save() {
                store.set(this.case_id, this);
                return this;
            },
        });

        const router = createCaseRoutes({
            jwtMiddleware,
            auditLogger: { log: jest.fn(async () => { }) },
            caseModel,
        });

        const app = createAppWithJson(router, "/api/cases");
        const server = await startServer(app);

        try {
            const missingSource = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/state`, {
                method: "PATCH",
                body: { to_state: "CLOSED_DISMISSED", reason_code: "ANALYST_DISMISSED" },
            });

            const aiSource = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/state`, {
                method: "PATCH",
                body: {
                    to_state: "CLOSED_DISMISSED",
                    reason_code: "ANALYST_DISMISSED",
                    decision_source: "AI",
                },
            });

            const humanSource = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/state`, {
                method: "PATCH",
                body: {
                    to_state: "CLOSED_DISMISSED",
                    reason_code: "ANALYST_DISMISSED",
                    decision_source: "HUMAN",
                },
            });

            expect(missingSource.status).toBe(400);
            expect(aiSource.status).toBe(400);
            expect(humanSource.status).toBe(200);
        } finally {
            await server.close();
        }
    });
});
