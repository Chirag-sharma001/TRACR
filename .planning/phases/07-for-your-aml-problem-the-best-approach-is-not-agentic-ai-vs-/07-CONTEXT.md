# Phase 7: Hybrid DFS + AI Responsibility Split - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Define and lock the hybrid operating model for AML detection and investigation support: deterministic DFS/graph algorithms remain the source of truth for exact graph-pattern evidence, while AI/agentic components handle prioritization, explanation, case support, and SAR drafting under explicit guardrails.

This phase clarifies how responsibilities are split and governed; it does not add unrelated product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Deterministic Detection Boundary
- **D-01:** Exact graph-pattern detection (circular fund flows, short transaction loops, and time-bounded path search) is deterministic and algorithmic.
- **D-02:** AI may suggest candidate graph anomalies, but DFS confirmation is required before treating them as true graph-pattern hits.
- **D-03:** Deterministic evidence artifacts (path/loop transactions, involved accounts, bounded time window) are mandatory investigator evidence for graph-pattern alerts.

### AI Responsibility Boundary
- **D-04:** AI responsibilities include behavioral anomaly scoring support, alert prioritization/ranking, case summarization, SAR drafting, and investigator workflow assistance.
- **D-05:** AI outputs are advisory and assistive; AI cannot be the sole authority to close/suppress a case or autonomously file SAR.
- **D-06:** AI-generated outputs must be traceable to source evidence and reviewable by investigators.

### Explainability Contract
- **D-07:** Each alert explanation packet must include deterministic pattern evidence when graph-pattern logic is involved.
- **D-08:** Each alert must include score decomposition (cycle/smurfing/behavioral/geo contribution) for auditability.
- **D-09:** Each alert must include narrative rationale mapped to evidence.
- **D-10:** Each alert must include a confidence level for triage and prioritization context.

### the agent's Discretion
- Naming conventions for internal policy/config keys implementing the boundary.
- Exact API field names for explainability packet payloads, provided they preserve D-07 through D-10 semantics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and requirement anchors
- `.planning/ROADMAP.md` — Phase 7 scope and dependency placement
- `.planning/REQUIREMENTS.md` — Global requirement language for explainability and workflow behavior
- `.planning/PROJECT.md` — Core value and precision/explainability priorities

### Existing detection and scoring implementation
- `backend/src/detection/CycleDetector.js` — deterministic cycle and bounded-window graph detection
- `backend/src/detection/GraphManager.js` — graph representation and evidence traversal primitives
- `backend/src/detection/DetectionOrchestrator.js` — detector orchestration and alert trigger flow
- `backend/src/scoring/RiskScorer.js` — score composition pipeline and breakdown structure
- `backend/src/routes/alerts.js` — current alert/investigator-facing API surface
- `backend/src/models/Alert.js` — persisted alert schema and explainability fields
- `backend/src/sar/SARService.js` — SAR generation and investigator-assist integration point

### Current risks and boundary motivation
- `.planning/codebase/CONCERNS.md` — identified fragility/security/performance concerns relevant to boundary hardening

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CycleDetector` and `GraphManager` already implement deterministic graph analytics suitable for exact-evidence scope.
- `RiskScorer` already composes multiple signal types and stores decomposition metadata.
- `Alert` model and alert routes already expose investigator consumption points for explainability payload extension.
- `SARService` already supports AI-assisted drafting path that can be aligned to advisory-only guardrails.

### Established Patterns
- Event-driven orchestration with `transaction:saved` -> detection -> alert flow.
- Dependency-injected services/routes for testability and policy enforcement.
- Mixed deterministic + heuristic scoring already present, enabling explicit contract hardening rather than rewrite.

### Integration Points
- Boundary enforcement can be introduced at orchestrator and scorer layers.
- Explainability contract can be codified at alert document creation and alert API serialization.
- Guardrails for AI autonomy can be enforced in SAR and case workflow routes/services.

</code_context>

<specifics>
## Specific Ideas

- Keep DFS/graph as exact detection truth for network-money-flow patterns.
- Use AI where decision support is softer: prioritization, explanation drafting, workflow acceleration.
- Maintain clear, auditable investigator evidence and human review authority.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---
*Phase: 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-*
*Context gathered: 2026-04-10*
