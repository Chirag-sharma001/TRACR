---
phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
plan: 02
subsystem: explainability
tags: [aml, xai, scoring, jest, fast-check, api]
requires:
  - phase: 07-01
    provides: deterministic graph-pattern boundary metadata and evidence contract
provides:
  - Alert schema explainability packet with persisted confidence_level and deterministic evidence structure
  - Canonical scorer explainability packet with decomposition, evidence-bound narrative mapping, and deterministic confidence
  - Stable investigator API serialization for explainability payloads on alert list/detail endpoints
affects: [scoring, alerts, explainability, investigator-api]
tech-stack:
  added: []
  patterns: [explainability-packet-canonicalization, evidence-bound-narrative, deterministic-confidence-tiering]
key-files:
  created:
    - backend/src/routes/AlertRoutes.hybrid.property.test.js
  modified:
    - backend/src/models/Alert.js
    - backend/src/scoring/RiskScorer.js
    - backend/src/scoring/RiskScorer.property.test.js
    - backend/src/routes/alerts.js
key-decisions:
  - "Persist confidence_level both top-level and inside explainability_packet to keep API compatibility while enforcing contract stability."
  - "Use deterministic evidence references (transaction_ids, involved_accounts, transaction_sequence) as canonical narrative grounding metadata."
  - "Normalize route responses at serialization boundary so missing legacy fields are backfilled without breaking investigator consumers."
patterns-established:
  - "Scorer Contract: emit explainability_packet with deterministic_evidence, score_decomposition, narrative_mapping, confidence_level."
  - "API Contract: normalize alert payloads in routes to guarantee stable explainability shape for list and detail endpoints."
requirements-completed: [PH7-XAI-PACKET]
duration: 13min
completed: 2026-04-10
---

# Phase 7 Plan 02: Explainability Packet Contract Summary

**Alert scoring and investigator APIs now produce a canonical explainability packet with deterministic evidence context, decomposition, evidence-bound narrative metadata, and confidence semantics.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-09T19:59:30Z
- **Completed:** 2026-04-09T20:12:42Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Extended alert persistence schema with explicit confidence and explainability packet structure supporting deterministic evidence references.
- Refactored scorer output to build a canonical explainability packet with decomposition consistency, evidence-mapped narrative metadata, and deterministic confidence calculation.
- Enforced route-level serialization guarantees so alert list and detail APIs always expose the stable explainability contract expected by investigator workflows.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add explainability and confidence schema contract (D-07, D-10)** - bd9a5c3 (feat)
2. **Task 2: Build canonical explainability packet in scorer output (D-08, D-09, D-10)** - e13f1fb (feat)
3. **Task 3: Enforce API serialization contract for explainability packet (D-07 to D-10)** - 912fa27 (feat)

Additional cleanup:
- **Post-task formatting alignment:** 2f45c57 (refactor)

## Files Created/Modified

- backend/src/models/Alert.js - Adds confidence_level and explainability_packet schema contract with deterministic evidence and narrative mapping fields.
- backend/src/scoring/RiskScorer.js - Builds canonical explainability_packet and deterministic confidence_level during alert creation.
- backend/src/scoring/RiskScorer.property.test.js - Adds regression/property coverage for packet decomposition consistency, narrative evidence references, and confidence determinism.
- backend/src/routes/alerts.js - Normalizes list/detail alert payloads into a stable explainability contract for investigator clients.
- backend/src/routes/AlertRoutes.hybrid.property.test.js - Adds route-level property tests proving explainability packet completeness and deterministic evidence serialization.

## Decisions Made

- Kept existing snake_case naming and top-level alert fields while adding explainability_packet to avoid compatibility regressions for current consumers.
- Confidence is deterministic and ordinal (`LOW|MEDIUM|HIGH`) using evidence depth + score composition + overall score, not random or model-dependent factors.
- Route normalization is applied at response boundary to mitigate tampering/omission risk from partial or legacy persisted documents.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed route-test model stub to match `findOne().lean()` contract**
- **Found during:** Task 3 red phase
- **Issue:** Initial test double returned a raw object for `findOne`, causing a 500 unrelated to explainability contract behavior.
- **Fix:** Updated test double to return a chain-compatible object with `lean()` for parity with route query usage.
- **Files modified:** backend/src/routes/AlertRoutes.hybrid.property.test.js
- **Verification:** Re-ran Task 3 test command and observed expected contract-based failures, then passing after route implementation.
- **Committed in:** 912fa27 (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; fix was required for valid TDD signal and route contract verification.

## Issues Encountered

- `rg` was unavailable in the shell environment; switched to workspace-native file search tools and continued execution without impact to plan scope.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Explainability packet contract is now persisted, computed, serialized, and regression-tested for Phase 7 guardrail completion work.
- Investigator-facing alert payloads carry deterministic evidence references and confidence semantics suitable for triage and audit flows.

## Self-Check: PASSED

- Confirmed summary file exists at `.planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-02-SUMMARY.md`.
- Confirmed task and cleanup commit hashes exist in git history: `bd9a5c3`, `e13f1fb`, `912fa27`, `2f45c57`.

---
*Phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-*
*Completed: 2026-04-10*
