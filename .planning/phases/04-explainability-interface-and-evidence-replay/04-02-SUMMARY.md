---
phase: 04-explainability-interface-and-evidence-replay
plan: 02
subsystem: api
tags: [replay, timeline, evidence, alerts, jest]
requires:
  - phase: 04-explainability-interface-and-evidence-replay
    provides: explainability payload normalization in alert routes
provides:
  - additive evidence replay endpoint with deterministic timeline ordering
  - fallback replay synthesis from transaction_ids when sequence edges are absent
  - replay provenance metadata (`sequence_source`) for investigator traceability
affects: [investigation-reconstruction, alert-evidence-replay]
tech-stack:
  added: []
  patterns: [timestamp-first deterministic ordering, stable fallback reconstruction]
key-files:
  created:
    - backend/src/routes/AlertEvidenceReplay.contract.test.js
  modified:
    - backend/src/routes/alerts.js
key-decisions:
  - "Timeline ordering is timestamp-first with deterministic transaction_id/order fallback."
  - "Sparse evidence uses transaction_ids fallback with explicit source provenance."
patterns-established:
  - "`GET /api/alerts/:id/evidence-replay` emits timeline + storyline + provenance for replayability."
requirements-completed: [EXP-04]
duration: 16m
completed: 2026-04-10
---

# Phase 04 Plan 02: Evidence Replay Summary

**Implemented a replayable timeline interface for suspicious movement with deterministic ordering and explicit provenance metadata.**

## Accomplishments

- Added RED/GREEN contract tests for `GET /api/alerts/:id/evidence-replay`.
- Implemented replay timeline construction from sequence edges with stable timestamp ordering.
- Added fallback timeline synthesis from `transaction_ids` plus `sequence_source` metadata.

## Task Commits

1. **Task 1 + baseline replay endpoint implementation** - `f8fb26a` (feat)
2. **Task 2 refinement: replay provenance metadata contract** - `458c366` (feat)

## Files Created/Modified

- `backend/src/routes/AlertEvidenceReplay.contract.test.js` - Replay contract tests for ordering/fallback/not_found.
- `backend/src/routes/alerts.js` - Evidence replay endpoint and timeline normalization helpers.

## Verification

- `cd backend && npx jest --runInBand src/routes/AlertEvidenceReplay.contract.test.js src/routes/AlertExplainability.contract.test.js`
- Result: PASS
