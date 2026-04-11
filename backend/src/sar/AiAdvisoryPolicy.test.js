const { assertHumanDecisionGate, attachEvidenceTrace } = require("./AiAdvisoryPolicy");

describe("AiAdvisoryPolicy", () => {
    test("AI recommendation payload is always tagged advisory-only", () => {
        const tagged = attachEvidenceTrace(
            { recommendation: "CLOSE_CASE" },
            {
                alert_id: "alert-123",
                account_id: "acct-42",
                transaction_ids: ["tx-1", "tx-1", "tx-2"],
            }
        );

        expect(tagged.ai_advisory).toEqual(
            expect.objectContaining({
                mode: "ADVISORY_ONLY",
                decision_authority: "HUMAN_REQUIRED",
                decision_source: "AI",
                human_review_required: true,
                filing_decision_finalized: false,
            })
        );

        expect(tagged.evidence_trace).toEqual(
            expect.objectContaining({
                alert_id: "alert-123",
                account_id: "acct-42",
                transaction_ids: ["tx-1", "tx-2"],
            })
        );
    });

    test("helper rejects autonomous close/suppress/file decisions without explicit human context", () => {
        expect(() =>
            assertHumanDecisionGate({ action: "CASE_CLOSE", decision_source: "AI" })
        ).toThrow(/human decision required/i);

        expect(() =>
            assertHumanDecisionGate({ action: "CASE_SUPPRESS", decision_source: null })
        ).toThrow(/human decision required/i);

        expect(() =>
            assertHumanDecisionGate({ action: "SAR_FILE_DECISION", decision_source: "" })
        ).toThrow(/human decision required/i);

        expect(() =>
            assertHumanDecisionGate({ action: "CASE_CLOSE", decision_source: "HUMAN" })
        ).not.toThrow();

        expect(() =>
            assertHumanDecisionGate({ action: "SAR_DRAFT_GENERATE", decision_source: "AI" })
        ).not.toThrow();
    });
});
