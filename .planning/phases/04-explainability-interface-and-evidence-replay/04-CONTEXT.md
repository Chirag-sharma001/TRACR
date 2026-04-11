# Phase 4: Explainability Interface and Evidence Replay - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 exposes investigator-facing alert explainability interfaces using already-produced scoring artifacts and deterministic evidence context.

In scope:
- Alert explainability interface for per-alert score decomposition and evidence-grounded rationale (EXP-01, EXP-03)
- Evidence path and ordered sequence contracts for investigation use (EXP-02)
- Evidence replay/timeline interface for suspicious movement reconstruction (EXP-04)

Out of scope:
- Investigation ownership/SLA workflow states (Phase 5)
- SAR filing workflow controls and confidentiality hardening (Phase 6)
- New AI decision-making semantics beyond existing advisory guardrails
</domain>

<decisions>
## Locked Decisions

### Explainability Surface
- D-01: Explainability responses must be derived from persisted `explainability_packet` and existing alert evidence fields (no alternate scoring path).
- D-02: Score decomposition must expose cycle, smurfing, behavioral, and geographic components for every alert payload (EXP-01).
- D-03: Narrative rationale must remain evidence-grounded via summary/statements from the same packet used for scoring (EXP-03).

### Evidence Path + Replay
- D-04: Deterministic evidence path output must include linked accounts, edges, transaction IDs, and ordered transaction sequence context (EXP-02).
- D-05: Replay interface must provide timeline-ordered steps suitable for investigator reconstruction of event progression (EXP-04).
- D-06: Replay/timeline ordering is timestamp-first with stable fallback ordering when timestamps are absent.

### Scope/Compatibility
- D-07: Existing alert list/detail contracts remain backward-compatible; new interface routes are additive.
- D-08: Keep implementation in backend API layer and tests only; no frontend/UI framework build in this phase.

### the agent's Discretion
- Internal helper function shapes for path graph and replay timeline payloads.
- Additional route-level contract tests, provided they validate D-01 through D-08 without broadening scope.
</decisions>

<canonical_refs>
## Canonical References

### Scope and Requirements
- `.planning/ROADMAP.md` - Phase 4 goal and success criteria
- `.planning/REQUIREMENTS.md` - EXP-01 through EXP-04 mapping
- `.planning/PROJECT.md` - precision-first and explainability constraints

### Existing Explainability Sources
- `backend/src/scoring/RiskScorer.js` - explainability packet assembly and deterministic evidence construction
- `backend/src/models/Alert.js` - persisted explainability/evidence schema
- `backend/src/routes/alerts.js` - analyst-facing alert payload normalization
- `backend/src/routes/AlertRoutes.hybrid.property.test.js` - existing explainability packet serialization invariants
</canonical_refs>

<specifics>
## Specific Ideas

- Add explicit explainability and evidence replay endpoints under alert routes for investigator workflows.
- Ensure ordered replay output is deterministic and traceable to persisted evidence packet fields.
- Keep API payloads concise but complete for decomposition, evidence path, narrative mapping, and timeline reconstruction.
</specifics>

<deferred>
## Deferred Ideas

- Full visual dashboard implementation for timeline rendering (handled in Phase 5+ UI work).
- AI-authored expanded narratives beyond persisted evidence-bound rationale.
</deferred>

---

*Phase: 04-explainability-interface-and-evidence-replay*
*Context gathered via manual-autonomous phase discussion equivalent*
