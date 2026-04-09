# Phase 3: Detection Precision and Confidence - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 improves alert precision and confidence signaling by introducing segment-aware threshold behavior and explicit confidence indicators tied to existing scoring outputs.

In scope:
- Confidence indicator contract for alerts
- Segment-aware threshold policy behavior
- Before/after governance comparison support by config version

Out of scope:
- Full ML retraining loops
- Analyst-feedback reinforcement learning systems
</domain>

<decisions>
## Implementation Decisions

### Confidence Contract
- D-01: Confidence output is ordinal with values `{LOW, MEDIUM, HIGH}`.
- D-02: Confidence must be deterministic from available scoring/evidence signals (not opaque model-only output).
- D-03: Confidence output must remain compatible with existing risk tier semantics (supplementary, not replacement).

### Segment-Aware Threshold Policy
- D-04: Threshold policy must vary by customer/account risk segment.
- D-05: Threshold policy must account for pattern type (`cycle`, `smurfing`, `behavioral`).
- D-06: Threshold policy must account for geography risk band.

### Governance Comparison
- D-07: Compliance/manager users need before/after precision comparison by config version.
- D-08: Comparison outputs should be exposed as dashboard-ready API contracts (not CSV-only).

### the agent's Discretion
- Internal weighting formulas and calibration heuristics, as long as D-01 through D-08 remain true.
- Exact API field names and persistence schema details, while preserving snake_case and existing route/model conventions.
</decisions>

<canonical_refs>
## Canonical References

### Scope and Requirements
- `.planning/ROADMAP.md` - Phase 3 goal and success criteria
- `.planning/REQUIREMENTS.md` - DET-01 and DET-04 mapping
- `.planning/PROJECT.md` - precision-first and hybrid evolution constraints

### Existing Precision/Scoring Surface
- `backend/src/scoring/RiskScorer.js` - current scoring and tier assignment behavior
- `backend/src/scoring/ThresholdConfig.js` - threshold retrieval/config behavior
- `backend/src/models/Alert.js` - alert persistence contract
- `backend/src/routes/alerts.js` - analyst-facing alert payloads
- `backend/src/routes/admin.js` - governance/admin telemetry patterns from prior phases
</canonical_refs>

<specifics>
## Specific Ideas

- Confidence should be explainable from concrete score decomposition and policy factors.
- Segment-aware thresholds should be versioned so governance can compare precision drift pre/post updates.
- Preserve current analyst workflow expectations while adding confidence context for triage.
</specifics>

<deferred>
## Deferred Ideas

- Full ML retraining loop for adaptive precision optimization.
</deferred>

---

*Phase: 03-detection-precision-and-confidence*
*Context gathered via /gsd-discuss-phase interactive questioning*
