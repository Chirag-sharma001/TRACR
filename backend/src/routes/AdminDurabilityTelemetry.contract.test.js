const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function createHarness({ role = "ADMIN", telemetryResult } = {}) {
    const durabilityHealthMetricsService = {
        getDurabilityHealth: jest.fn(async () => telemetryResult || {
            generated_at: "2026-04-10T12:00:00.000Z",
            failed_backlog_total: 2,
            failed_oldest_age_seconds: 120,
            replayed_last_24h: 5,
            failed_last_24h: 4,
            window_bounds: {
                day_window_days: 7,
                week_window_weeks: 4,
            },
        }),
    };

    const jwtMiddleware = (req, _res, next) => {
        req.user = { user_id: "actor-1", role };
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
        configGovernanceService: {
            submitChange: jest.fn(async () => ({})),
            approveChange: jest.fn(async () => ({})),
            activateApprovedChange: jest.fn(async () => ({})),
            rollbackChange: jest.fn(async () => ({})),
        },
        detectionQualityMetricsService: {
            getDetectionQualityTelemetry: jest.fn(async () => ({ generated_at: "2026-04-10T12:00:00.000Z", windows: { daily: [], weekly: [] } })),
        },
        durabilityHealthMetricsService,
    });

    return {
        app: createAppWithJson(router, "/api/admin"),
        durabilityHealthMetricsService,
    };
}

describe("Admin DET-02 processing durability telemetry contract", () => {
    test("GET /telemetry/processing-durability returns bounded durability metrics schema", async () => {
        const { app, durabilityHealthMetricsService } = createHarness();
        const server = await startServer(app);

        try {
            const response = await jsonRequest(
                server.baseUrl,
                "/api/admin/telemetry/processing-durability?day_window_days=999&week_window_weeks=0"
            );

            expect(response.status).toBe(200);
            expect(durabilityHealthMetricsService.getDurabilityHealth).toHaveBeenCalledWith({
                day_window_days: 31,
                week_window_weeks: 1,
            });

            expect(response.body).toEqual(expect.objectContaining({
                generated_at: expect.any(String),
                failed_backlog_total: expect.any(Number),
                failed_oldest_age_seconds: expect.any(Number),
                replayed_last_24h: expect.any(Number),
                failed_last_24h: expect.any(Number),
                window_bounds: expect.objectContaining({
                    day_window_days: expect.any(Number),
                    week_window_weeks: expect.any(Number),
                }),
            }));
        } finally {
            await server.close();
        }
    });

    test("GET /telemetry/processing-durability denies non-admin users", async () => {
        const { app, durabilityHealthMetricsService } = createHarness({ role: "ANALYST" });
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/telemetry/processing-durability");

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "forbidden" });
            expect(durabilityHealthMetricsService.getDurabilityHealth).not.toHaveBeenCalled();
        } finally {
            await server.close();
        }
    });
});
