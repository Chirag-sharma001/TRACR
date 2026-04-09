const fc = require("fast-check");

const DetectionOrchestrator = require("./DetectionOrchestrator");

// Feature: intelligent-aml-framework, Property 11: Confirmed graph-pattern detections always include deterministic evidence artifacts
// Feature: intelligent-aml-framework, Property 12: Confirmed graph-pattern evidence always includes bounded window metadata

describe("DetectionOrchestrator property tests", () => {
    function createBaseTx(overrides = {}) {
        return {
            transaction_id: "seed-tx",
            sender_account_id: "ACC-ROOT",
            receiver_account_id: "ACC-1",
            amount_usd: 500,
            timestamp: "2026-04-10T00:00:00.000Z",
            geolocation: { sender_country: "US", receiver_country: "GB" },
            transaction_type: "WIRE",
            channel: "API",
            ...overrides,
        };
    }

    function createOrchestrator({ cycleSignals, cycleWindowHours = 72 }) {
        return new DetectionOrchestrator({
            graphManager: { addEdge: jest.fn() },
            cycleDetector: { detectCycles: jest.fn(() => cycleSignals) },
            smurfingDetector: { evaluateSmurfing: jest.fn(() => null) },
            behavioralProfiler: { scoreAnomaly: jest.fn(() => ({ anomalies: [] })) },
            accountModel: {
                findOne: () => ({
                    lean: async () => ({ account_id: "ACC-ROOT", baseline: {} }),
                }),
            },
            thresholdConfig: {
                get: (key) => (key === "cycle_time_window_hours" ? cycleWindowHours : null),
            },
            logger: { info: jest.fn(), warn: jest.fn() },
        });
    }

    test("any confirmed graph-pattern result includes non-empty involved_accounts and transaction_sequence", async () => {
        const accountIdArb = fc.integer({ min: 1, max: 50 }).map((n) => `ACC-${n}`);
        const edgeArb = fc.record({
            from: accountIdArb,
            to: accountIdArb,
            amount: fc.integer({ min: 1, max: 100000 }),
            offsetMinutes: fc.integer({ min: 0, max: 240 }),
            txId: fc.uuid(),
        });

        await fc.assert(
            fc.asyncProperty(fc.array(edgeArb, { minLength: 1, maxLength: 6 }), async (rawEdges) => {
                const baseTs = Date.parse("2026-04-10T00:00:00.000Z");
                const sequence = [...rawEdges]
                    .sort((left, right) => left.offsetMinutes - right.offsetMinutes)
                    .map((edge) => ({
                        from: edge.from,
                        to: edge.to,
                        amount: edge.amount,
                        timestamp: new Date(baseTs + edge.offsetMinutes * 60 * 1000).toISOString(),
                        txId: edge.txId,
                    }));

                const involvedAccounts = Array.from(
                    new Set(sequence.flatMap((edge) => [edge.from, edge.to]).filter(Boolean))
                );

                const cycleSignals = [
                    {
                        pattern_type: "CIRCULAR_TRADING",
                        transaction_sequence: sequence,
                        involved_accounts: involvedAccounts,
                        window_type: "STRICT",
                    },
                ];

                const orchestrator = createOrchestrator({ cycleSignals, cycleWindowHours: 72 });
                const result = await orchestrator.analyze(createBaseTx());

                const graphPattern = result.hybrid_boundary.graph_pattern;
                expect(graphPattern.confirmed).toBe(true);
                expect(graphPattern.evidence.involved_accounts.length).toBeGreaterThan(0);
                expect(graphPattern.evidence.transaction_sequence.length).toBeGreaterThan(0);
            }),
            { numRuns: 100 }
        );
    });

    test("confirmed graph-pattern window metadata is present and bounded", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 72 }),
                fc.integer({ min: 2, max: 6 }),
                async (windowHours, edgeCount) => {
                    const baseTs = Date.parse("2026-04-10T00:00:00.000Z");
                    const windowMs = windowHours * 60 * 60 * 1000;
                    const stepMs = Math.max(60 * 1000, Math.floor(windowMs / (edgeCount + 1)));

                    const sequence = Array.from({ length: edgeCount }, (_, index) => ({
                        from: `ACC-${index}`,
                        to: `ACC-${index + 1}`,
                        amount: 1000 + index,
                        timestamp: new Date(baseTs + index * stepMs).toISOString(),
                        txId: `tx-${windowHours}-${index}`,
                    }));

                    const cycleSignals = [
                        {
                            pattern_type: "CIRCULAR_TRADING",
                            transaction_sequence: sequence,
                            involved_accounts: Array.from(
                                new Set(sequence.flatMap((edge) => [edge.from, edge.to]))
                            ),
                            window_type: "STRICT",
                        },
                    ];

                    const orchestrator = createOrchestrator({ cycleSignals, cycleWindowHours: windowHours });
                    const result = await orchestrator.analyze(createBaseTx());

                    const metadata = result.hybrid_boundary.graph_pattern.evidence.window_metadata;
                    expect(metadata).toEqual(
                        expect.objectContaining({
                            start_timestamp: expect.any(String),
                            end_timestamp: expect.any(String),
                            max_window_hours: windowHours,
                            bounded: true,
                        })
                    );
                    expect(metadata.window_hours).toBeGreaterThanOrEqual(0);
                    expect(metadata.window_hours).toBeLessThanOrEqual(windowHours);
                }
            ),
            { numRuns: 100 }
        );
    });
});
