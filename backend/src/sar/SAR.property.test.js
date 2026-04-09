const fc = require("fast-check");
const PromptBuilder = require("./PromptBuilder");
const SARFormatter = require("./SARFormatter");
const SARService = require("./SARService");

// Feature: intelligent-aml-framework, Property 20: SAR Prompt Contains All Required Fields
// Feature: intelligent-aml-framework, Property 21: SAR Draft Section Completeness

describe("SAR property tests", () => {
    const promptBuilder = new PromptBuilder();
    const formatter = new SARFormatter();

    test("prompt always contains required context fields", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 12 }),
                fc.constantFrom("SMURFING", "CIRCULAR_TRADING", "BEHAVIORAL_ANOMALY"),
                async (subject, pattern) => {
                    const alert = {
                        subject_account_id: subject,
                        pattern_type: pattern,
                        risk_score: 88,
                        risk_tier: "HIGH",
                        score_breakdown: { cycle_score: 80 },
                        transaction_ids: ["tx-1", "tx-2"],
                        behavioral_detail: { anomalies: [] },
                    };

                    const account = {
                        baseline: {
                            daily_freq_mean: 3,
                            amount_mean: 100,
                        },
                    };

                    const prompt = promptBuilder.build(alert, account);
                    expect(prompt).toContain("subject_summary");
                    expect(prompt).toContain("activity_narrative");
                    expect(prompt).toContain("transaction_timeline");
                    expect(prompt).toContain("risk_indicators");
                    expect(prompt).toContain("recommended_filing_category");
                    expect(prompt).toContain("subject_account_id");
                    expect(prompt).toContain(pattern);
                }
            ),
            { numRuns: 100 }
        );
    });

    test("formatted SAR always includes all five required sections", async () => {
        await fc.assert(
            fc.asyncProperty(fc.boolean(), async (validJson) => {
                const alert = {
                    subject_account_id: "ACC-1",
                    pattern_type: "SMURFING",
                    risk_score: 77,
                    risk_tier: "HIGH",
                    transaction_ids: ["tx-1"],
                };

                const response = validJson
                    ? {
                        partial: false,
                        text: JSON.stringify({
                            subject_summary: "Subject",
                            activity_narrative: "Narrative",
                            transaction_timeline: [{ txId: "tx-1" }],
                            risk_indicators: [{ key: "k" }],
                            recommended_filing_category: "MANDATORY",
                        }),
                    }
                    : {
                        partial: true,
                        text: null,
                    };

                const draft = formatter.format(response, alert);
                expect(draft).toEqual(
                    expect.objectContaining({
                        subject_summary: expect.anything(),
                        activity_narrative: expect.anything(),
                        transaction_timeline: expect.any(Array),
                        risk_indicators: expect.any(Array),
                        recommended_filing_category: expect.anything(),
                        is_partial: expect.any(Boolean),
                    })
                );
            }),
            { numRuns: 100 }
        );
    });

    test("SAR generation includes source evidence references and advisory metadata", async () => {
        const sarDraftModel = {
            create: jest.fn(async (payload) => ({
                ...payload,
                sar_id: "sar-123",
                generated_at: payload.generated_at,
                toObject() {
                    return {
                        ...payload,
                        sar_id: "sar-123",
                        generated_at: payload.generated_at,
                    };
                },
            })),
        };

        const service = new SARService({
            sarDraftModel,
            promptBuilder: { build: jest.fn(() => "prompt") },
            geminiClient: { generate: jest.fn(async () => ({ requestId: "req-123", partial: false, text: "{}" })) },
            sarFormatter: {
                format: jest.fn(() => ({
                    subject_summary: "summary",
                    activity_narrative: "narrative",
                    transaction_timeline: [],
                    risk_indicators: [{ key: "velocity" }],
                    recommended_filing_category: "MANDATORY",
                    is_partial: false,
                })),
            },
            sarQueue: { enqueue: (fn) => fn() },
            auditLogger: null,
            logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
        });

        const result = await service.generateSAR({
            alert: {
                alert_id: "alert-123",
                subject_account_id: "acct-10",
                transaction_ids: ["tx-1", "tx-2"],
                pattern_type: "SMURFING",
            },
            account: { account_id: "acct-10" },
            generatedBy: "user-1",
            caseId: "case-1",
        });

        const persistedPayload = sarDraftModel.create.mock.calls[0][0];
        const sourceTraceIndicator = persistedPayload.risk_indicators.find(
            (indicator) => indicator && indicator.type === "SOURCE_EVIDENCE_TRACE"
        );

        expect(sourceTraceIndicator).toEqual(
            expect.objectContaining({
                alert_id: "alert-123",
                account_id: "acct-10",
                transaction_ids: ["tx-1", "tx-2"],
            })
        );

        expect(result.ai_advisory).toEqual(
            expect.objectContaining({
                mode: "ADVISORY_ONLY",
                decision_authority: "HUMAN_REQUIRED",
                human_review_required: true,
            })
        );

        expect(result.evidence_trace).toEqual(
            expect.objectContaining({
                alert_id: "alert-123",
                case_id: "case-1",
                account_id: "acct-10",
                transaction_ids: ["tx-1", "tx-2"],
            })
        );
    });

    test("SAR generation rejects AI attempts to finalize filing decisions", async () => {
        const sarDraftModel = {
            create: jest.fn(async (payload) => payload),
        };

        const service = new SARService({
            sarDraftModel,
            promptBuilder: { build: jest.fn(() => "prompt") },
            geminiClient: { generate: jest.fn(async () => ({ requestId: "req-123", partial: false, text: "{}" })) },
            sarFormatter: {
                format: jest.fn(() => ({
                    subject_summary: "summary",
                    activity_narrative: "narrative",
                    transaction_timeline: [],
                    risk_indicators: [],
                    recommended_filing_category: "MANDATORY",
                    is_partial: false,
                    filing_decision_finalized: true,
                })),
            },
            sarQueue: { enqueue: (fn) => fn() },
            auditLogger: null,
            logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
        });

        await expect(
            service.generateSAR({
                alert: {
                    alert_id: "alert-123",
                    subject_account_id: "acct-10",
                    transaction_ids: ["tx-1", "tx-2"],
                    pattern_type: "SMURFING",
                },
                account: { account_id: "acct-10" },
                generatedBy: "user-1",
                caseId: "case-1",
            })
        ).rejects.toMatchObject({ code: "human_decision_required" });

        expect(sarDraftModel.create).not.toHaveBeenCalled();
    });
});
