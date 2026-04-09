const Alert = require("../models/Alert");

const DETECTOR_MAP = {
    CIRCULAR_TRADING: "cycle",
    SMURFING: "smurfing",
    BEHAVIORAL_ANOMALY: "behavioral",
};

const RISK_MAP = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
};

function createDetectorBucket() {
    return {
        cycle: { total: 0, risk_tiers: { low: 0, medium: 0, high: 0 } },
        smurfing: { total: 0, risk_tiers: { low: 0, medium: 0, high: 0 } },
        behavioral: { total: 0, risk_tiers: { low: 0, medium: 0, high: 0 } },
    };
}

class DetectionQualityMetrics {
    constructor({ alertModel = Alert, now = () => new Date() } = {}) {
        this.alertModel = alertModel;
        this.now = now;
    }

    async getDetectionQualityTelemetry({ day_window_days = 7, week_window_weeks = 4 } = {}) {
        const now = this.now();
        const normalizedDayWindow = Math.min(31, Math.max(1, Number(day_window_days || 7)));
        const normalizedWeekWindow = Math.min(12, Math.max(1, Number(week_window_weeks || 4)));

        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayStart.setUTCDate(dayStart.getUTCDate() - (normalizedDayWindow - 1));

        const weekStart = this.#startOfIsoWeek(now);
        weekStart.setUTCDate(weekStart.getUTCDate() - ((normalizedWeekWindow - 1) * 7));

        const [dailyRows, weeklyRows] = await Promise.all([
            this.#aggregateByWindow("day", dayStart, now),
            this.#aggregateByWindow("week", weekStart, now),
        ]);

        return {
            generated_at: now.toISOString(),
            windows: {
                daily: this.#normalizeRows(dailyRows),
                weekly: this.#normalizeRows(weeklyRows),
            },
        };
    }

    async #aggregateByWindow(unit, start, end) {
        return this.alertModel.aggregate([
            {
                $match: {
                    created_at: {
                        $gte: start,
                        $lte: end,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        bucket: {
                            unit,
                            start: {
                                $dateTrunc: {
                                    date: "$created_at",
                                    unit,
                                    startOfWeek: "monday",
                                    timezone: "UTC",
                                },
                            },
                        },
                        bucket_start: {
                            $dateTrunc: {
                                date: "$created_at",
                                unit,
                                startOfWeek: "monday",
                                timezone: "UTC",
                            },
                        },
                        pattern_type: "$pattern_type",
                        risk_tier: "$risk_tier",
                        config_version_id: "$config_version_id",
                        published_change_id: "$published_change_id",
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: {
                    "_id.bucket_start": 1,
                },
            },
        ]);
    }

    #normalizeRows(rows) {
        const byBucket = new Map();

        for (const row of rows || []) {
            const bucketStart = row?._id?.bucket_start;
            if (!bucketStart) {
                continue;
            }

            const bucketKey = new Date(bucketStart).toISOString();
            if (!byBucket.has(bucketKey)) {
                byBucket.set(bucketKey, {
                    bucket_start: bucketKey,
                    detectors: createDetectorBucket(),
                    lineage_versions: new Map(),
                    total: 0,
                });
            }

            const count = Number(row.count || 0);
            const entry = byBucket.get(bucketKey);
            entry.total += count;

            const detectorKey = DETECTOR_MAP[row?._id?.pattern_type] || null;
            const riskKey = RISK_MAP[row?._id?.risk_tier] || null;

            if (detectorKey && riskKey) {
                entry.detectors[detectorKey].total += count;
                entry.detectors[detectorKey].risk_tiers[riskKey] += count;
            }

            const lineageKey = `${row?._id?.config_version_id || "null"}|${row?._id?.published_change_id || "null"}`;
            if (!entry.lineage_versions.has(lineageKey)) {
                entry.lineage_versions.set(lineageKey, {
                    config_version_id: row?._id?.config_version_id || null,
                    published_change_id: row?._id?.published_change_id || null,
                    total: 0,
                });
            }
            entry.lineage_versions.get(lineageKey).total += count;
        }

        return Array.from(byBucket.values())
            .sort((left, right) => new Date(left.bucket_start).getTime() - new Date(right.bucket_start).getTime())
            .map((bucket) => ({
                bucket_start: bucket.bucket_start,
                detectors: bucket.detectors,
                lineage_versions: Array.from(bucket.lineage_versions.values())
                    .sort((left, right) => right.total - left.total),
                total: bucket.total,
            }));
    }

    #startOfIsoWeek(date) {
        const result = new Date(date);
        result.setUTCHours(0, 0, 0, 0);

        const day = result.getUTCDay();
        const offset = day === 0 ? -6 : 1 - day;
        result.setUTCDate(result.getUTCDate() + offset);
        return result;
    }
}

module.exports = DetectionQualityMetrics;
