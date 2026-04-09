# Phase 1: Governance, Contracts, and Observability - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers governance and observability controls for detection configuration changes. Scope is policy-safe config change lifecycle, audit-ready rollback controls, and calibration/drift telemetry segmentation needed by compliance/admin users.

Out of scope for this phase:
- What-if threshold simulation tooling (deferred)
- Broader model lifecycle/retraining workflows
- Net-new investigator dashboard redesign
</domain>

<decisions>
## Implementation Decisions

### Config Approval Workflow
- D-01: Use two-person control for config publication.
- D-02: Requester cannot self-approve the same config change.
- D-03: Every config change request must carry structured metadata (reason, requester identity, change scope, and target detector/risk scope).
- D-04: Approval is a hard gate before activation; unapproved drafts cannot become active config.

### Observability Metrics Contract
- D-05: Expose precision/drift governance telemetry segmented by detector type (`cycle`, `smurfing`, `behavioral`).
- D-06: Expose metrics segmented by risk tier/segment context.
- D-07: Include threshold/config version lineage in telemetry views so governance can compare behavior across published versions.
- D-08: Provide both daily and weekly windows for drift/calibration trend visibility.

### Rollback and Audit Semantics
- D-09: Rollback is allowed immediately when authorized but requires mandatory rollback reason and linked original change ID.
- D-10: Rollback action must emit immutable audit records for requester/actor, reason, and affected config version.
- D-11: Rollback must restore prior approved config state without manual patching.

### Delivery Surface
- D-12: Phase 1 is backend-first: API contracts + audit artifacts are required; UI additions are optional and non-blocking.

### the agent's Discretion
- Exact API route naming and response field naming (must keep snake_case conventions).
- Internal storage shape for config draft states, provided D-01 through D-12 remain enforceable.
- Telemetry aggregation implementation details, provided required segmentations and windows are present.
</decisions>

<canonical_refs>
## Canonical References

### Planning and Scope
- `.planning/ROADMAP.md` - phase goal, requirements mapping, success criteria
- `.planning/REQUIREMENTS.md` - GOV-03 and DET-03 requirement intent and traceability
- `.planning/PROJECT.md` - precision-first and hybrid-evolution constraints

### Existing Governance and Audit Surfaces
- `backend/src/routes/admin.js` - current admin config and audit endpoints
- `backend/src/scoring/ThresholdConfig.js` - threshold config behavior
- `backend/src/models/SystemConfig.js` - persisted config model
- `backend/src/audit/AuditLogger.js` - audit trail implementation baseline
</canonical_refs>

<specifics>
## Specific Ideas

- Approval-gated config workflow should support draft -> approved -> active lifecycle states.
- Drift telemetry should be usable for governance decisions, not only raw model debugging.
- Rollback should be an explicit governance action with linked provenance, not silent replacement.
</specifics>

<deferred>
## Deferred Ideas

- What-if threshold simulation tooling (future phase, likely advanced governance/intelligence track).
</deferred>

---

*Phase: 01-governance-contracts-and-observability*
*Context gathered via /gsd-discuss-phase interactive questioning*
