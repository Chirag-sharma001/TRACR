# Phase 5: Investigation Workflow Dashboard - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 introduces investigator workflow operations on top of existing case/alert artifacts so ownership, SLA timing, escalation visibility, and manager oversight are operationally enforceable.

In scope:
- Ownership assignment/claim workflow with automatic SLA timer start (WFL-01)
- SLA-derived escalation state updates exposed in case workflow surfaces (WFL-01)
- Case dismissal/no-file path requiring explicit documented rationale when SAR is not filed (WFL-02)
- Manager oversight dashboard for backlog and timeliness triage (WFL-03)

Out of scope:
- SAR draft generation/filing quality checks and deadline windowing controls (Phase 6)
- Realtime dashboard subscriptions and channel hardening (Phase 6 GOV-04)
- New detector/scoring logic and explainability packet changes (Phases 3-4)
</domain>

<decisions>
## Locked Decisions (Bounded to WFL-01..WFL-03)

### Ownership + SLA (WFL-01)
- D-01: Case ownership assignment and self-claim are explicit API actions that always set `assigned_to`.
- D-02: First ownership event starts SLA timing automatically by setting `sla_started_at` and `sla_due_at`.
- D-03: Escalation state is computed from SLA timing into deterministic states: `ON_TRACK`, `AT_RISK`, `BREACHED`.

### Case Progression + No-File Rationale (WFL-02)
- D-04: Transition to `CLOSED_DISMISSED` requires non-empty `no_file_rationale` in addition to existing transition reason.
- D-05: No-file rationale is persisted on case record and captured in transition audit metadata.

### Manager Oversight (WFL-03)
- D-06: Manager dashboard is a backend route that aggregates backlog, escalation, assignment, and aging/timeliness signals from case records.
- D-07: Oversight endpoint is role-gated to manager/admin roles; analysts can continue regular case workflow routes.

### Scope/Compatibility
- D-08: Existing case create/read/notes/state routes remain backward-compatible except explicit new validation for no-file closure rationale.
- D-09: Implementation remains backend API/model/tests only; frontend visualization is deferred.

### the agent's Discretion
- SLA duration and at-risk threshold constants, provided they remain deterministic and test-covered.
- Additional contract/property tests for assignment, escalation, and dashboard payload stability.
</decisions>

<canonical_refs>
## Canonical References

### Scope and Requirements
- `.planning/ROADMAP.md` - Phase 5 goal and success criteria
- `.planning/REQUIREMENTS.md` - WFL-01 through WFL-03 mapping
- `.planning/PROJECT.md` - human-in-the-loop and operational trust constraints

### Existing Workflow Surfaces
- `backend/src/models/Case.js` - case state/assignment persistence
- `backend/src/routes/cases.js` - case create/read/transition/notes workflow
- `backend/src/routes/CaseRoutes.property.test.js` - transition invariants and regulated closure gates
- `backend/src/auth/RBACMiddleware.js` - role-gating pattern used in admin routes
</canonical_refs>

<specifics>
## Specific Ideas

- Add assignment and claim endpoints that initialize SLA fields automatically.
- Extend case model with SLA and escalation fields that can be recomputed deterministically.
- Add manager oversight dashboard route with queue health metrics and triage-ready case rows.
- Require explicit no-file rationale for dismissed/no-file case closure path.
</specifics>

<deferred>
## Deferred Ideas

- Realtime push updates for dashboard widgets.
- SLA policy per segment/risk tier and configurable governance workflow.
- Investigator-facing frontend dashboard implementation details.
</deferred>

---

*Phase: 05-investigation-workflow-dashboard*
*Context gathered via manual-autonomous phase discussion equivalent*
