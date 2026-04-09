const fc = require("fast-check");
const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function makeAuditCollector() {
    const entries = [];
    return {
        entries,
        logger: {
            log: jest.fn(async (event) => {
                entries.push(event);
                return event;
            }),
        },
    };
}

function createHarness({ configGovernanceService, auditLogger }) {
    const jwtMiddleware = (req, _res, next) => {
        req.user = { user_id: "admin-7", role: "ADMIN" };
        next();
    };

    const router = createAdminRoutes({
        jwtMiddleware,
        thresholdConfig: { reload: jest.fn(async () => { }) },
        systemConfigModel: { find: () => ({ lean: async () => [] }) },
        auditLogModel: {
            find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }),
            countDocuments: async () => 0,
        },
        configGovernanceService,
        auditLogger,
    });

    return createAppWithJson(router, "/api/admin");
}

describe("Admin governance contract property tests", () => {
    test("rollback requires rollback_reason and original_change_id", async () => {
        const configGovernanceService = {
            rollbackChange: jest.fn(async () => ({ _id: "chg-2", status: "ROLLED_BACK" })),
        };

        const app = createHarness({
            configGovernanceService,
            auditLogger: { log: jest.fn(async () => { }) },
        });

        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.boolean(), fc.boolean(), async (includeReason, includeOriginalId) => {
                    if (includeReason && includeOriginalId) {
                        return;
                    }

                    const body = {};
                    if (includeReason) body.rollback_reason = "emergency rollback";
                    if (includeOriginalId) body.original_change_id = "chg-1";

                    const response = await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-2/rollback", {
                        method: "POST",
                        body,
                    });

                    expect(response.status).toBe(400);
                    expect(configGovernanceService.rollbackChange).not.toHaveBeenCalled();
                }),
                { numRuns: 40 }
            );
        } finally {
            await server.close();
        }
    });

    test("submit/approve/activate/rollback writes append-only governance audit records", async () => {
        const { entries, logger } = makeAuditCollector();
        const configGovernanceService = {
            submitChange: jest.fn(async () => ({ _id: "chg-1", status: "DRAFT" })),
            approveChange: jest.fn(async () => ({ _id: "chg-1", status: "APPROVED" })),
            activateApprovedChange: jest.fn(async () => ({ _id: "chg-1", status: "ACTIVE" })),
            rollbackChange: jest.fn(async () => ({ _id: "chg-1", status: "ROLLED_BACK" })),
        };

        const app = createHarness({ configGovernanceService, auditLogger: logger });
        const server = await startServer(app);

        try {
            const before = entries.length;

            await jsonRequest(server.baseUrl, "/api/admin/config/changes", {
                method: "POST",
                body: {
                    reason: "adjust cycle threshold",
                    change_scope: ["threshold"],
                    detector_scope: ["cycle"],
                    risk_scope: ["high"],
                    requested_config: { config_key: "cycle_threshold", value: 70 },
                },
            });

            await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-1/approve", {
                method: "POST",
                body: { note: "approved by peer" },
            });

            await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-1/activate", {
                method: "POST",
                body: { note: "activate" },
            });

            await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-1/rollback", {
                method: "POST",
                body: { rollback_reason: "bad tuning", original_change_id: "chg-prev" },
            });

            expect(entries.length).toBe(before + 4);
            expect(entries.map((event) => event.actionType)).toEqual([
                "CONFIG_SUBMIT",
                "CONFIG_APPROVE",
                "CONFIG_ACTIVATE",
                "CONFIG_ROLLBACK",
            ]);
            expect(entries[3].metadata).toEqual(
                expect.objectContaining({
                    rollback_reason: "bad tuning",
                    original_change_id: "chg-prev",
                })
            );
        } finally {
            await server.close();
        }
    });
});