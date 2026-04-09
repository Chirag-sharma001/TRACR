# Phase 6: SAR Operations and Security Controls - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 operationalizes SAR decision support and security controls so filing workflows are evidence-grounded, deadline-aware, and protected by confidentiality and immutable audit retrieval.

In scope:
- SAR draft generation from linked case + alert evidence with persisted traceability (SAR-01)
- SAR deadline window tracking for upcoming/at-risk/breached operations monitoring (SAR-02)
- Deterministic SAR narrative quality/completeness validation before filing decisions (SAR-03)
- Immutable retrieval of sensitive SAR/case decision audit trails for compliance/audit users (GOV-01)
- Least-privilege confidentiality controls on SAR-sensitive APIs (GOV-02)
- Realtime subscription hardening for approved origins and authorized channel scopes (GOV-04)

Out of scope:
- Autonomous SAR filing or AI final filing authority (human-in-the-loop remains mandatory)
- New detector/scoring model behavior changes
- Frontend UI build-out for SAR operations dashboards
</domain>

<decisions>
## Locked Decisions (Bounded to SAR-01..03 and GOV-01..02..04)

### SAR Draft Operations
- D-01: Case-centric SAR draft endpoint generates drafts from the case-linked alert and persists `sar_draft_id` on the case.
- D-02: Generated draft responses must include evidence trace metadata binding alert/case/account/transaction identifiers.

### Deadline Tracking
- D-03: SAR timeliness is computed from a deterministic case deadline field with fallback derivation from case creation timestamp.
- D-04: Timeliness dashboard buckets cases into `UPCOMING`, `AT_RISK`, and `BREACHED` windows for compliance triage.

### Quality/Completeness Validation
- D-05: Pre-filing validation is deterministic and rule-based (no AI final authority), checking required narrative sections and evidence references.
- D-06: Validation output must return machine-readable status (`ready_to_file`, `issues`, `quality_score`) for workflow gating.

### Security and Governance
- D-07: SAR-sensitive endpoints are role-gated to least-privilege operational roles.
- D-08: Sensitive audit retrieval is exposed through a dedicated filtered endpoint returning immutable record views.
- D-09: Realtime graph subscriptions are accepted only from approved origins and only when requested channel scopes are authorized for the connected principal.

### Scope/Compatibility
- D-10: Existing alert/case routes remain backward-compatible; Phase 6 behavior is additive except stricter access control on SAR-sensitive operations.
- D-11: Existing Phase 1 immutable audit logger remains source of truth; Phase 6 adds retrieval and filtering contracts only.

### the agent's Discretion
- Exact threshold windows for `UPCOMING` and `AT_RISK`, provided they are deterministic and test-covered.
- Additional contract tests for security denials and realtime guardrails.
</decisions>

<canonical_refs>
## Canonical References

### Scope and Requirements
- `.planning/ROADMAP.md` - Phase 6 goal and success criteria
- `.planning/REQUIREMENTS.md` - SAR-01..03 and GOV-01/02/04 mappings
- `.planning/PROJECT.md` - human-in-the-loop compliance constraints

### Existing Surfaces
- `backend/src/sar/SARService.js` - SAR draft generation and advisory policy hooks
- `backend/src/routes/cases.js` - investigation workflow, transitions, and ownership controls
- `backend/src/routes/alerts.js` - alert-linked SAR generation route
- `backend/src/routes/admin.js` - admin audit retrieval baseline
- `backend/src/realtime/SocketGateway.js` - realtime subscription gateway
- `backend/src/audit/AuditLogger.js` - immutable metadata persistence behavior
</canonical_refs>

<specifics>
## Specific Ideas

- Add case-level SAR operations routes: draft generation, quality check, and deadline dashboard.
- Add SAR quality validation helper in SAR service for deterministic pre-filing checks.
- Add sensitive audit endpoint with strict action filtering and immutable digest metadata.
- Add role-based restrictions for SAR generation on alert routes.
- Enforce approved origin and channel-scope authorization in realtime graph subscriptions.
</specifics>

<deferred>
## Deferred Ideas

- Dynamic SAR deadline policy by jurisdiction/typology.
- Realtime SAR channel streams and separate queue operations sockets.
- Human review workflow UI and filing package export integration.
</deferred>

---

*Phase: 06-sar-operations-and-security-controls*
*Context gathered via manual-autonomous phase discussion equivalent*