const POPULATION_MEAN_HOURLY_TX = 2;
const POPULATION_STDDEV_HOURLY_TX = 1;

class SmurfingDetector {
    constructor({ thresholdConfig = null, logger = console } = {}) {
        this.thresholdConfig = thresholdConfig;
        this.logger = logger;
        this.accountWindows = new Map();
    }

    evaluateSmurfing(accountId, newTx, config = {}) {
        const windowHours = this.#getConfigNumber(config.windowHours, "rolling_window_hours", 24);
        const ctrThreshold = this.#getConfigNumber(config.ctrThreshold, "ctr_threshold", 10000);

        const txWindow = this.accountWindows.get(accountId) || [];
        const txTimestamp = new Date(newTx.timestamp).getTime();
        const windowStart = txTimestamp - windowHours * 60 * 60 * 1000;

        const trimmed = txWindow.filter((entry) => entry.timestamp >= windowStart);
        trimmed.push({
            timestamp: txTimestamp,
            amount: Number(newTx.amount_usd),
            receiverId: newTx.receiver_account_id,
            txId: newTx.transaction_id,
        });

        this.accountWindows.set(accountId, trimmed);

        const aggregateAmount = trimmed.reduce((sum, entry) => sum + entry.amount, 0);
        const allBelowThreshold = trimmed.every((entry) => entry.amount < ctrThreshold);
        const distinctReceivers = new Set(trimmed.map((entry) => entry.receiverId)).size;

        if (!(aggregateAmount >= ctrThreshold && allBelowThreshold)) {
            return null;
        }

        const baseScore = this.computeSmurfingBaseScore(trimmed, { ctrThreshold, windowHours });
        const coordinatedMultiplierApplied = distinctReceivers >= 3;
        const finalScore = coordinatedMultiplierApplied ? Math.min(100, baseScore * 1.25) : baseScore;

        const timestamps = trimmed.map((entry) => entry.timestamp);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);

        return {
            pattern_type: "SMURFING",
            subject_account_id: accountId,
            transaction_ids: trimmed.map((entry) => entry.txId).filter(Boolean),
            transaction_count: trimmed.length,
            aggregate_amount: aggregateAmount,
            individual_amounts: trimmed.map((entry) => entry.amount),
            distinct_receiver_count: distinctReceivers,
            time_span_hours: (maxTs - minTs) / (60 * 60 * 1000),
            coordinated_multiplier_applied: coordinatedMultiplierApplied,
            smurfing_score: finalScore,
            base_smurfing_score: baseScore,
        };
    }

    computeSmurfingBaseScore(window, config) {
        const txCountScore = Math.min(50, window.length * 5);

        const aggregate = window.reduce((sum, entry) => sum + entry.amount, 0);
        const proximityRatio = Math.min(1, aggregate / (config.ctrThreshold * 2));
        const proximityScore = Math.min(30, proximityRatio * 30);

        const timestamps = window.map((entry) => entry.timestamp).sort((a, b) => a - b);
        const durationHours = Math.max(1 / 60, (timestamps[timestamps.length - 1] - timestamps[0]) / (60 * 60 * 1000));
        const compressionRatio = Math.min(1, config.windowHours / durationHours);
        const timeCompressionScore = Math.min(20, compressionRatio * 20);

        return Math.min(100, txCountScore + proximityScore + timeCompressionScore);
    }

    checkVelocitySpike(accountId, baseline, hourlyTxCount) {
        const historyDays = Number(baseline?.history_days || 0);
        const usePopulation = historyDays < 30;

        const mean = usePopulation
            ? POPULATION_MEAN_HOURLY_TX
            : Number(baseline?.hourly_tx_mean ?? baseline?.daily_freq_mean ?? POPULATION_MEAN_HOURLY_TX);

        const stddev = usePopulation
            ? POPULATION_STDDEV_HOURLY_TX
            : Number(baseline?.hourly_tx_stddev ?? baseline?.daily_freq_stddev ?? POPULATION_STDDEV_HOURLY_TX);

        const safeStddev = stddev > 0 ? stddev : POPULATION_STDDEV_HOURLY_TX;
        const zScore = (hourlyTxCount - mean) / safeStddev;

        if (zScore <= 3) {
            return null;
        }

        return {
            account_id: accountId,
            observed: hourlyTxCount,
            mean,
            stddev: safeStddev,
            zScore,
            used_population_stats: usePopulation,
        };
    }

    #getConfigNumber(explicitValue, key, fallback) {
        if (Number.isFinite(Number(explicitValue))) {
            return Number(explicitValue);
        }

        if (this.thresholdConfig && typeof this.thresholdConfig.get === "function") {
            const configured = Number(this.thresholdConfig.get(key));
            if (Number.isFinite(configured)) {
                return configured;
            }
        }

        return fallback;
    }
}

module.exports = {
    SmurfingDetector,
    POPULATION_MEAN_HOURLY_TX,
    POPULATION_STDDEV_HOURLY_TX,
};
