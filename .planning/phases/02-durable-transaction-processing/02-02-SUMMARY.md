---
phase: 02-durable-transaction-processing
plan: 02
subsystem: api
tags: [replay, idempotency, express, jwt, rbac, durability]
requires:
  - phase: 02-01
    provides: durable idempotency ledger and failure persistence for replay
provides:
  - bounded failed-item recovery listing for operators
  - explicit single-item replay endpoint with idempotent no-op handling
  - replay-to-alert integration proof for no duplicate side effects
affects: [transactions, ingestion, integration-tests, operator-recovery]
tech-stack:
  added: []
  patterns: [bounded replay windows, operator-trigger enforcement, ledger-backed replay safety]
key-files:
  created:
    - backend/src/ingestion/ReplayService.js
    - backend/src/routes/transactions.replay.test.js
    - backend/src/integration/replayToAlert.integration.test.js
  modified:
    - backend/src/routes/transactions.js
    - backend/src/models/ProcessingFailure.js
key-decisions:
  - "Replay operations require JWT plus ADMIN/MANAGER RBAC gates at route level."
  - "Replay list requests must include from/to and remain within a 24-hour max window."
  - "Replay requests return noop with duplicate_suppressed=true when ledger is already terminal."
patterns-established:
  - "Recovery routes delegate replay orchestration to ReplayService and keep HTTP validation in routes."
  - "Replay integration tests model failure-first then replay flows to assert single downstream side effects."
requirements-completed: [DET-02]
duration: 3m
completed: 2026-04-10
---

# Phase 02 Plan 02: Durable Transaction Processing Replay Summary

**Operator-triggered bounded replay controls now expose failed-item listing and single-item reprocess with ledger-safe idempotent suppression of duplicate downstream side effects.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T22:21:00Z
- **Completed:** 2026-04-09T22:24:07Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added replay route contracts using TDD-first RED tests for bounded failed-item listing and explicit operator-triggered reprocess.
- Implemented `ReplayService` and wired recovery endpoints in transaction routes with JWT and RBAC (`ADMIN`/`MANAGER`).
- Added replay integration invariants proving repeated replay attempts do not duplicate downstream alert/case/event effects.

## Task Commits

1. **Task 1: Define replay service contracts and failing route tests** - `59ccf54` (test)
2. **Task 2: Implement operator-triggered bounded replay endpoints** - `fbdb031` (feat)
3. **Task 3: Prove replay-to-alert invariants in integration tests** - `91a735e` (test)

## Files Created/Modified

- `backend/src/ingestion/ReplayService.js` - Orchestrates failed-item listing and single-item replay against ledger/failure state.
- `backend/src/routes/transactions.js` - Adds `/recovery/failed` and `/recovery/:failure_id/reprocess` endpoints with auth, RBAC, and bounds validation.
- `backend/src/routes/transactions.replay.test.js` - Verifies replay route contracts, guards, and no-op response semantics.
- `backend/src/integration/replayToAlert.integration.test.js` - Ensures replay emits downstream effects once and suppresses duplicates on repeated replays.
- `backend/src/models/ProcessingFailure.js` - Adds replay audit trace fields (`replayed_at`, `replayed_by_operator_id`, `replay_outcome`).

## Decisions Made

- Enforced operator-only replay trigger (`trigger=operator`) to avoid accidental automated reprocessing.
- Treated non-`FAILED` replay attempts as successful idempotent no-op responses, not hard errors.
- Kept replay window max at 24 hours to satisfy bounded recovery controls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Persisted replay operator audit fields on failure records**
- **Found during:** Task 2
- **Issue:** Replay actions needed durable operator/timestamp/outcome traceability, but failure schema lacked fields.
- **Fix:** Added `replayed_at`, `replayed_by_operator_id`, and `replay_outcome` to failure schema and wrote these during replay handling.
- **Files modified:** `backend/src/models/ProcessingFailure.js`, `backend/src/ingestion/ReplayService.js`
- **Verification:** Route and integration replay tests pass with replay metadata writes in flow.
- **Committed in:** `fbdb031`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required to satisfy replay auditability threat mitigation without scope creep.

## Issues Encountered

- Initial integration replay list query used a static window that excluded runtime failure timestamps; fixed by generating a bounded dynamic window around execution time.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Replay controls are available with bounded operator access and tested idempotency behavior.
- Ready for additional observability or operator UX enhancements on top of replay outcomes.

## Self-Check: PASSED

- Verified files exist for all plan outputs.
- Verified task commit hashes exist in git history.
- Verified required replay route and integration commands pass.
