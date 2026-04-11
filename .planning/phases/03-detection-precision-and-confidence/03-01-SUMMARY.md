---
phase: 03-detection-precision-and-confidence
plan: 01
subsystem: api
tags: [risk-scoring, mongoose, jest, fast-check, precision]
requires:
  - phase: 02-transaction-ingestion-and-pattern-detection-foundation
    provides: deterministic detection signals and replay-safe scoring inputs
provides:
  - segment + pattern + geo-band threshold policy contract with safe fallback defaults
  - policy-backed risk tier classification that preserves LOW/MEDIUM/HIGH semantics
  - deterministic confidence output persisted alongside segment-aware precision context
affects: [03-02, analyst-triage, explainability]
tech-stack:
  added: []
  patterns: [policy-driven threshold resolution, deterministic confidence derivation]
key-files:
  created:
    - backend/src/policy/SegmentAwareThresholdPolicy.js
    - backend/src/policy/SegmentAwareThresholdPolicy.test.js
  modified:
    - backend/src/scoring/RiskScorer.js
    - backend/src/scoring/RiskScorer.property.test.js
    - backend/src/models/Alert.js
key-decisions:
  - "Tier labels remain LOW/MEDIUM/HIGH while cutoff values are policy-resolved by segment/pattern/geo-band."
  - "Confidence stays deterministic and supplementary to risk_tier; precision context is persisted separately."
patterns-established:
  - "SegmentAwareThresholdPolicy validates thresholds and falls back to safe defaults for unknown/invalid keys."
  - "RiskScorer resolves policy context before tier assignment and records threshold lineage in precision_context."
requirements-completed: [DET-01, DET-04]
duration: 3m
completed: 2026-04-10
---

# Phase 03 Plan 01: Detection Precision and Confidence Summary

**Segment-aware threshold policy now drives risk-tier cutoffs while deterministic ordinal confidence and precision context are emitted and persisted for analyst-auditable scoring.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T22:56:44Z
- **Completed:** 2026-04-09T22:58:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added RED contract tests for segment/pattern/geo-aware threshold resolution and safe defaults.
- Implemented SegmentAwareThresholdPolicy and integrated it into RiskScorer classification flow.
- Added persisted precision context in Alert schema while retaining risk_tier/confidence compatibility.

## Task Commits

1. **Task 1: Define segment-aware threshold contract and RED tests** - `7f4a14a` (test)
2. **Task 2: Implement policy-backed scoring and alert persistence updates** - `2ee5ad9` (feat)

## Files Created/Modified
- `backend/src/policy/SegmentAwareThresholdPolicy.js` - Resolves and validates tier cutoffs by segment, pattern, and geo band.
- `backend/src/policy/SegmentAwareThresholdPolicy.test.js` - Contract tests for tuple resolution, fallback behavior, and invalid threshold rejection.
- `backend/src/scoring/RiskScorer.js` - Uses policy-backed thresholds for tier assignment and writes precision context on alerts.
- `backend/src/scoring/RiskScorer.property.test.js` - Adds invariants for deterministic confidence and segment-aware tier behavior.
- `backend/src/models/Alert.js` - Adds precision_context schema to persist policy lineage and resolved thresholds.

## Decisions Made
- Preserve existing LOW/MEDIUM/HIGH tier semantics and only change cutoff source (policy-driven thresholds).
- Persist precision context separately from confidence to keep analyst-facing tier semantics stable and auditable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected segment-aware test fixture to align with geo-band resolution**
- **Found during:** Task 2 verification
- **Issue:** Segment-aware property test expected HIGH-band thresholds while fixture supplied LOW geo score.
- **Fix:** Updated fixture to provide HIGH geo band deterministically without changing composite score semantics.
- **Files modified:** backend/src/scoring/RiskScorer.property.test.js
- **Verification:** `npx jest --runInBand src/policy/SegmentAwareThresholdPolicy.test.js src/scoring/RiskScorer.property.test.js src/models/SystemConfig.test.js`
- **Committed in:** `2ee5ad9`

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** No scope creep; fix ensured plan invariant matched implemented policy contract.

## Issues Encountered
- None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scoring now emits reproducible precision context and deterministic confidence for downstream analyst workflows.
- Plan 03-02 can build on persisted precision context for confidence calibration and triage UX.

## Self-Check: PASSED

- Found: backend/src/policy/SegmentAwareThresholdPolicy.js
- Found: backend/src/policy/SegmentAwareThresholdPolicy.test.js
- Found: backend/src/scoring/RiskScorer.js
- Found: backend/src/scoring/RiskScorer.property.test.js
- Found: backend/src/models/Alert.js
- Found commit: 7f4a14a
- Found commit: 2ee5ad9
