---
phase: 05-investigation-workflow-dashboard
plan: 01
subsystem: case-workflow
tags: [investigation, assignment, sla, escalation]
requires:
  - phase: 04-explainability-interface-and-evidence-replay
    provides: alert/case investigation context and explainability evidence surfaces
provides:
  - assignment and claim workflow contracts with automatic SLA timer activation
  - deterministic escalation state computation for workflow consumers
affects: [investigator-ownership, case-triage]
tech-stack:
  added: []
  patterns: [deterministic SLA state derivation, additive case-route workflow actions]
key-files:
  created:
    - backend/src/routes/CaseWorkflow.contract.test.js
  modified:
    - backend/src/models/Case.js
    - backend/src/routes/cases.js
key-decisions:
  - "First ownership event starts SLA tracking automatically and preserves deterministic due window behavior."
  - "Escalation state is derived from SLA timestamps as ON_TRACK/AT_RISK/BREACHED and surfaced in case payloads."
patterns-established:
  - "POST /api/cases/:id/claim and PATCH /api/cases/:id/assignment provide ownership operations with SLA defaults."
requirements-completed: [WFL-01]
duration: 35m
completed: 2026-04-10
---

# Phase 05 Plan 01: Ownership and SLA Workflow Summary

**Implemented investigator ownership actions with automatic SLA timing and deterministic escalation signaling.**

## Accomplishments

- Added case SLA persistence fields (`sla_started_at`, `sla_due_at`, `escalation_state`) and no-file rationale field in schema.
- Implemented `POST /api/cases/:id/claim` and `PATCH /api/cases/:id/assignment` route contracts.
- Added contract tests validating assignment/claim SLA initialization and escalation behavior.

## Task Commits

1. **Ownership + SLA implementation with route contracts** - `bb49a3e` (feat)

## Files Created/Modified

- `backend/src/models/Case.js` - SLA/escalation workflow fields.
- `backend/src/routes/cases.js` - assignment/claim operations and escalation helpers.
- `backend/src/routes/CaseWorkflow.contract.test.js` - route contract tests for ownership and SLA semantics.

## Verification

- `cd backend && npx jest --runInBand src/routes/CaseWorkflow.contract.test.js`
- Result: PASS
