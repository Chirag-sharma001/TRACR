const {
    confirmDeterministicGraphHit,
    buildDeterministicEvidence,
    markAiCandidate,
} = require("./HybridBoundaryPolicy");

describe("HybridBoundaryPolicy", () => {
    test("returns confirmed graph-pattern verdict for DFS-confirmed cycle evidence", () => {
        const cycleSignal = {
            pattern_type: "CIRCULAR_TRADING",
            involved_accounts: ["A-1", "B-2", "C-3"],
            transaction_sequence: [
                {
                    from: "A-1",
                    to: "B-2",
                    amount: 1200,
                    timestamp: "2026-04-10T10:00:00.000Z",
                    txId: "tx-1",
                },
                {
                    from: "B-2",
                    to: "C-3",
                    amount: 1180,
                    timestamp: "2026-04-10T10:15:00.000Z",
                    txId: "tx-2",
                },
                {
                    from: "C-3",
                    to: "A-1",
                    amount: 1175,
                    timestamp: "2026-04-10T10:40:00.000Z",
                    txId: "tx-3",
                },
            ],
            window_type: "STRICT",
        };

        const verdict = confirmDeterministicGraphHit({
            cycleSignals: [cycleSignal],
            aiCandidate: markAiCandidate({
                model: "gemini",
                candidate_type: "CIRCULAR_TRADING",
                rationale: "closed triangle transfer loop",
            }),
            maxWindowHours: 72,
        });

        expect(verdict.confirmed).toBe(true);
        expect(verdict.status).toBe("CONFIRMED");
        expect(verdict.confirmed_pattern_type).toBe("CIRCULAR_TRADING");
        expect(verdict.evidence).toBeTruthy();
    });

    test("never confirms graph-pattern verdict for AI-only candidate", () => {
        const verdict = confirmDeterministicGraphHit({
            cycleSignals: [],
            aiCandidate: markAiCandidate({
                model: "gemini",
                candidate_type: "CIRCULAR_TRADING",
                rationale: "possibly circular from embedding anomaly",
            }),
            maxWindowHours: 72,
        });

        expect(verdict.confirmed).toBe(false);
        expect(verdict.status).toBe("CANDIDATE_ONLY");
        expect(verdict.confirmed_pattern_type).toBeNull();
        expect(verdict.evidence).toBeNull();
        expect(verdict.ai_candidate).toEqual(
            expect.objectContaining({
                status: "CANDIDATE_ONLY",
                candidate_type: "CIRCULAR_TRADING",
            })
        );
    });

    test("deterministic evidence artifact includes path edges, accounts, and bounded window metadata", () => {
        const cycleSignal = {
            pattern_type: "CIRCULAR_TRADING",
            transaction_sequence: [
                {
                    from: "X-1",
                    to: "Y-2",
                    amount: 1000,
                    timestamp: "2026-04-10T00:00:00.000Z",
                    txId: "tx-a",
                },
                {
                    from: "Y-2",
                    to: "Z-3",
                    amount: 1000,
                    timestamp: "2026-04-10T00:20:00.000Z",
                    txId: "tx-b",
                },
                {
                    from: "Z-3",
                    to: "X-1",
                    amount: 995,
                    timestamp: "2026-04-10T00:30:00.000Z",
                    txId: "tx-c",
                },
            ],
            window_type: "STRICT",
        };

        const evidence = buildDeterministicEvidence(cycleSignal, { maxWindowHours: 72 });

        expect(evidence.transaction_sequence).toHaveLength(3);
        expect(evidence.involved_accounts).toEqual(expect.arrayContaining(["X-1", "Y-2", "Z-3"]));
        expect(evidence.window_metadata).toEqual(
            expect.objectContaining({
                window_type: "STRICT",
                bounded: true,
                max_window_hours: 72,
            })
        );
        expect(evidence.window_metadata.window_hours).toBeGreaterThanOrEqual(0);
        expect(evidence.window_metadata.window_hours).toBeLessThanOrEqual(72);
    });
});
