const DetectionOrchestrator = require("./DetectionOrchestrator");

describe("DetectionOrchestrator", () => {
    function createTx(overrides = {}) {
        return {
            transaction_id: "tx-1",
            sender_account_id: "A",
            receiver_account_id: "B",
            amount_usd: 1234,
            timestamp: new Date().toISOString(),
            geolocation: { sender_country: "US", receiver_country: "GB" },
            transaction_type: "WIRE",
            channel: "ONLINE",
            ...overrides,
        };
    }

    test("runs detectors in parallel and aggregates signals", async () => {
        const delays = [];
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        let edgeAdded = false;
        const graphManager = {
            addEdge: jest.fn(() => {
                edgeAdded = true;
            }),
        };

        const cycleDetector = {
            detectCycles: jest.fn(async () => {
                delays.push({ name: "cycle", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return [{ cycle_score: 80, involved_accounts: ["A", "B"], transaction_sequence: [] }];
            }),
        };

        const smurfingDetector = {
            evaluateSmurfing: jest.fn(async () => {
                delays.push({ name: "smurfing", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return { smurfing_score: 70 };
            }),
        };

        const behavioralProfiler = {
            scoreAnomaly: jest.fn(async () => {
                delays.push({ name: "behavioral", sawEdge: edgeAdded, at: Date.now() });
                await sleep(60);
                return { anomalies: [{ anomalyType: "FREQUENCY_SPIKE" }] };
            }),
        };

        const accountModel = {
            findOne: () => ({ lean: async () => ({ account_id: "A", baseline: {} }) }),
        };

        const orchestrator = new DetectionOrchestrator({
            graphManager,
            cycleDetector,
            smurfingDetector,
            behavioralProfiler,
            accountModel,
            logger: { info: jest.fn() },
        });

        const tx = createTx();

        const start = Date.now();
        const result = await orchestrator.analyze(tx);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(150);
        expect(graphManager.addEdge).toHaveBeenCalled();
        expect(delays.every((entry) => entry.sawEdge)).toBe(true);

        expect(result.transaction_id).toBe("tx-1");
        expect(result.cycle_signals).toHaveLength(1);
        expect(result.smurfing_signal.smurfing_score).toBe(70);
        expect(result.behavioral_signal.anomalies).toHaveLength(1);
    });

    test("confirmed DFS graph evidence is surfaced as deterministic graph-pattern truth", async () => {
        const graphManager = { addEdge: jest.fn() };
        const cycleDetector = {
            detectCycles: jest.fn(() => [
                {
                    pattern_type: "CIRCULAR_TRADING",
                    involved_accounts: ["A", "B", "C"],
                    transaction_sequence: [
                        {
                            from: "A",
                            to: "B",
                            amount: 100,
                            timestamp: "2026-04-10T10:00:00.000Z",
                            txId: "tx-1",
                        },
                        {
                            from: "B",
                            to: "C",
                            amount: 95,
                            timestamp: "2026-04-10T10:05:00.000Z",
                            txId: "tx-2",
                        },
                        {
                            from: "C",
                            to: "A",
                            amount: 93,
                            timestamp: "2026-04-10T10:09:00.000Z",
                            txId: "tx-3",
                        },
                    ],
                    window_type: "STRICT",
                },
            ]),
        };
        const smurfingDetector = { evaluateSmurfing: jest.fn(() => null) };
        const behavioralProfiler = {
            scoreAnomaly: jest.fn(() => ({ anomalies: [] })),
        };
        const accountModel = {
            findOne: () => ({ lean: async () => ({ account_id: "A", baseline: {} }) }),
        };

        const orchestrator = new DetectionOrchestrator({
            graphManager,
            cycleDetector,
            smurfingDetector,
            behavioralProfiler,
            accountModel,
            logger: { info: jest.fn(), warn: jest.fn() },
        });

        const result = await orchestrator.analyze(createTx());

        expect(result.hybrid_boundary).toBeTruthy();
        expect(result.hybrid_boundary.graph_pattern).toEqual(
            expect.objectContaining({
                status: "CONFIRMED",
                confirmed: true,
                confirmed_pattern_type: "CIRCULAR_TRADING",
            })
        );
        expect(result.hybrid_boundary.graph_pattern.evidence).toEqual(
            expect.objectContaining({
                involved_accounts: expect.arrayContaining(["A", "B", "C"]),
                transaction_sequence: expect.any(Array),
            })
        );
    });

    test("AI candidate without DFS evidence remains unconfirmed and alert emission carries advisory boundary", async () => {
        const graphManager = { addEdge: jest.fn() };
        const cycleDetector = { detectCycles: jest.fn(() => []) };
        const smurfingDetector = { evaluateSmurfing: jest.fn(() => null) };
        const behavioralProfiler = {
            scoreAnomaly: jest.fn(() => ({ anomalies: [{ anomalyType: "FREQUENCY_SPIKE" }] })),
        };
        const accountModel = {
            findOne: () => ({ lean: async () => ({ account_id: "A", baseline: {} }) }),
        };
        const emitter = {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
        };

        const riskScorer = {
            compute: jest.fn(async () => ({ alert_id: "alert-1", pattern_type: "BEHAVIORAL_ANOMALY" })),
        };

        const orchestrator = new DetectionOrchestrator({
            graphManager,
            cycleDetector,
            smurfingDetector,
            behavioralProfiler,
            accountModel,
            emitter,
            riskScorer,
            logger: { info: jest.fn(), warn: jest.fn() },
        });

        const tx = createTx({
            ai_graph_candidate: {
                model: "gemini",
                candidate_type: "CIRCULAR_TRADING",
                rationale: "embedding-based loop similarity",
            },
        });

        const result = await orchestrator.onTransactionSaved(tx);
        const emittedAlert = emitter.emit.mock.calls.find((call) => call[0] === "alert:new")?.[1];

        expect(result.hybrid_boundary.graph_pattern).toEqual(
            expect.objectContaining({
                status: "CANDIDATE_ONLY",
                confirmed: false,
                confirmed_pattern_type: null,
                evidence: null,
            })
        );

        expect(emittedAlert).toBeTruthy();
        expect(emittedAlert.hybrid_boundary.graph_pattern).toEqual(
            expect.objectContaining({
                status: "CANDIDATE_ONLY",
                confirmed: false,
            })
        );
        expect(emittedAlert.graph_pattern_status).toBe("CANDIDATE_ONLY");
    });
});
