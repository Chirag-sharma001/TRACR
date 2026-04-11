const DurabilityHealthMetrics = require("./DurabilityHealthMetrics");

describe("DurabilityHealthMetrics", () => {
    test("returns failed backlog, replay throughput, oldest failure age, and bounded windows", async () => {
        const processingFailureModel = {
            countDocuments: jest.fn(async (query) => {
                if (query && query.replayed_at === null) {
                    return 3;
                }
                return 0;
            }),
            findOne: jest.fn(() => ({
                sort: jest.fn(() => ({
                    lean: jest.fn(async () => ({
                        failed_at: new Date("2026-04-10T10:00:00.000Z"),
                    })),
                })),
            })),
        };

        const processingLedgerModel = {
            countDocuments: jest.fn(async (query) => {
                if (query && query.status === "PROCESSED") {
                    return 8;
                }
                if (query && query.status === "FAILED") {
                    return 5;
                }
                return 0;
            }),
        };

        const service = new DurabilityHealthMetrics({
            processingFailureModel,
            processingLedgerModel,
            now: () => new Date("2026-04-10T12:00:00.000Z"),
        });

        const telemetry = await service.getDurabilityHealth({
            day_window_days: 99,
            week_window_weeks: 0,
        });

        expect(telemetry).toEqual(expect.objectContaining({
            failed_backlog_total: 3,
            failed_oldest_age_seconds: 7200,
            replayed_last_24h: 8,
            failed_last_24h: 5,
            window_bounds: {
                day_window_days: 31,
                week_window_weeks: 1,
            },
        }));
    });

    test("returns stable zeroed shape when there is no backlog", async () => {
        const service = new DurabilityHealthMetrics({
            processingFailureModel: {
                countDocuments: jest.fn(async () => 0),
                findOne: jest.fn(() => ({
                    sort: jest.fn(() => ({
                        lean: jest.fn(async () => null),
                    })),
                })),
            },
            processingLedgerModel: {
                countDocuments: jest.fn(async () => 0),
            },
            now: () => new Date("2026-04-10T12:00:00.000Z"),
        });

        const telemetry = await service.getDurabilityHealth({
            day_window_days: 7,
            week_window_weeks: 4,
        });

        expect(telemetry).toEqual({
            generated_at: "2026-04-10T12:00:00.000Z",
            failed_backlog_total: 0,
            failed_oldest_age_seconds: 0,
            replayed_last_24h: 0,
            failed_last_24h: 0,
            window_bounds: {
                day_window_days: 7,
                week_window_weeks: 4,
            },
        });
    });
});
