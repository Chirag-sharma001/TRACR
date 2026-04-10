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

    async getDetectionQualityComparisonTelemetry({
        before_config_version_id,
        after_config_version_id,
        before_published_change_id = null,
        after_published_change_id = null,
        day_window_days = 7,
        week_window_weeks = 4,
    } = {}) {
        if (!before_config_version_id || !after_config_version_id) {
            throw new Error("comparison_selectors_required");
        }

        const now = this.now();
        const normalizedDayWindow = Math.min(31, Math.max(1, Number(day_window_days || 7)));
        const normalizedWeekWindow = Math.min(12, Math.max(1, Number(week_window_weeks || 4)));
        const lookbackDays = Math.max(normalizedDayWindow, normalizedWeekWindow * 7);

        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));

        const beforeSelector = {
            config_version_id: before_config_version_id,
            published_change_id: before_published_change_id || null,
        };

        const afterSelector = {
            config_version_id: after_config_version_id,
            published_change_id: after_published_change_id || null,
        };

        const comparisonRows = await this.#aggregateComparisonRows({
            start,
            end: now,
            beforeSelector,
            afterSelector,
        });

        const normalized = this.#normalizeComparisonRows(comparisonRows, beforeSelector, afterSelector);

        return {
            generated_at: now.toISOString(),
            selectors: {
                before: beforeSelector,
                after: afterSelector,
            },
            windows: {
                day_window_days: normalizedDayWindow,
                week_window_weeks: normalizedWeekWindow,
            },
            before: normalized.before,
            after: normalized.after,
            delta: normalized.delta,
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

    async #aggregateComparisonRows({ start, end, beforeSelector, afterSelector }) {
        const beforeMatch = {
            config_version_id: beforeSelector.config_version_id,
        };
        if (beforeSelector.published_change_id) {
            beforeMatch.published_change_id = beforeSelector.published_change_id;
        }

        const afterMatch = {
            config_version_id: afterSelector.config_version_id,
        };
        if (afterSelector.published_change_id) {
            afterMatch.published_change_id = afterSelector.published_change_id;
        }

        return this.alertModel.aggregate([
            {
                $match: {
                    created_at: {
                        $gte: start,
                        $lte: end,
                    },
                    $or: [beforeMatch, afterMatch],
                },
            },
            {
                $project: {
                    config_version_id: "$config_version_id",
                    published_change_id: "$published_change_id",
                    pattern_type: "$pattern_type",
                    confidence_level: "$confidence_level",
                    segment: "$precision_context.segment",
                    cohort: {
                        $cond: {
                            if: {
                                $and: [
                                    { $eq: ["$config_version_id", beforeSelector.config_version_id] },
                                    beforeSelector.published_change_id
                                        ? { $eq: ["$published_change_id", beforeSelector.published_change_id] }
                                        : true,
                                ],
                            },
                            then: "before",
                            else: "after",
                        },
                    },
                },
            },
            {
                $group: {
                    _id: {
                        cohort: "$cohort",
                        config_version_id: "$config_version_id",
                        published_change_id: "$published_change_id",
                        segment: "$segment",
                        pattern_type: "$pattern_type",
                        confidence_level: "$confidence_level",
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: {
                    "_id.cohort": 1,
                    "_id.config_version_id": 1,
                    "_id.published_change_id": 1,
                    "_id.segment": 1,
                    "_id.pattern_type": 1,
                    "_id.confidence_level": 1,
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

    #normalizeComparisonRows(rows, beforeSelector, afterSelector) {
        const bucket = {
            before: this.#createComparisonBucket(),
            after: this.#createComparisonBucket(),
        };

        for (const row of rows || []) {
            const cohort = row?._id?.cohort === "before" ? "before" : "after";
            const count = Number(row?.count || 0);

            if (count <= 0) {
                continue;
            }

            const entry = bucket[cohort];
            entry.total += count;

            const segmentKey = this.#stableDimensionKey(row?._id?.segment);
            const patternTypeKey = this.#stableDimensionKey(row?._id?.pattern_type);
            const confidenceKey = this.#stableDimensionKey(row?._id?.confidence_level);

            entry.breakdowns.segment.set(segmentKey, (entry.breakdowns.segment.get(segmentKey) || 0) + count);
            entry.breakdowns.pattern_type.set(patternTypeKey, (entry.breakdowns.pattern_type.get(patternTypeKey) || 0) + count);
            entry.breakdowns.confidence_level.set(confidenceKey, (entry.breakdowns.confidence_level.get(confidenceKey) || 0) + count);

            const lineageKey = `${row?._id?.config_version_id || "null"}|${row?._id?.published_change_id || "null"}`;
            if (!entry.lineage.has(lineageKey)) {
                entry.lineage.set(lineageKey, {
                    config_version_id: row?._id?.config_version_id || null,
                    published_change_id: row?._id?.published_change_id || null,
                    total: 0,
                });
            }

            entry.lineage.get(lineageKey).total += count;
        }

        const normalizedBefore = this.#toComparisonPayload(bucket.before, beforeSelector);
        const normalizedAfter = this.#toComparisonPayload(bucket.after, afterSelector);

        return {
            before: normalizedBefore,
            after: normalizedAfter,
            delta: {
                total: normalizedAfter.total - normalizedBefore.total,
            },
        };
    }

    #createComparisonBucket() {
        return {
            total: 0,
            lineage: new Map(),
            breakdowns: {
                segment: new Map(),
                pattern_type: new Map(),
                confidence_level: new Map(),
            },
        };
    }

    #toComparisonPayload(bucket, selector) {
        const lineage = Array.from(bucket.lineage.values()).sort((left, right) => {
            if (right.total !== left.total) {
                return right.total - left.total;
            }

            const leftKey = `${left.config_version_id || ""}|${left.published_change_id || ""}`;
            const rightKey = `${right.config_version_id || ""}|${right.published_change_id || ""}`;
            return leftKey.localeCompare(rightKey);
        });

        const primaryLineage = lineage[0] || {
            config_version_id: selector.config_version_id || null,
            published_change_id: selector.published_change_id || null,
        };

        return {
            total: bucket.total,
            lineage: {
                config_version_id: primaryLineage.config_version_id,
                published_change_id: primaryLineage.published_change_id,
            },
            breakdowns: {
                segment: this.#toStableDimensionObject(bucket.breakdowns.segment),
                pattern_type: this.#toStableDimensionObject(bucket.breakdowns.pattern_type),
                confidence_level: this.#toStableDimensionObject(bucket.breakdowns.confidence_level),
            },
        };
    }

    #stableDimensionKey(value) {
        if (value === null || value === undefined || value === "") {
            return "unknown";
        }

        return String(value);
    }

    #toStableDimensionObject(sourceMap) {
        return Array.from(sourceMap.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .reduce((accumulator, [key, total]) => {
                accumulator[key] = { total };
                return accumulator;
            }, {});
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
