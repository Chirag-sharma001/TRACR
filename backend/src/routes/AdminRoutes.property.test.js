const fc = require("fast-check");
const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

// Feature: intelligent-aml-framework, Property 27: Config Validation Rejects Out-of-Range Values

describe("Admin routes property tests", () => {
    test("out-of-range config updates are rejected and existing value remains unchanged", async () => {
        const state = {
            ctr_threshold: {
                config_key: "ctr_threshold",
                value: 10000,
                valid_range: { min: 1000, max: 100000 },
                save: jest.fn(async function save() {
                    return this;
                }),
            },
        };

        const systemConfigModel = {
            find: () => ({ lean: async () => Object.values(state) }),
            findOne: async ({ config_key }) => state[config_key] || null,
        };

        const thresholdConfig = { reload: jest.fn(async () => { }) };
        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "admin1", role: "ADMIN" };
            next();
        };

        const router = createAdminRoutes({
            jwtMiddleware,
            thresholdConfig,
            systemConfigModel,
            auditLogger: { log: jest.fn(async () => { }) },
            auditLogModel: { find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }), countDocuments: async () => 0 },
        });

        const app = createAppWithJson(router, "/api/admin");
        const server = await startServer(app);

        try {
            await fc.assert(
                fc.asyncProperty(fc.integer({ min: -100000, max: 500000 }), async (candidate) => {
                    const before = state.ctr_threshold.value;
                    const outOfRange = candidate < 1000 || candidate > 100000;
                    if (!outOfRange) {
                        return;
                    }

                    const response = await jsonRequest(server.baseUrl, "/api/admin/config", {
                        method: "PUT",
                        body: [{ config_key: "ctr_threshold", value: candidate }],
                    });

                    expect(response.status).toBe(410);
                    expect(state.ctr_threshold.value).toBe(before);
                }),
                { numRuns: 100 }
            );
        } finally {
            await server.close();
        }
    });

    test("compliance manager can retrieve filtered sensitive audit logs with immutable digest", async () => {
        const capturedQueries = [];
        const auditItems = [
            {
                log_id: "log-1",
                user_id: "investigator-1",
                user_role: "INVESTIGATOR",
                action_type: "CASE_TRANSITION",
                resource_type: "CASE",
                resource_id: "case-1",
                action_timestamp: new Date("2026-04-10T12:00:00.000Z"),
                outcome: "SUCCESS",
                metadata: { to_state: "CLOSED_SAR_FILED" },
                ip_address: "127.0.0.1",
            },
        ];

        const auditLogModel = {
            find: (query) => {
                capturedQueries.push(query);
                return {
                    sort: () => ({
                        skip: () => ({
                            limit: () => ({
                                lean: async () => auditItems,
                            }),
                        }),
                    }),
                };
            },
            countDocuments: async () => auditItems.length,
        };

        const jwtMiddleware = (req, _res, next) => {
            req.user = { user_id: "cm-1", role: "COMPLIANCE_MANAGER" };
            next();
        };

        const router = createAdminRoutes({
            jwtMiddleware,
            thresholdConfig: { reload: jest.fn(async () => { }) },
            systemConfigModel: { find: () => ({ lean: async () => [] }) },
            auditLogger: { log: jest.fn(async () => { }) },
            auditLogModel,
        });

        const app = createAppWithJson(router, "/api/admin");
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/audit/sensitive?limit=10", {
                method: "GET",
            });

            expect(response.status).toBe(200);
            expect(capturedQueries[0].action_type.$in).toContain("SAR_GENERATE");
            expect(response.body.items).toHaveLength(1);
            expect(response.body.items[0].immutable_digest).toEqual(expect.any(String));
            expect(response.body.items[0].action_type).toBe("CASE_TRANSITION");
        } finally {
            await server.close();
        }
    });
});
