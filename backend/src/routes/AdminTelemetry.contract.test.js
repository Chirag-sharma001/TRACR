const createAdminRoutes = require("./admin");
const { createAppWithJson, startServer, jsonRequest } = require("../testUtils/httpHarness");

function createHarness({ role = "ADMIN", telemetryResult, comparisonError = null } = {}) {
    const detectionQualityMetricsService = {
        getDetectionQualityTelemetry: jest.fn(async () => telemetryResult || {
            generated_at: "2026-04-10T12:00:00.000Z",
            windows: {
                daily: [
                    {
                        bucket_start: "2026-04-10T00:00:00.000Z",
                        detectors: {
                            cycle: { total: 2, risk_tiers: { low: 0, medium: 0, high: 2 } },
                            smurfing: { total: 0, risk_tiers: { low: 0, medium: 0, high: 0 } },
                            behavioral: { total: 1, risk_tiers: { low: 1, medium: 0, high: 0 } },
                        },
                        lineage_versions: [
                            { config_version_id: "cfg-v42", published_change_id: "chg-9001", total: 3 },
                        ],
                        total: 3,
                    },
                ],
                weekly: [
                    {
                        bucket_start: "2026-04-07T00:00:00.000Z",
                        detectors: {
                            cycle: { total: 4, risk_tiers: { low: 0, medium: 1, high: 3 } },
                            smurfing: { total: 2, risk_tiers: { low: 1, medium: 1, high: 0 } },
                            behavioral: { total: 3, risk_tiers: { low: 1, medium: 1, high: 1 } },
                        },
                        lineage_versions: [
                            { config_version_id: "cfg-v42", published_change_id: "chg-9001", total: 9 },
                        ],
                        total: 9,
                    },
                ],
            },
        }),
        getDetectionQualityComparisonTelemetry: jest.fn(async () => {
            if (comparisonError) {
                throw comparisonError;
            }

            return {
            generated_at: "2026-04-10T12:00:00.000Z",
            selectors: {
                before: { config_version_id: "cfg-v41", published_change_id: null },
                after: { config_version_id: "cfg-v42", published_change_id: null },
            },
            windows: { day_window_days: 7, week_window_weeks: 4 },
            before: {
                total: 5,
                lineage: { config_version_id: "cfg-v41", published_change_id: "chg-9000" },
                breakdowns: {
                    segment: { retail: { total: 5 } },
                    pattern_type: { CIRCULAR_TRADING: { total: 5 } },
                    confidence_level: { HIGH: { total: 5 } },
                },
            },
            after: {
                total: 8,
                lineage: { config_version_id: "cfg-v42", published_change_id: "chg-9001" },
                breakdowns: {
                    segment: { retail: { total: 8 } },
                    pattern_type: { CIRCULAR_TRADING: { total: 8 } },
                    confidence_level: { HIGH: { total: 8 } },
                },
            },
            delta: { total: 3 },
            };
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
        detectionQualityMetricsService,
    });

    return {
        app: createAppWithJson(router, "/api/admin"),
        detectionQualityMetricsService,
    };
}

describe("Admin DET-03 telemetry contract", () => {
    test("GET /telemetry/detection-quality returns detector/risk/version daily and weekly windows", async () => {
        const { app, detectionQualityMetricsService } = createHarness();
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/telemetry/detection-quality");

            expect(response.status).toBe(200);
            expect(detectionQualityMetricsService.getDetectionQualityTelemetry).toHaveBeenCalledWith({
                day_window_days: 7,
                week_window_weeks: 4,
            });

            expect(response.body).toEqual(expect.objectContaining({
                generated_at: expect.any(String),
                windows: expect.objectContaining({
                    daily: expect.any(Array),
                    weekly: expect.any(Array),
                }),
            }));

            const daily = response.body.windows.daily[0];
            expect(daily).toEqual(expect.objectContaining({
                detectors: expect.objectContaining({
                    cycle: expect.objectContaining({ risk_tiers: expect.any(Object) }),
                    smurfing: expect.objectContaining({ risk_tiers: expect.any(Object) }),
                    behavioral: expect.objectContaining({ risk_tiers: expect.any(Object) }),
                }),
                lineage_versions: expect.any(Array),
            }));
        } finally {
            await server.close();
        }
    });

    test("GET /telemetry/detection-quality denies non-admin users", async () => {
        const { app, detectionQualityMetricsService } = createHarness({ role: "ANALYST" });
        const server = await startServer(app);

        try {
            const response = await jsonRequest(server.baseUrl, "/api/admin/telemetry/detection-quality");

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "forbidden" });
            expect(detectionQualityMetricsService.getDetectionQualityTelemetry).not.toHaveBeenCalled();
        } finally {
            await server.close();
        }
    });

    test("GET /telemetry/detection-quality/compare returns before/after/delta contract", async () => {
        const { app, detectionQualityMetricsService } = createHarness();
        const server = await startServer(app);

        try {
            const response = await jsonRequest(
                server.baseUrl,
                "/api/admin/telemetry/detection-quality/compare?before_config_version_id=cfg-v41&after_config_version_id=cfg-v42&day_window_days=7&week_window_weeks=4"
            );

            expect(response.status).toBe(200);
            expect(detectionQualityMetricsService.getDetectionQualityComparisonTelemetry).toHaveBeenCalledWith({
                before_config_version_id: "cfg-v41",
                after_config_version_id: "cfg-v42",
                before_published_change_id: null,
                after_published_change_id: null,
                day_window_days: 7,
                week_window_weeks: 4,
            });
            expect(response.body).toEqual(expect.objectContaining({
                generated_at: expect.any(String),
                before: expect.any(Object),
                after: expect.any(Object),
                delta: expect.any(Object),
            }));
        } finally {
            await server.close();
        }
    });

    test("GET /telemetry/detection-quality/compare denies non-admin users", async () => {
        const { app, detectionQualityMetricsService } = createHarness({ role: "ANALYST" });
        const server = await startServer(app);

        try {
            const response = await jsonRequest(
                server.baseUrl,
                "/api/admin/telemetry/detection-quality/compare?before_config_version_id=cfg-v41&after_config_version_id=cfg-v42"
            );

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: "forbidden" });
            expect(detectionQualityMetricsService.getDetectionQualityComparisonTelemetry).not.toHaveBeenCalled();
        } finally {
            await server.close();
        }
    });

    test("GET /telemetry/detection-quality/compare returns telemetry_failed on service errors", async () => {
        const { app } = createHarness({ comparisonError: new Error("aggregation_boom") });
        const server = await startServer(app);

        try {
            const response = await jsonRequest(
                server.baseUrl,
                "/api/admin/telemetry/detection-quality/compare?before_config_version_id=cfg-v41&after_config_version_id=cfg-v42"
            );

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: "telemetry_failed" });
        } finally {
            await server.close();
        }
    });
});
