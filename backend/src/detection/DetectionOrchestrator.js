const eventBus = require("../events/eventBus");
const Account = require("../models/Account");
const {
    confirmDeterministicGraphHit,
    markAiCandidate,
} = require("../policy/HybridBoundaryPolicy");

class DetectionOrchestrator {
    constructor({
        graphManager,
        cycleDetector,
        smurfingDetector,
        behavioralProfiler,
        riskScorer = null,
        emitter = eventBus,
        accountModel = Account,
        hybridBoundaryPolicy = {
            confirmDeterministicGraphHit,
            markAiCandidate,
        },
        thresholdConfig = null,
        logger = console,
    }) {
        this.graphManager = graphManager;
        this.cycleDetector = cycleDetector;
        this.smurfingDetector = smurfingDetector;
        this.behavioralProfiler = behavioralProfiler;
        this.riskScorer = riskScorer;
        this.emitter = emitter;
        this.accountModel = accountModel;
        this.hybridBoundaryPolicy = hybridBoundaryPolicy;
        this.thresholdConfig = thresholdConfig;
        this.logger = logger;

        this.boundOnTransactionSaved = this.onTransactionSaved.bind(this);
    }

    start() {
        this.emitter.on("transaction:saved", this.boundOnTransactionSaved);
    }

    stop() {
        this.emitter.off("transaction:saved", this.boundOnTransactionSaved);
    }

    async onTransactionSaved(tx) {
        const result = await this.analyze(tx);
        this.emitter.emit("detection:completed", result);

        if (this.riskScorer && typeof this.riskScorer.compute === "function") {
            const scoredAlert = await this.riskScorer.compute(result, tx.geolocation);
            this.emitter.emit("alert:new", this.#attachHybridBoundary(scoredAlert, result.hybrid_boundary));
        }

        return result;
    }

    async analyze(tx) {
        this.graphManager.addEdge(
            tx.sender_account_id,
            tx.receiver_account_id,
            tx.amount_usd,
            tx.timestamp,
            tx.transaction_id,
            {
                geolocation: tx.geolocation,
                transaction_type: tx.transaction_type,
                channel: tx.channel,
            }
        );

        let account = await this.accountModel.findOne({ account_id: tx.sender_account_id }).lean();
        if (this.behavioralProfiler && typeof this.behavioralProfiler.updateBaseline === "function") {
            try {
                account = await this.behavioralProfiler.updateBaseline(tx.sender_account_id);
            } catch (error) {
                this.logger.warn("baseline_update_failed", {
                    account_id: tx.sender_account_id,
                    reason: error.message,
                });
            }
        }

        const cycleMaxLength = this.#getConfigNumber("cycle_max_length", 8);
        const cycleWindowHours = this.#getConfigNumber("cycle_time_window_hours", 72);
        const rollingWindowHours = this.#getConfigNumber("rolling_window_hours", 24);
        const ctrThreshold = this.#getConfigNumber("ctr_threshold", 10000);
        const smurfingTxCountThreshold = this.#getConfigNumber("smurfing_tx_count_threshold", 3);
        const smurfingBelowThresholdRatioMin = this.#getConfigNumber("smurfing_below_threshold_ratio_min", 0.7);

        const [cycles, smurfingSignal, behavioralSignal] = await Promise.all([
            Promise.resolve(
                this.cycleDetector.detectCycles(
                    this.graphManager,
                    {
                        from: tx.sender_account_id,
                        to: tx.receiver_account_id,
                        amount: tx.amount_usd,
                        timestamp: tx.timestamp,
                        txId: tx.transaction_id,
                        geolocation: tx.geolocation,
                    },
                    cycleMaxLength,
                    cycleWindowHours
                )
            ),
            Promise.resolve(
                this.smurfingDetector.evaluateSmurfing(tx.sender_account_id, tx, {
                    windowHours: rollingWindowHours,
                    ctrThreshold,
                    minTxCount: smurfingTxCountThreshold,
                    minBelowThresholdRatio: smurfingBelowThresholdRatioMin,
                })
            ),
            this.behavioralProfiler.scoreAnomaly(
                {
                    sender_account_id: tx.sender_account_id,
                    receiver_account_id: tx.receiver_account_id,
                    amount_usd: tx.amount_usd,
                    timestamp: tx.timestamp,
                },
                account
            ),
        ]);

        const aiCandidate = tx.ai_graph_candidate
            ? this.hybridBoundaryPolicy.markAiCandidate(tx.ai_graph_candidate)
            : null;
        const graphPatternBoundary = this.hybridBoundaryPolicy.confirmDeterministicGraphHit({
            cycleSignals: cycles,
            aiCandidate,
            maxWindowHours: cycleWindowHours,
        });

        const result = {
            transaction_id: tx.transaction_id,
            subject_account_id: tx.sender_account_id,
            cycle_signals: cycles,
            smurfing_signal: smurfingSignal,
            behavioral_signal: behavioralSignal,
            hybrid_boundary: {
                deterministic_truth_required: true,
                graph_pattern: graphPatternBoundary,
            },
            analyzed_at: new Date().toISOString(),
        };

        this.logger.info("detection_complete", {
            transaction_id: tx.transaction_id,
            cycle_signal_count: cycles.length,
            smurfing: Boolean(smurfingSignal),
            behavioral: Boolean(behavioralSignal),
        });

        return result;
    }

    #attachHybridBoundary(scoredAlert, hybridBoundary) {
        const fallbackBoundary = {
            deterministic_truth_required: true,
            graph_pattern: {
                status: "NO_SIGNAL",
                confirmed: false,
                confirmed_pattern_type: null,
                evidence: null,
                ai_candidate: null,
            },
        };

        const resolvedBoundary = hybridBoundary || fallbackBoundary;
        const graphPatternBoundary = resolvedBoundary.graph_pattern || fallbackBoundary.graph_pattern;

        return {
            ...scoredAlert,
            hybrid_boundary: resolvedBoundary,
            graph_pattern_status: graphPatternBoundary.status,
        };
    }

    #getConfigNumber(key, fallback) {
        if (!this.thresholdConfig || typeof this.thresholdConfig.get !== "function") {
            return fallback;
        }

        const value = Number(this.thresholdConfig.get(key));
        return Number.isFinite(value) ? value : fallback;
    }
}

module.exports = DetectionOrchestrator;
