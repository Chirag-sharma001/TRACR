const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function createHarness() {
    const configGovernanceService = {
        submitChange: jest.fn(async (payload) => ({
            _id: "chg-1",
            status: "DRAFT",
            metadata: {
                requester_id: payload.requester_id,
                reason: payload.reason,
            },
            requested_config: payload.requested_config,
        })),
        approveChange: jest.fn(async ({ change_id }) => ({ _id: change_id, status: "APPROVED" })),
        activateApprovedChange: jest.fn(async ({ change_id }) => ({ _id: change_id, status: "ACTIVE" })),
    };

    const jwtMiddleware = (req, _res, next) => {
        req.user = { user_id: "admin-1", role: "ADMIN" };
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
        auditLogger: { log: jest.fn(async () => { }) },
        configGovernanceService,
    });

    return { app: createAppWithJson(router, "/api/admin"), configGovernanceService };
}

describe("Admin governance lifecycle routes", () => {
    test("POST /config/changes creates draft request with required metadata", async () => {
        const { app, configGovernanceService } = createHarness();
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/config/changes", {
                method: "POST",
                body: {
                    reason: "Tune cycle detector",
                    change_scope: ["threshold"],
                    detector_scope: ["cycle"],
                    risk_scope: ["high"],
                    requested_config: { config_key: "cycle_threshold", value: 75 },
                },
            });

            expect(response.status).toBe(201);
            expect(configGovernanceService.submitChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    requester_id: "admin-1",
                    reason: "Tune cycle detector",
                    change_scope: ["threshold"],
                    detector_scope: ["cycle"],
                    risk_scope: ["high"],
                })
            );
        } finally {
            await server.close();
        }
    });

    test("POST /config/changes/:id/approve enforces requester != approver", async () => {
        const { app, configGovernanceService } = createHarness();
        configGovernanceService.approveChange.mockRejectedValueOnce(new Error("self_approval_forbidden"));
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-1/approve", {
                method: "POST",
                body: { note: "dual control" },
            });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "self_approval_forbidden" });
        } finally {
            await server.close();
        }
    });

    test("POST /config/changes/:id/activate rejects unapproved request", async () => {
        const { app, configGovernanceService } = createHarness();
        configGovernanceService.activateApprovedChange.mockRejectedValueOnce(new Error("approval_required"));
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/config/changes/chg-1/activate", {
                method: "POST",
                body: { note: "release" },
            });

            expect(response.status).toBe(409);
            expect(response.body).toEqual({ error: "approval_required" });
        } finally {
            await server.close();
        }
    });
});