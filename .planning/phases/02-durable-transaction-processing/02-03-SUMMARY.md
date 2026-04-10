---
phase: 02-durable-transaction-processing
plan: 03
subsystem: observability
tags: [durability, telemetry, admin, replay, backlog]
requires:
  - phase: 02-01
    provides: durable failure and ledger persistence for replay and backlog posture
provides:
  - admin-only processing durability telemetry endpoint
  - bounded backlog/recovery health metrics with stable snake_case schema
  - contract coverage for admin access and response shape
affects: [admin-routes, observability, operations-telemetry]
tech-stack:
  added: []
  patterns: [bounded query windows, aggregate-only telemetry payloads, role-gated admin telemetry]
key-files:
  created:
    - backend/src/observability/DurabilityHealthMetrics.js
    - backend/src/observability/DurabilityHealthMetrics.test.js
    - backend/src/routes/AdminDurabilityTelemetry.contract.test.js
  modified:
    - backend/src/routes/admin.js
key-decisions:
  - "Durability telemetry remains aggregate-only to avoid exposing raw processing payloads across trust boundaries."
  - "Query windows are clamped to hard bounds before aggregation calls for DoS resistance and deterministic polling cost."
  - "Route errors return explicit telemetry_failed to keep operator alerts and dashboards predictable."
patterns-established:
  - "Admin telemetry routes delegate data shaping to dedicated observability services."
  - "Telemetry contract tests validate both schema shape and RBAC behavior."
requirements-completed: [DET-02]
duration: 6m
completed: 2026-04-09
---

# Phase 02 Plan 03: Processing Durability Telemetry Summary

**Implemented admin-facing durability health telemetry that reports backlog count, replay throughput, and oldest outstanding failure age with bounded polling inputs and stable response contracts.**

## Performance

- **Duration:** 6 min
- **Completed:** 2026-04-09T22:27:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added RED contract tests for durability metrics schema, bounded window behavior, and admin route RBAC gating.
- Implemented `DurabilityHealthMetrics.getDurabilityHealth` backed by `ProcessingFailure` and `ProcessingLedger` aggregates.
- Added `GET /api/admin/telemetry/processing-durability` endpoint in admin routes with bounded query inputs and explicit `telemetry_failed` error response.

## Verification

- `cd backend && npx jest --runInBand src/observability/DurabilityHealthMetrics.test.js src/routes/AdminDurabilityTelemetry.contract.test.js` (pass)

## Task Commits

1. **Task 1: Define durability telemetry contract and failing tests** - `f0591ff` (test)
2. **Task 2: Implement durability health aggregation service and admin endpoint** - `49f9f0e` (feat)

## Files Created/Modified

- `backend/src/observability/DurabilityHealthMetrics.js` - Aggregates backlog totals, oldest outstanding age, and 24h replay/failure counts with bounded windows.
- `backend/src/observability/DurabilityHealthMetrics.test.js` - Validates bounded windows and stable zeroed schema when backlog is empty.
- `backend/src/routes/AdminDurabilityTelemetry.contract.test.js` - Verifies endpoint schema and non-admin denial behavior.
- `backend/src/routes/admin.js` - Wires durability telemetry service and exposes new admin endpoint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Numeric zero window input in service was defaulting incorrectly**
- **Found during:** Task 2 GREEN verification
- **Issue:** `week_window_weeks: 0` in direct service input defaulted to fallback instead of clamping to min bound.
- **Fix:** Added finite-number window normalization helper before clamping.
- **Files modified:** `backend/src/observability/DurabilityHealthMetrics.js`
- **Committed in:** `49f9f0e`

## Threat Flags

None.

## Known Stubs

None.

## Self-Check: PASSED

- Verified all plan output files exist.
- Verified task commits `f0591ff` and `49f9f0e` exist in git history.
- Verified required durability telemetry test command passes.
