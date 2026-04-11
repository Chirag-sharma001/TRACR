const crypto = require("crypto");
const createCaseRoutes = require("./cases");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function createMemoryCaseModel(initialCases = []) {
    const store = new Map();

    const hydrate = (doc) => {
        const created = {
            case_id: doc.case_id || crypto.randomUUID(),
            alert_id: doc.alert_id || "alert-1",
            subject_account_id: doc.subject_account_id || "acct-1",
            state: doc.state || "OPEN",
            state_history: doc.state_history || [],
            notes: doc.notes || [],
            sar_draft_id: doc.sar_draft_id || null,
            assigned_to: doc.assigned_to || null,
            sla_started_at: doc.sla_started_at || null,
            sla_due_at: doc.sla_due_at || null,
            escalation_state: doc.escalation_state || "ON_TRACK",
            sar_deadline_at: doc.sar_deadline_at || null,
            no_file_rationale: doc.no_file_rationale || null,
            created_at: doc.created_at || new Date(),
            updated_at: doc.updated_at || new Date(),
            save: async function save() {
                this.updated_at = new Date();
                store.set(this.case_id, this);
                return this;
            },
        };

        store.set(created.case_id, created);
        return created;
    };

    initialCases.forEach((doc) => hydrate(doc));

    return {
        findOne: async ({ case_id }) => store.get(case_id) || null,
        find: async () => Array.from(store.values()),
        create: async (doc) => hydrate(doc),
    };
}

function buildAlertModel(alerts = []) {
    return {
        findOne: ({ alert_id }) => ({
            lean: async () => alerts.find((item) => item.alert_id === alert_id) || null,
        }),
    };
}

function buildSarDraftModel(drafts = []) {
    return {
        findOne: ({ sar_id }) => ({
            lean: async () => drafts.find((item) => item.sar_id === sar_id) || null,
        }),
    };
}

function buildServer(caseModel, options = {}) {
    const jwtMiddleware = (req, _res, next) => {
        req.user = {
            user_id: req.headers["x-user-id"] || "investigator-1",
            role: req.headers["x-role"] || "INVESTIGATOR",
        };
        next();
    };

    const router = createCaseRoutes({
        jwtMiddleware,
        auditLogger: { log: jest.fn(async () => { }) },
        caseModel,
        alertModel: options.alertModel,
        sarDraftModel: options.sarDraftModel,
        sarService: options.sarService,
    });

    const app = createAppWithJson(router, "/api/cases");
    return startServer(app);
}

