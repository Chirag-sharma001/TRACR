---
phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
plan: 03
subsystem: api
tags: [aml, ai-guardrails, sar, cases, policy, jest, fast-check]
requires:
  - phase: 07-01
    provides: deterministic boundary contract and hybrid policy foundation
provides:
  - Reusable advisory-only AI policy contract with regulated-decision human gate checks
  - SAR generation guardrails that keep AI output advisory and evidence-traceable
  - Case transition API enforcement requiring explicit HUMAN decision attribution for regulated outcomes
affects: [sar, cases, investigation-workflow, governance, auditability]
tech-stack:
  added: []
  patterns: [advisory-only-ai-contract, human-decision-gate, evidence-trace-indicator]
key-files:
  created:
    - backend/src/sar/AiAdvisoryPolicy.js
    - backend/src/sar/AiAdvisoryPolicy.test.js
  modified:
    - backend/src/sar/SARService.js
    - backend/src/sar/SAR.property.test.js
    - backend/src/routes/cases.js
    - backend/src/routes/CaseRoutes.property.test.js
key-decisions:
  - "Centralized regulated-action decision gating in AiAdvisoryPolicy so SAR and case routes share the same human-approval contract."
  - "Persisted source-evidence trace references through SAR risk_indicators to maintain traceability without schema expansion in this plan."
  - "Enforced explicit decision_source=HUMAN at the case API boundary for regulated closure transitions."
patterns-established:
  - "Policy Reuse: service and route layers import assertHumanDecisionGate instead of embedding one-off gate logic."
  - "Traceability by Default: SAR drafts always include source evidence references tied to alert/account/transaction identifiers."
requirements-completed: [PH7-AI-GUARDRAILS]
duration: 7min
completed: 2026-04-10
---

# Phase 7 Plan 03: AI Guardrails Summary

**AI-assisted SAR and case workflows are now explicitly advisory-only, evidence-traceable, and blocked from autonomous regulated outcomes without HUMAN-attributed decisions.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-09T20:13:30Z
- **Completed:** 2026-04-09T20:20:53Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added a dedicated AI advisory policy module that enforces human gating for regulated close/suppress/file actions and tags AI outputs as advisory.
- Integrated SAR service guardrails so generated drafts remain advisory-only and include persisted source-evidence references suitable for investigator review.
- Hardened case state transitions to require explicit `decision_source: HUMAN` for regulated closure outcomes, with regression property coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AI advisory policy contract and tests (D-04, D-05)** - `3ad8d70` (feat)
2. **Task 2: Enforce advisory-only SAR generation with evidence traceability (D-04, D-06)** - `3015ea5` (feat)
3. **Task 3: Require explicit human decision source for regulated case transitions (D-05)** - `188a601` (feat)

## Files Created/Modified

- `backend/src/sar/AiAdvisoryPolicy.js` - Defines reusable `assertHumanDecisionGate` and `attachEvidenceTrace` helpers.
- `backend/src/sar/AiAdvisoryPolicy.test.js` - Verifies advisory tagging and autonomous regulated-decision rejection.
- `backend/src/sar/SARService.js` - Applies advisory policy, blocks AI finalization attempts, and persists evidence trace indicators.
- `backend/src/sar/SAR.property.test.js` - Adds coverage for SAR advisory metadata and source-evidence trace behavior.
- `backend/src/routes/cases.js` - Enforces explicit HUMAN decision source for regulated closure transitions.
- `backend/src/routes/CaseRoutes.property.test.js` - Adds randomized and direct checks for decision-source gate enforcement.

## Decisions Made

- Treated regulated outcomes as policy-level responsibilities via a shared helper to avoid drift between route and service boundaries.
- Embedded source evidence trace into persisted SAR indicators (`SOURCE_EVIDENCE_TRACE`) so traceability survives draft storage.
- Kept existing transition rules and SAR precondition checks intact while adding decision-source enforcement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added persisted evidence-trace indicator to SAR draft payload**
- **Found during:** Task 2
- **Issue:** Advisory metadata could be returned at runtime, but source-evidence trace needed guaranteed persisted linkage for review/audit continuity.
- **Fix:** Added a `SOURCE_EVIDENCE_TRACE` indicator containing alert/account/case/transaction references to persisted `risk_indicators`.
- **Files modified:** backend/src/sar/SARService.js
- **Verification:** `npx jest src/sar/SAR.property.test.js --runInBand`
- **Committed in:** `3015ea5` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for D-06 traceability completeness; no architectural scope change.

## Issues Encountered

- Terminal sessions closed intermittently while running targeted Jest commands; reran commands immediately and captured full red/green verification output.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AI guardrails now enforce D-04, D-05, and D-06 at both SAR generation and regulated case-transition boundaries.
- The completed policy module is reusable for additional regulated workflows that need human decision gates.

## Self-Check: PASSED

- Confirmed summary file exists at `.planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-03-SUMMARY.md`.
- Confirmed task commit hashes exist in git history: `3ad8d70`, `3015ea5`, `188a601`.

---
*Phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-*
*Completed: 2026-04-10*
