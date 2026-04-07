const SystemConfig = require("../models/SystemConfig");

const DEFAULT_CONFIGS = [
    {
        config_key: "ctr_threshold",
        value: 10000,
        default_value: 10000,
        valid_range: { min: 1000, max: 100000 },
        description: "Structuring detection CTR threshold in USD",
    },
    {
        config_key: "rolling_window_hours",
        value: 24,
        default_value: 24,
        valid_range: { min: 1, max: 168 },
        description: "Rolling window for smurfing aggregation",
    },
    {
        config_key: "cycle_max_length",
        value: 6,
        default_value: 6,
        valid_range: { min: 2, max: 12 },
        description: "Maximum DFS cycle length",
    },
    {
        config_key: "cycle_time_window_hours",
        value: 72,
        default_value: 72,
        valid_range: { min: 1, max: 720 },
        description: "Maximum cycle duration window",
    },
    {
        config_key: "smurfing_tx_count_threshold",
        value: 3,
        default_value: 3,
        valid_range: { min: 2, max: 50 },
        description: "Minimum transaction count for smurfing pattern",
    },
    {
        config_key: "score_weight_cycle",
        value: 0.35,
        default_value: 0.35,
        valid_range: { min: 0, max: 1 },
        description: "Risk score cycle component weight",
    },
    {
        config_key: "score_weight_smurfing",
        value: 0.30,
        default_value: 0.30,
        valid_range: { min: 0, max: 1 },
        description: "Risk score smurfing component weight",
    },
    {
        config_key: "score_weight_behavioral",
        value: 0.20,
        default_value: 0.20,
        valid_range: { min: 0, max: 1 },
        description: "Risk score behavioral component weight",
    },
    {
        config_key: "score_weight_geo",
        value: 0.15,
        default_value: 0.15,
        valid_range: { min: 0, max: 1 },
        description: "Risk score geographic component weight",
    },
];

async function seedDefaultConfig({ systemConfigModel = SystemConfig, logger = console } = {}) {
    const count = await systemConfigModel.countDocuments({});
    if (count > 0) {
        return;
    }

    await systemConfigModel.insertMany(DEFAULT_CONFIGS);
    logger.info("system_config_seeded", { count: DEFAULT_CONFIGS.length });
}

module.exports = {
    seedDefaultConfig,
    DEFAULT_CONFIGS,
};
