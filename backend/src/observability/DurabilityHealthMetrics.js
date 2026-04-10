const ProcessingFailure = require("../models/ProcessingFailure");
const ProcessingLedger = require("../models/ProcessingLedger");

function toBoundedWindow(value, fallback, min, max) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(max, Math.max(min, safeValue));
}

class DurabilityHealthMetrics {
    constructor({
        processingFailureModel = ProcessingFailure,
        processingLedgerModel = ProcessingLedger,
        now = () => new Date(),
    } = {}) {
        this.processingFailureModel = processingFailureModel;
        this.processingLedgerModel = processingLedgerModel;
        this.now = now;
    }

    async getDurabilityHealth({ day_window_days = 7, week_window_weeks = 4 } = {}) {
        const now = this.now();
        const boundedDayWindow = toBoundedWindow(day_window_days, 7, 1, 31);
        const boundedWeekWindow = toBoundedWindow(week_window_weeks, 4, 1, 12);
        const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const [failedBacklogTotal, oldestFailure, replayedLast24h, failedLast24h] = await Promise.all([
            this.processingFailureModel.countDocuments({ replayed_at: null }),
            this.processingFailureModel.findOne({ replayed_at: null }).sort({ failed_at: 1 }).lean(),
            this.processingLedgerModel.countDocuments({
                status: "PROCESSED",
                processed_at: { $gte: last24Hours, $lte: now },
            }),
            this.processingLedgerModel.countDocuments({
                status: "FAILED",
                failed_at: { $gte: last24Hours, $lte: now },
            }),
        ]);

        const oldestFailedAt = oldestFailure?.failed_at ? new Date(oldestFailure.failed_at).getTime() : null;
        const oldestAgeSeconds = oldestFailedAt
            ? Math.max(0, Math.floor((now.getTime() - oldestFailedAt) / 1000))
            : 0;

        return {
            generated_at: now.toISOString(),
            failed_backlog_total: Number(failedBacklogTotal || 0),
            failed_oldest_age_seconds: oldestAgeSeconds,
            replayed_last_24h: Number(replayedLast24h || 0),
            failed_last_24h: Number(failedLast24h || 0),
            window_bounds: {
                day_window_days: boundedDayWindow,
                week_window_weeks: boundedWeekWindow,
            },
        };
    }
}

module.exports = DurabilityHealthMetrics;
