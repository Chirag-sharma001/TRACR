const SegmentAwareThresholdPolicy = require("./SegmentAwareThresholdPolicy");

describe("SegmentAwareThresholdPolicy contract", () => {
    test("resolves segment + pattern + geo-band tuple before fallback", () => {
        const config = {
            get: jest.fn((key, fallback = null) => {
                const map = {
                    "risk_tier_thresholds.segment.retail.pattern.SMURFING.geo.HIGH": {
                        high: 60,
                        medium: 35,
                    },
                    "risk_tier_thresholds.defaults": {
                        high: 70,
                        medium: 40,
                    },
                };
                return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback;
            }),
        };

        const policy = new SegmentAwareThresholdPolicy({ thresholdConfig: config });
        const result = policy.resolveCutoffs({
            segment: "retail",
            patternType: "SMURFING",
            geoBand: "HIGH",
        });

        expect(result).toEqual({ high: 60, medium: 35 });
        expect(config.get).toHaveBeenCalledWith(
            "risk_tier_thresholds.segment.retail.pattern.SMURFING.geo.HIGH",
            null
        );
    });

    test("falls back to safe bounded defaults for unknown keys", () => {
        const policy = new SegmentAwareThresholdPolicy({
            thresholdConfig: {
                get: jest.fn((_key, fallback = null) => fallback),
            },
        });

        const result = policy.resolveCutoffs({
            segment: "unknown-segment",
            patternType: "UNKNOWN_PATTERN",
            geoBand: "UNKNOWN",
        });

        expect(result).toEqual({ high: 70, medium: 40 });
    });

    test("rejects invalid configured thresholds and returns safe defaults", () => {
        const policy = new SegmentAwareThresholdPolicy({
            thresholdConfig: {
                get: jest.fn((key, fallback = null) => {
                    if (key === "risk_tier_thresholds.segment.smb.pattern.BEHAVIORAL_ANOMALY.geo.LOW") {
                        return { high: -5, medium: 150 };
                    }
                    return fallback;
                }),
            },
        });

        const result = policy.resolveCutoffs({
            segment: "smb",
            patternType: "BEHAVIORAL_ANOMALY",
            geoBand: "LOW",
        });

        expect(result).toEqual({ high: 70, medium: 40 });
    });
});