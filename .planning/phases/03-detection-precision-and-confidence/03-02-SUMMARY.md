---
phase: 03-detection-precision-and-confidence
plan: 02
subsystem: api
tags: [observability, telemetry, admin-routes, jest, mongoose]
requires:
  - phase: 03-detection-precision-and-confidence
    provides: persisted precision context and confidence signals from scoring
provides:
  - config-version before/after comparison telemetry with deterministic delta totals
  - admin API contract for dashboard-ready comparison payloads with RBAC gating
  - stable null-safe breakdown dimensions for segment, pattern_type, and confidence_level
affects: [governance-dashboard, admin-telemetry]
tech-stack:
  added: []
  patterns: [api-first telemetry contract, bounded query parsing, deterministic aggregate normalization]
key-files:
  created:
    - .planning/phases/03-detection-precision-and-confidence/03-02-SUMMARY.md
  modified:
    - backend/src/observability/DetectionQualityMetrics.js
    - backend/src/observability/DetectionQualityMetrics.test.js
    - backend/src/routes/admin.js
    - backend/src/routes/AdminTelemetry.contract.test.js
key-decisions:
  - "Comparison telemetry is keyed by explicit before/after config selectors and returns stable before/after/delta sections."
  - "Null or missing dimension values normalize to 'unknown' to prevent schema drift in dashboards."
patterns-established:
  - "Comparison service uses bounded lookback windows and deterministic sorting of aggregate dimensions."
  - "Admin compare endpoint mirrors existing telemetry route conventions and returns telemetry_failed on service errors."
requirements-completed: [DET-01, DET-04]
duration: 10m
completed: 2026-04-10
---

# Phase 03 Plan 02: Detection Precision and Confidence Summary

**Governance comparison telemetry is now exposed as a dashboard-ready before/after/delta API by config version, with segment/pattern/confidence breakdowns and deterministic null-safe keys.**

## Performance

- **Duration:** 10 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added RED tests for service and route comparison contracts, including RBAC and error-contract coverage.
- Implemented `getDetectionQualityComparisonTelemetry` with bounded windows, config-lineage selectors, and stable comparison normalization.
- Added `GET /api/admin/telemetry/detection-quality/compare` with bounded query parsing, ADMIN enforcement, and explicit `telemetry_failed` handling.

## Task Commits

1. **Task 1: Define before/after precision comparison telemetry contract (RED)** - `c560b32` (test)
2. **Task 2: Implement version comparison aggregations in DetectionQualityMetrics** - `66133a4` (feat)
3. **Task 3: Expose admin comparison endpoint and finalize contract coverage** - `6b7fa3b` (feat)

## Files Created/Modified

- `backend/src/observability/DetectionQualityMetrics.js` - adds comparison aggregation + deterministic before/after/delta shaping.
- `backend/src/observability/DetectionQualityMetrics.test.js` - RED/GREEN coverage for dashboard-ready comparison payload.
- `backend/src/routes/admin.js` - adds compare endpoint with bounded selector/window parsing.
- `backend/src/routes/AdminTelemetry.contract.test.js` - route contract tests for compare success, RBAC, and telemetry_failed error behavior.

## Decisions Made

- Keep comparison output API-first and dashboard-ready with deterministic keys (`before`, `after`, `delta`) rather than post-processing/offline exports.
- Normalize missing dimension values to `unknown` for stable rendering and governance drift analysis.

## Deviations from Plan

None - plan executed as written.

## Known Stubs

None.

## Self-Check: PASSED

- Found: backend/src/observability/DetectionQualityMetrics.js
- Found: backend/src/observability/DetectionQualityMetrics.test.js
- Found: backend/src/routes/admin.js
- Found: backend/src/routes/AdminTelemetry.contract.test.js
- Found commit: c560b32
- Found commit: 66133a4
- Found commit: 6b7fa3b
