const SARDraft = require("../models/SARDraft");
const PromptBuilder = require("./PromptBuilder");
const GeminiClient = require("./GeminiClient");
const SARFormatter = require("./SARFormatter");
const SARQueue = require("./SARQueue");
const { assertHumanDecisionGate, attachEvidenceTrace } = require("./AiAdvisoryPolicy");

function uniqueIds(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTimeline(baseTimeline, traceIds) {
    const timeline = Array.isArray(baseTimeline) ? baseTimeline : [];
    if (timeline.length > 0) {
        return timeline;
    }

    return traceIds.map((transactionId) => ({
        txId: transactionId,
        source: "ALERT_EVIDENCE",
    }));
}

function normalizeRiskIndicators(baseIndicators, evidenceTrace) {
    const indicators = Array.isArray(baseIndicators) ? baseIndicators : [];
    const filtered = indicators.filter((indicator) => indicator?.type !== "SOURCE_EVIDENCE_TRACE");

    return [
        ...filtered,
        {
            type: "SOURCE_EVIDENCE_TRACE",
            alert_id: evidenceTrace.alert_id,
            case_id: evidenceTrace.case_id,
            account_id: evidenceTrace.account_id,
            transaction_ids: evidenceTrace.transaction_ids,
        },
    ];
}

class SARService {
    constructor({
        sarDraftModel = SARDraft,
        promptBuilder = new PromptBuilder(),
        geminiClient = new GeminiClient(),
        sarFormatter = new SARFormatter(),
        sarQueue = new SARQueue(),
        auditLogger = null,
        logger = console,
    } = {}) {
        this.sarDraftModel = sarDraftModel;
        this.promptBuilder = promptBuilder;
        this.geminiClient = geminiClient;
        this.sarFormatter = sarFormatter;
        this.sarQueue = sarQueue;
        this.auditLogger = auditLogger;
        this.logger = logger;
    }

    async generateSAR({ alert, account, generatedBy, caseId = null }) {
        return this.sarQueue.enqueue(async () => {
            const prompt = this.promptBuilder.build(alert, account);
            const geminiResponse = await this.geminiClient.generate(prompt);
            const formatted = this.sarFormatter.format(geminiResponse, alert);

            if (formatted?.filing_decision_finalized === true) {
                assertHumanDecisionGate({ action: "SAR_FILE_DECISION", decision_source: "AI" });
            }

            assertHumanDecisionGate({ action: "SAR_DRAFT_GENERATE", decision_source: "AI" });

            const traceTransactionIds = uniqueIds(alert?.transaction_ids);
            const taggedDraft = attachEvidenceTrace(
                {
                    ...formatted,
                    transaction_timeline: normalizeTimeline(formatted.transaction_timeline, traceTransactionIds),
                },
                {
                    alert_id: alert?.alert_id,
                    case_id: caseId,
                    account_id: account?.account_id || alert?.subject_account_id || null,
                    transaction_ids: traceTransactionIds,
                }
            );

            taggedDraft.risk_indicators = normalizeRiskIndicators(
                taggedDraft.risk_indicators,
                taggedDraft.evidence_trace
            );

            const draft = await this.sarDraftModel.create({
                alert_id: alert.alert_id,
                case_id: caseId,
                generated_by: generatedBy,
                gemini_request_id: geminiResponse.requestId,
                generated_at: new Date(),
                subject_summary: taggedDraft.subject_summary,
                activity_narrative: taggedDraft.activity_narrative,
                transaction_timeline: taggedDraft.transaction_timeline,
                risk_indicators: taggedDraft.risk_indicators,
                recommended_filing_category: taggedDraft.recommended_filing_category,
                is_partial: taggedDraft.is_partial,
            });

            if (this.auditLogger && typeof this.auditLogger.log === "function") {
                await this.auditLogger.log({
                    userId: generatedBy,
                    userRole: "INVESTIGATOR",
                    actionType: "SAR_GENERATE",
                    resourceType: "ALERT",
                    resourceId: alert.alert_id,
                    outcome: "SUCCESS",
                    metadata: {
                        sar_id: draft.sar_id,
                        generated_at: draft.generated_at,
                        gemini_request_id: geminiResponse.requestId,
                    },
                });
            }

            const persistedDraft = draft.toObject ? draft.toObject() : draft;

            return {
                ...persistedDraft,
                ai_advisory: taggedDraft.ai_advisory,
                evidence_trace: taggedDraft.evidence_trace,
            };
        });
    }
}

module.exports = SARService;
