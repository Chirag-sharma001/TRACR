---
phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
plan: 01
subsystem: detection
tags: [dfs, aml, policy, fast-check, jest]
requires:
  - phase: 06
    provides: detection orchestration and scoring pipeline
provides:
  - Hybrid boundary policy helpers for deterministic confirmation and AI candidate tagging
  - Orchestrator-level deterministic truth gate metadata on detection and alert payloads
  - Property invariants that enforce deterministic evidence completeness for confirmed graph patterns
affects: [detection, scoring, alerts, explainability]
tech-stack:
  added: []
  patterns: [deterministic-truth-gate, ai-advisory-boundary, evidence-packet-normalization]
key-files:
  created:
    - backend/src/policy/HybridBoundaryPolicy.js
    - backend/src/policy/HybridBoundaryPolicy.test.js
    - backend/src/detection/DetectionOrchestrator.property.test.js
  modified:
    - backend/src/detection/DetectionOrchestrator.js
    - backend/src/detection/DetectionOrchestrator.test.js
key-decisions:
  - "Deterministic graph truth is encoded as hybrid_boundary.graph_pattern with explicit CONFIRMED or CANDIDATE_ONLY states."
  - "AI graph hints are always advisory and cannot produce deterministic evidence without DFS-confirmed cycle signals."
  - "Alert emission includes graph_pattern_status metadata so downstream consumers can distinguish confirmed truth from candidates."
patterns-established:
  - "Boundary Contract: use confirmDeterministicGraphHit before asserting graph-pattern truth."
  - "Evidence Contract: confirmed graph patterns must include transaction_sequence, involved_accounts, and bounded window metadata."
requirements-completed: [PH7-HYBRID-BOUNDARY]
duration: 12min
completed: 2026-04-10
---

# Phase 7 Plan 01: Hybrid Boundary Policy Summary

**Deterministic DFS confirmation now gates graph-pattern truth, while AI graph suggestions are preserved as advisory candidates with normalized evidence metadata.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-09T19:51:00Z
- **Completed:** 2026-04-09T20:03:08Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Implemented reusable hybrid boundary policy helpers that separate deterministic confirmations from AI-only candidate signals.
- Integrated deterministic truth gating in detection orchestration and propagated boundary state into emitted alert payloads.
- Added property-based invariants that lock deterministic evidence requirements for all confirmed graph-pattern outcomes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hybrid boundary policy contract (D-01, D-02, D-03)** - be4f568 (feat)
2. **Task 2: Enforce deterministic truth gate in detection orchestration (D-01, D-02)** - f8d9633 (feat)
3. **Task 3: Add invariant/property tests for deterministic evidence requirements (D-03)** - ce1cd75 (test)

## Files Created/Modified

- backend/src/policy/HybridBoundaryPolicy.js - Introduces confirmDeterministicGraphHit, buildDeterministicEvidence, and markAiCandidate helpers.
- backend/src/policy/HybridBoundaryPolicy.test.js - Unit tests that enforce candidate-vs-confirmed behavior and deterministic evidence packet shape.
- backend/src/detection/DetectionOrchestrator.js - Adds hybrid boundary enforcement during analyze and includes boundary metadata in emitted alert payloads.
- backend/src/detection/DetectionOrchestrator.test.js - Adds regression tests for deterministic confirmation and AI-candidate-only enforcement.
- backend/src/detection/DetectionOrchestrator.property.test.js - Adds property tests for confirmed evidence completeness and bounded window metadata.

## Decisions Made

- Used explicit hybrid boundary metadata (`hybrid_boundary.graph_pattern`) instead of implicit inference so downstream alert flow can safely differentiate truth from advisory candidates.
- Kept cycle signal generation deterministic and layered policy checks on top, avoiding detector algorithm rewrites.
- Added `graph_pattern_status` to emitted alert payloads to prevent accidental treatment of AI hints as confirmed typology hits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing backend dependencies to run orchestrator tests**
- **Found during:** Task 2 (red test run)
- **Issue:** Jest execution failed because runtime dependency `mongoose` was not installed in local environment.
- **Fix:** Ran `npm ci` in backend before continuing the TDD red/green cycle.
- **Files modified:** None tracked in git (dependency installation only)
- **Verification:** Re-ran Task 2 Jest command successfully.
- **Committed in:** N/A (environment-only fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep. Deviation was required to execute planned verification commands.

## Issues Encountered

- Initial orchestrator test execution was blocked by missing local Node modules; resolved with dependency install.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Deterministic boundary contract is now codified and test-protected for Phase 7 follow-on explainability and guardrail work.
- Alert/scoring consumers can read `hybrid_boundary` and `graph_pattern_status` without changing deterministic detector logic.

## Self-Check: PASSED

- Confirmed all files listed above exist in repository.
- Confirmed all task commit hashes are present in git history.

---
*Phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-*
*Completed: 2026-04-10*
