const SystemConfig = require("./SystemConfig");

describe("SystemConfig model", () => {
    test("supports lineage identifiers while preserving existing config contract", () => {
        const doc = new SystemConfig({
            config_key: "score_weight_cycle",
            value: 0.35,
            default_value: 0.35,
            valid_range: {
                min: 0,
                max: 1,
                allowed_values: [],
            },
            updated_by: "admin-1",
            config_version_id: "cfg-v2",
            published_change_id: "change-123",
        });

        const err = doc.validateSync();
        expect(err).toBeUndefined();
        expect(doc.config_version_id).toBe("cfg-v2");
        expect(doc.published_change_id).toBe("change-123");
        expect(doc.config_key).toBe("score_weight_cycle");
    });

    test("remains backward compatible when lineage identifiers are omitted", () => {
        const doc = new SystemConfig({
            config_key: "score_weight_behavioral",
            value: 0.2,
            default_value: 0.2,
            valid_range: {
                min: 0,
                max: 1,
                allowed_values: [],
            },
            updated_by: "admin-2",
        });

        const err = doc.validateSync();
        expect(err).toBeUndefined();
        expect(doc.config_version_id).toBeNull();
        expect(doc.published_change_id).toBeNull();
    });
});
