class SegmentAwareThresholdPolicy {
    constructor({ thresholdConfig, logger = console } = {}) {
        this.thresholdConfig = thresholdConfig;
        this.logger = logger;
        this.safeDefaults = {
            high: 70,
            medium: 40,
        };
    }

    resolveCutoffs({ segment, patternType, geoBand } = {}) {
        const normalizedSegment = this.#normalizeSegment(segment);
        const normalizedPatternType = this.#normalizePatternType(patternType);
        const normalizedGeoBand = this.#normalizeGeoBand(geoBand);

        const candidates = [
            `risk_tier_thresholds.segment.${normalizedSegment}.pattern.${normalizedPatternType}.geo.${normalizedGeoBand}`,
            `risk_tier_thresholds.segment.${normalizedSegment}.pattern.${normalizedPatternType}`,
            `risk_tier_thresholds.segment.${normalizedSegment}`,
            `risk_tier_thresholds.pattern.${normalizedPatternType}`,
            `risk_tier_thresholds.geo.${normalizedGeoBand}`,
            "risk_tier_thresholds.defaults",
        ];

        for (const key of candidates) {
            const raw = this.#getConfig(key, null);
            const normalized = this.#normalizeThresholds(raw);
            if (normalized) {
                return normalized;
            }
        }

        return { ...this.safeDefaults };
    }

    resolveWithContext({ segment, patternType, geoBand } = {}) {
        const normalizedSegment = this.#normalizeSegment(segment);
        const normalizedPatternType = this.#normalizePatternType(patternType);
        const normalizedGeoBand = this.#normalizeGeoBand(geoBand);

        const candidates = [
            `risk_tier_thresholds.segment.${normalizedSegment}.pattern.${normalizedPatternType}.geo.${normalizedGeoBand}`,
            `risk_tier_thresholds.segment.${normalizedSegment}.pattern.${normalizedPatternType}`,
            `risk_tier_thresholds.segment.${normalizedSegment}`,
            `risk_tier_thresholds.pattern.${normalizedPatternType}`,
            `risk_tier_thresholds.geo.${normalizedGeoBand}`,
            "risk_tier_thresholds.defaults",
        ];

        for (const key of candidates) {
            const raw = this.#getConfig(key, null);
            const thresholds = this.#normalizeThresholds(raw);
            if (thresholds) {
                return {
                    thresholds,
                    threshold_source: key,
                    segment: normalizedSegment,
                    pattern_type: normalizedPatternType,
                    geo_band: normalizedGeoBand,
                };
            }
        }

        return {
            thresholds: { ...this.safeDefaults },
            threshold_source: "safe_defaults",
            segment: normalizedSegment,
            pattern_type: normalizedPatternType,
            geo_band: normalizedGeoBand,
        };
    }

    #getConfig(key, fallback) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallback;
        }

        return this.thresholdConfig.get(key, fallback);
    }

    #normalizeSegment(segment) {
        if (typeof segment !== "string" || segment.trim().length === 0) {
            const fromConfig = this.#getConfig("customer_segment_default", null);
            if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
                return fromConfig.trim().toLowerCase();
            }
            return "default";
        }

        return segment.trim().toLowerCase();
    }

    #normalizePatternType(patternType) {
        if (typeof patternType !== "string" || patternType.trim().length === 0) {
            return "BEHAVIORAL_ANOMALY";
        }

        return patternType.trim().toUpperCase();
    }

    #normalizeGeoBand(geoBand) {
        if (typeof geoBand !== "string" || geoBand.trim().length === 0) {
            return "LOW";
        }

        const value = geoBand.trim().toUpperCase();
        if (["LOW", "MEDIUM", "HIGH"].includes(value)) {
            return value;
        }

        return "LOW";
    }

    #normalizeThresholds(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const high = Number(raw.high);
        const medium = Number(raw.medium);

        if (!Number.isFinite(high) || !Number.isFinite(medium)) {
            return null;
        }

        if (high < 0 || high > 100 || medium < 0 || medium > 100 || medium >= high) {
            this.logger.warn("invalid_segment_thresholds", { raw });
            return null;
        }

        return { high, medium };
    }
}

module.exports = SegmentAwareThresholdPolicy;