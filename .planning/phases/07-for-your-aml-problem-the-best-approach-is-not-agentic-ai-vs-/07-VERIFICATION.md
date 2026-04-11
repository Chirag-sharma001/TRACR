---
phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
verified: 2026-04-09T20:39:53Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 7: Hybrid Boundary Governance Verification Report

**Phase Goal:** Analysts and investigators operate on a governed hybrid boundary where DFS-confirmed graph evidence remains deterministic truth and AI remains assistive, explainable, and reviewable.
**Verified:** 2026-04-09T20:39:53Z
**Status:** passed
**Re-verification:** No - previous verification existed, but no `gaps:` section was present

## Goal Achievement

Roadmap note: Phase 7 section does not provide a structured success-criteria list. Must-haves were verified from Phase 7 plan frontmatter truths plus mapped requirements (`PH7-HYBRID-BOUNDARY`, `PH7-XAI-PACKET`, `PH7-AI-GUARDRAILS`).

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Graph-pattern assertions remain deterministic and DFS-confirmed | VERIFIED | `confirmDeterministicGraphHit` confirms only when deterministic bounded evidence exists (`backend/src/policy/HybridBoundaryPolicy.js`). Orchestrator applies this gate before result emission (`backend/src/detection/DetectionOrchestrator.js`). |
| 2 | AI anomaly hints are stored as candidates until deterministic confirmation | VERIFIED | AI hints are normalized through `markAiCandidate` and retained as `CANDIDATE_ONLY` without deterministic cycle evidence (`backend/src/policy/HybridBoundaryPolicy.js`, `backend/src/detection/DetectionOrchestrator.js`). |
| 3 | Graph-pattern alerts always carry deterministic evidence artifacts | VERIFIED | Confirmed graph evidence packet includes `transaction_sequence`, `path_edges`, `involved_accounts`, and `window_metadata` (`backend/src/policy/HybridBoundaryPolicy.js`). Property tests enforce non-empty evidence and bounded windows (`backend/src/detection/DetectionOrchestrator.property.test.js`). |
| 4 | Alert explanation packet includes deterministic evidence when graph-pattern logic is involved | VERIFIED | Scorer builds deterministic evidence into canonical packet (`backend/src/scoring/RiskScorer.js`) and routes serialize normalized packet for list/detail responses (`backend/src/routes/alerts.js`). |
| 5 | Alert packet includes decomposition, narrative mapped to evidence, and confidence | VERIFIED | Canonical packet contains `score_decomposition`, `narrative_mapping`, and `confidence_level` with deterministic derivation (`backend/src/scoring/RiskScorer.js`). Property tests validate reconstruction and evidence refs (`backend/src/scoring/RiskScorer.property.test.js`). |
| 6 | Investigator API returns a stable explainability payload contract | VERIFIED | `normalizeAlertPayload` guarantees stable explainability shape; route property tests assert required packet keys and deterministic evidence fields (`backend/src/routes/alerts.js`, `backend/src/routes/AlertRoutes.hybrid.property.test.js`). |
| 7 | AI outputs remain advisory and cannot autonomously execute regulated decisions | VERIFIED | AI policy tags outputs `ADVISORY_ONLY` and enforces human gate for regulated actions (`backend/src/sar/AiAdvisoryPolicy.js`), consumed in SAR flow (`backend/src/sar/SARService.js`). |
| 8 | Human investigator review remains mandatory before case closure/suppression or SAR filing outcomes | VERIFIED | Case route enforces `assertHumanDecisionGate` on regulated transitions (`backend/src/routes/cases.js`), and SAR service rejects AI attempt to finalize filing decisions (`backend/src/sar/SARService.js`, `backend/src/sar/SAR.property.test.js`). |
| 9 | AI-generated summaries and SAR drafts are traceable to source evidence | VERIFIED | SAR generation attaches `evidence_trace` and persists `SOURCE_EVIDENCE_TRACE` indicators (`backend/src/sar/SARService.js`), verified by property test (`backend/src/sar/SAR.property.test.js`). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `backend/src/policy/HybridBoundaryPolicy.js` | Boundary policy contract and deterministic confirmation helpers | VERIFIED | Exists; substantive candidate tagging, deterministic evidence normalization, and confirmation gate logic. |
| `backend/src/detection/DetectionOrchestrator.js` | Deterministic truth gate before alert emission | VERIFIED | Imports and invokes boundary policy in analyze path; emits boundary metadata and graph status. |
| `backend/src/models/Alert.js` | Persisted explainability packet fields including confidence | VERIFIED | Schema defines `confidence_level` and `explainability_packet` with deterministic evidence, decomposition, and narrative mapping. |
| `backend/src/scoring/RiskScorer.js` | Explainability packet builder with decomposition + confidence | VERIFIED | Builds canonical explainability packet and persists via `alertModel.create`. |
| `backend/src/routes/alerts.js` | Serialized explainability response | VERIFIED | List/detail endpoints normalize and return stable explainability payload contract. |
| `backend/src/sar/AiAdvisoryPolicy.js` | Advisory-only AI policy and decision guard helpers | VERIFIED | Exports `assertHumanDecisionGate` and `attachEvidenceTrace`; enforces advisory-only semantics. |
| `backend/src/sar/SARService.js` | AI output guardrails + evidence trace metadata | VERIFIED | Applies policy checks and persists source evidence trace indicator in risk indicators. |
| `backend/src/routes/cases.js` | Human-only regulated state transition enforcement | VERIFIED | Regulated case transitions require explicit human decision source. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `backend/src/detection/DetectionOrchestrator.js` | `backend/src/policy/HybridBoundaryPolicy.js` | policy contract invocation during analyze/onTransactionSaved | WIRED | Imports and calls `confirmDeterministicGraphHit` and `markAiCandidate` in runtime flow. |
| `backend/src/scoring/RiskScorer.js` | `backend/src/models/Alert.js` | create(alertDoc) with explainability fields | WIRED | Runtime path calls `alertModel.create(alertDoc)` with full explainability packet fields. |
| `backend/src/routes/alerts.js` | `backend/src/models/Alert.js` | lean query serialization | WIRED | Uses `find(...).lean()` and `findOne(...).lean()` then normalizes output payload. |
| `backend/src/sar/SARService.js` | `backend/src/sar/AiAdvisoryPolicy.js` | policy assertions before draft persistence | WIRED | Imports and invokes `assertHumanDecisionGate` and `attachEvidenceTrace` before persistence. |
| `backend/src/routes/cases.js` | `backend/src/models/Case.js` | state transition guard | WIRED | `router.patch(":id/state")` fetches case model, applies gate, and persists transition. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `backend/src/routes/alerts.js` | `items` and `alert` payloads | `alertModel.find(...).lean()` and `alertModel.findOne(...).lean()` | Yes, DB query results are normalized and returned | FLOWING |
| `backend/src/scoring/RiskScorer.js` | `explainabilityPacket` and `alertDoc` | Computed from detection result + geolocation + deterministic evidence extraction | Yes, persisted through `alertModel.create` | FLOWING |
| `backend/src/sar/SARService.js` | `taggedDraft` and `evidence_trace` | Gemini output + alert/account identifiers + advisory policy helpers | Yes, persisted draft includes trace indicator and advisory metadata | FLOWING |
| `backend/src/routes/cases.js` | `decision_source` and case transition | Request payload + case lookup + guard + `save()` | Yes, guarded transitions persist case state history | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Deterministic boundary helper contract | `cd backend && npx jest src/policy/HybridBoundaryPolicy.test.js --runInBand` | 3/3 tests passed | PASS |
| Detection boundary runtime enforcement | `cd backend && npx jest src/detection/DetectionOrchestrator.test.js --runInBand` | 3/3 tests passed | PASS |
| Detection evidence invariants | `cd backend && npx jest src/detection/DetectionOrchestrator.property.test.js --runInBand` | 2/2 tests passed | PASS |
| Explainability packet scorer invariants | `cd backend && npx jest src/scoring/RiskScorer.property.test.js --runInBand` | 9/9 tests passed | PASS |
| Alert API explainability serialization | `cd backend && npx jest src/routes/AlertRoutes.hybrid.property.test.js --runInBand` | 2/2 tests passed | PASS |
| Advisory policy guardrails | `cd backend && npx jest src/sar/AiAdvisoryPolicy.test.js --runInBand` | 2/2 tests passed | PASS |
| SAR advisory + source traceability | `cd backend && npx jest src/sar/SAR.property.test.js --runInBand` | 4/4 tests passed | PASS |
| Human gate on regulated case transitions | `cd backend && npx jest src/routes/CaseRoutes.property.test.js --runInBand` | 2/2 tests passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PH7-HYBRID-BOUNDARY | 07-01-PLAN.md | Exact graph typology truth claims require deterministic DFS/graph confirmation; AI-only detections remain candidates until confirmed | SATISFIED | Policy gate + orchestrator integration + deterministic evidence properties (`backend/src/policy/HybridBoundaryPolicy.js`, `backend/src/detection/DetectionOrchestrator.js`, `backend/src/detection/DetectionOrchestrator.property.test.js`). |
| PH7-XAI-PACKET | 07-02-PLAN.md | Every alert exposes stable explainability packet with deterministic evidence context, decomposition, evidence-bound rationale, and confidence | SATISFIED | Alert schema + scorer packet construction + route serialization + route/scorer properties (`backend/src/models/Alert.js`, `backend/src/scoring/RiskScorer.js`, `backend/src/routes/alerts.js`, `backend/src/scoring/RiskScorer.property.test.js`, `backend/src/routes/AlertRoutes.hybrid.property.test.js`). |
| PH7-AI-GUARDRAILS | 07-03-PLAN.md | AI outputs are advisory-only with mandatory human decision gates, and AI-generated investigation/SAR content is traceable to source evidence | SATISFIED | Advisory policy + SAR enforcement + case transition gate + property tests (`backend/src/sar/AiAdvisoryPolicy.js`, `backend/src/sar/SARService.js`, `backend/src/routes/cases.js`, `backend/src/sar/SAR.property.test.js`, `backend/src/routes/CaseRoutes.property.test.js`). |

Orphaned requirements check: none. All Phase 7 requirements mapped in ROADMAP/REQUIREMENTS appear in plan `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| N/A | N/A | No TODO/FIXME/placeholder stubs or empty user-visible implementations in phase-critical files | INFO | No blocker anti-pattern detected |

### Human Verification Required

None.

### Gaps Summary

No blocking gaps found. Must-haves, artifacts, links, data flow, requirements coverage, anti-pattern scan, and behavioral spot-checks support Phase 7 goal achievement.

---

_Verified: 2026-04-09T20:39:53Z_
_Verifier: the agent (gsd-verifier)_