describe("Case workflow contracts", () => {
    test("claiming ownership starts SLA timers automatically", async () => {
        const caseId = crypto.randomUUID();
        const caseModel = createMemoryCaseModel([{ case_id: caseId, assigned_to: null }]);
        const server = await buildServer(caseModel);

        try {
            const response = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/claim`, {
                method: "POST",
                headers: { "x-user-id": "investigator-22" },
            });

            expect(response.status).toBe(200);
            expect(response.body.assigned_to).toBe("investigator-22");
            expect(response.body.sla_started_at).toBeTruthy();
            expect(response.body.sla_due_at).toBeTruthy();
            expect(response.body.escalation_state).toBe("ON_TRACK");
        } finally {
            await server.close();
        }
    });

    test("assignment sets assignee and SLA due window", async () => {
        const caseId = crypto.randomUUID();
        const caseModel = createMemoryCaseModel([{ case_id: caseId, assigned_to: null }]);
        const server = await buildServer(caseModel);

        try {
            const response = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/assignment`, {
                method: "PATCH",
                body: { assigned_to: "investigator-9" },
            });

            expect(response.status).toBe(200);
            expect(response.body.assigned_to).toBe("investigator-9");

            const startedAtMs = new Date(response.body.sla_started_at).getTime();
            const dueAtMs = new Date(response.body.sla_due_at).getTime();
            expect(dueAtMs - startedAtMs).toBe(24 * 60 * 60 * 1000);
        } finally {
            await server.close();
        }
    });

    test("manager dashboard returns backlog and escalation triage metrics", async () => {
        const now = Date.now();
        const caseModel = createMemoryCaseModel([
            {
                case_id: "c-breached",
                state: "UNDER_REVIEW",
                assigned_to: "investigator-a",
                sla_started_at: new Date(now - 26 * 60 * 60 * 1000),
                sla_due_at: new Date(now - 2 * 60 * 60 * 1000),
                created_at: new Date(now - 30 * 60 * 60 * 1000),
            },
            {
                case_id: "c-risk",
                state: "OPEN",
                assigned_to: "investigator-b",
                sla_started_at: new Date(now - 22 * 60 * 60 * 1000),
                sla_due_at: new Date(now + 2 * 60 * 60 * 1000),
                created_at: new Date(now - 22 * 60 * 60 * 1000),
            },
            {
                case_id: "c-track",
                state: "OPEN",
                assigned_to: "investigator-c",
                sla_started_at: new Date(now - 2 * 60 * 60 * 1000),
                sla_due_at: new Date(now + 12 * 60 * 60 * 1000),
                created_at: new Date(now - 8 * 60 * 60 * 1000),
            },
            {
                case_id: "c-unassigned",
                state: "OPEN",
                assigned_to: null,
                created_at: new Date(now - 4 * 60 * 60 * 1000),
            },
            {
                case_id: "c-closed",
                state: "CLOSED_DISMISSED",
                assigned_to: "investigator-z",
                no_file_rationale: "No suspicious pattern remained after review",
                created_at: new Date(now - 48 * 60 * 60 * 1000),
            },
        ]);

        const server = await buildServer(caseModel);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/cases/oversight/dashboard?limit=3", {
                method: "GET",
                headers: { "x-role": "MANAGER" },
            });

            expect(response.status).toBe(200);
            expect(response.body.summary.total_active).toBe(4);
            expect(response.body.summary.unassigned_count).toBe(1);
            expect(response.body.summary.breached_count).toBe(1);
            expect(response.body.summary.at_risk_count).toBe(1);
            expect(response.body.summary.on_track_count).toBe(2);
            expect(response.body.backlog).toHaveLength(3);
            expect(response.body.backlog[0].case_id).toBe("c-breached");
            expect(response.body.backlog[0].escalation_state).toBe("BREACHED");
        } finally {
            await server.close();
        }
    });

    test("non-manager role is forbidden from oversight dashboard", async () => {
        const caseModel = createMemoryCaseModel([]);
        const server = await buildServer(caseModel);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/cases/oversight/dashboard", {
                method: "GET",
                headers: { "x-role": "ANALYST" },
            });

            expect(response.status).toBe(403);
            expect(response.body.error).toBe("forbidden");
        } finally {
            await server.close();
        }
    });

    test("no-file closure requires documented rationale", async () => {
        const caseId = crypto.randomUUID();
        const caseModel = createMemoryCaseModel([
            {
                case_id: caseId,
                state: "UNDER_REVIEW",
                sar_draft_id: null,
                state_history: [],
            },
        ]);
        const server = await buildServer(caseModel);

        try {
            const missingRationale = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/state`, {
                method: "PATCH",
                body: {
                    to_state: "CLOSED_DISMISSED",
                    reason_code: "ANALYST_NO_FILE",
                    decision_source: "HUMAN",
                },
            });

            const validRationale = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/state`, {
                method: "PATCH",
                body: {
                    to_state: "CLOSED_DISMISSED",
                    reason_code: "ANALYST_NO_FILE",
                    decision_source: "HUMAN",
                    no_file_rationale: "Transactions were explained by known payroll batch activity.",
                },
            });

            expect(missingRationale.status).toBe(400);
            expect(missingRationale.body.error).toBe("no_file_rationale_required");
            expect(validRationale.status).toBe(200);
            expect(validRationale.body.no_file_rationale).toContain("payroll batch activity");
        } finally {
            await server.close();
        }
    });

    test("case SAR draft generation is evidence-grounded and links draft to case", async () => {
        const caseId = crypto.randomUUID();
        const caseModel = createMemoryCaseModel([
            {
                case_id: caseId,
                alert_id: "alert-6-1",
                state: "ESCALATED",
                state_history: [],
            },
        ]);

        const sarService = {
            generateSAR: jest.fn(async () => ({
                sar_id: "sar-generated-1",
                is_partial: false,
                evidence_trace: {
                    alert_id: "alert-6-1",
                    case_id: caseId,
                    account_id: "acct-6",
                    transaction_ids: ["tx-a", "tx-b"],
                },
            })),
            evaluateDraftQuality: jest.fn(),
        };

        const server = await buildServer(caseModel, {
            alertModel: buildAlertModel([
                {
                    alert_id: "alert-6-1",
                    subject_account_id: "acct-6",
                    transaction_ids: ["tx-a", "tx-b"],
                },
            ]),
            sarService,
        });

        try {
            const response = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/sar/draft`, {
                method: "POST",
                headers: { "x-role": "INVESTIGATOR", "x-user-id": "investigator-77" },
                body: { account: { account_id: "acct-6" } },
            });

            expect(response.status).toBe(202);
            expect(response.body.sar_id).toBe("sar-generated-1");
            expect(response.body.evidence_trace).toEqual(
                expect.objectContaining({
                    alert_id: "alert-6-1",
                    case_id: caseId,
                })
            );
            expect(sarService.generateSAR).toHaveBeenCalledWith(
                expect.objectContaining({
                    generatedBy: "investigator-77",
                    caseId,
                })
            );

            const persisted = await caseModel.findOne({ case_id: caseId });
            expect(persisted.sar_draft_id).toBe("sar-generated-1");
        } finally {
            await server.close();
        }
    });

    test("SAR quality check returns deterministic readiness and issue list", async () => {
        const caseId = crypto.randomUUID();
        const caseModel = createMemoryCaseModel([
            {
                case_id: caseId,
                alert_id: "alert-6-2",
                state: "ESCALATED",
                sar_draft_id: "sar-qual-1",
                state_history: [],
            },
        ]);

        const sarService = {
            generateSAR: jest.fn(),
            evaluateDraftQuality: jest.fn(() => ({
                ready_to_file: false,
                quality_score: 60,
                issues: [
                    {
                        code: "activity_narrative_insufficient",
                        severity: "ERROR",
                        message: "activity_narrative must be at least 60 characters.",
                    },
                ],
            })),
        };

        const server = await buildServer(caseModel, {
            sarDraftModel: buildSarDraftModel([
                {
                    sar_id: "sar-qual-1",
                    subject_summary: "Short",
                    activity_narrative: "Too short",
                    transaction_timeline: [],
                    risk_indicators: [],
                    recommended_filing_category: "",
                },
            ]),
            sarService,
        });

        try {
            const response = await jsonRequest(server.baseUrl, `/api/cases/${caseId}/sar/quality-check`, {
                method: "POST",
                headers: { "x-role": "INVESTIGATOR", "x-user-id": "investigator-11" },
            });

            expect(response.status).toBe(200);
            expect(response.body.sar_id).toBe("sar-qual-1");
            expect(response.body.quality.ready_to_file).toBe(false);
            expect(response.body.quality.quality_score).toBe(60);
            expect(response.body.quality.issues).toHaveLength(1);
            expect(sarService.evaluateDraftQuality).toHaveBeenCalledTimes(1);
        } finally {
            await server.close();
        }
    });

    test("SAR deadline dashboard returns upcoming, at-risk, and breached buckets", async () => {
        const now = Date.now();
        const caseModel = createMemoryCaseModel([
            {
                case_id: "sar-breached",
                alert_id: "alert-a",
                state: "ESCALATED",
                sar_deadline_at: new Date(now - 2 * 60 * 60 * 1000),
                assigned_to: "investigator-a",
            },
            {
                case_id: "sar-risk",
                alert_id: "alert-b",
                state: "UNDER_REVIEW",
                sar_deadline_at: new Date(now + 6 * 60 * 60 * 1000),
                assigned_to: "investigator-b",
            },
            {
                case_id: "sar-upcoming",
                alert_id: "alert-c",
                state: "OPEN",
                sar_deadline_at: new Date(now + 40 * 60 * 60 * 1000),
                assigned_to: "investigator-c",
            },
            {
                case_id: "sar-ontrack",
                alert_id: "alert-d",
                state: "OPEN",
                sar_deadline_at: new Date(now + 9 * 24 * 60 * 60 * 1000),
                assigned_to: "investigator-d",
            },
        ]);

        const server = await buildServer(caseModel);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/cases/sar/deadlines?limit=10", {
                method: "GET",
                headers: { "x-role": "COMPLIANCE_MANAGER" },
            });

            expect(response.status).toBe(200);
            expect(response.body.summary.total_active).toBe(4);
            expect(response.body.summary.breached_count).toBe(1);
            expect(response.body.summary.at_risk_count).toBe(1);
            expect(response.body.summary.upcoming_count).toBe(1);
            expect(response.body.items[0].case_id).toBe("sar-breached");
            expect(response.body.items.map((item) => item.case_id)).not.toContain("sar-ontrack");
        } finally {
            await server.close();
        }
    });
});
