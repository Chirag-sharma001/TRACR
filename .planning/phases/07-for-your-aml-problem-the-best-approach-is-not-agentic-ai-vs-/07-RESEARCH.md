# Phase 7: Hybrid DFS + AI Responsibility Split - Research

**Researched:** 2026-04-10
**Domain:** Hybrid AML boundary architecture (deterministic graph detection + AI assistive workflows)
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- None - discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 7 should be planned as a boundary-hardening phase, not a net-new detector rewrite: DFS/graph logic remains system-of-record for exact money-flow patterns, while AI is explicitly constrained to assistive outputs (prioritization, rationale drafting, investigation acceleration, SAR drafting) with mandatory human review gates. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md] [VERIFIED: backend/src/detection/CycleDetector.js] [VERIFIED: backend/src/scoring/RiskScorer.js] [VERIFIED: .planning/REQUIREMENTS.md]

The codebase already contains most primitives needed for this split: deterministic cycle/path evidence (`CycleDetector` + `GraphManager`), decomposition-ready scoring (`RiskScorer` + `Alert.score_breakdown`), and AI-assisted SAR generation (`SARService`/`GeminiClient`) with partial-response fallback behavior. This reduces implementation risk if planning focuses on policy contracts, explainability payload schema, and enforcement points in orchestrator/routes rather than introducing parallel subsystems. [VERIFIED: backend/src/detection/CycleDetector.js] [VERIFIED: backend/src/detection/GraphManager.js] [VERIFIED: backend/src/models/Alert.js] [VERIFIED: backend/src/sar/SARService.js] [VERIFIED: backend/src/sar/GeminiClient.js]

A critical planning issue: the current SAR AI SDK (`@google/generative-ai`) is marked deprecated and EOL (2025-08-31) by the package page, while Google recommends migration to Google Gen AI SDK. This must be handled either as explicit scope inside Phase 7 or as a dependency-risk follow-up phase. [CITED: https://www.npmjs.com/package/@google/generative-ai] [CITED: https://ai.google.dev/gemini-api/docs/migrate] [VERIFIED: npm registry @google/genai 1.49.0 published 2026-04-08]

**Primary recommendation:** Plan Phase 7 around a strict policy layer (deterministic truth gate + AI advisory gate + evidence binding contract) and include explicit decision on Gemini SDK migration before execution starts. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md] [CITED: https://www.npmjs.com/package/@google/generative-ai]

## Project Constraints (from copilot-instructions.md)

- Architecture must remain hybrid evolution of existing backend modules; do not plan a greenfield rewrite. [VERIFIED: copilot-instructions.md]
- Ingestion-to-alert flow should preserve near-real-time target (under 1 minute). [VERIFIED: copilot-instructions.md]
- Precision-first tradeoff is preferred for v1 when precision conflicts with recall. [VERIFIED: copilot-instructions.md]
- Deliverables should balance analyst, investigator, and manager personas rather than optimizing for one role only. [VERIFIED: copilot-instructions.md]
- Preserve existing conventions: route factory pattern (`createXRoutes`), EventEmitter contracts, CommonJS modules, dependency injection in services, snake_case API fields. [VERIFIED: copilot-instructions.md] [VERIFIED: backend/src/routes/alerts.js] [VERIFIED: backend/src/events/eventBus.js]
- Testing stack is Jest with tests rooted in `backend/src`; planning must include executable verification commands. [VERIFIED: backend/jest.config.js] [VERIFIED: backend/package.json]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 (latest: 5.2.1, published 2025-12-01) | HTTP API and middleware boundaries for policy enforcement | Existing production surface and route factory pattern already centered on Express. [VERIFIED: backend/package.json] [VERIFIED: npm registry] |
| mongoose | repo pinned `^8.19.1` (latest: 9.4.1, published 2026-04-03) | Alert/case/audit persistence and schema contracts | Existing models and query paths depend on Mongoose behavior; major upgrade should be isolated from Phase 7 unless required. [VERIFIED: backend/package.json] [VERIFIED: backend/src/models/Alert.js] [VERIFIED: npm registry] |
| socket.io | 4.8.3 (latest: 4.8.3, published 2025-12-23) | Realtime alert/metrics distribution | Existing event fan-out and dashboards already wired through SocketGateway. [VERIFIED: backend/src/realtime/SocketGateway.js] [VERIFIED: npm registry] |
| ajv + ajv-formats | 8.18.0 / 3.0.1 (published 2026-02-14 / 2024-03-30) | Input and contract validation | Avoid custom schema validation logic for explainability payload additions. [VERIFIED: backend/package.json] [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | 9.0.3 (published 2025-12-04) | Authn context for investigator actions and AI assist endpoints | Apply to all alert/case/SAR routes carrying sensitive data. [VERIFIED: backend/src/auth/JWTMiddleware.js] [VERIFIED: backend/src/routes/alerts.js] [VERIFIED: npm registry] |
| @google/generative-ai | 0.24.1 (published 2025-04-29) | Current SAR draft generation client | Use only as transitional dependency due deprecation and EOL notice. [VERIFIED: backend/src/sar/GeminiClient.js] [CITED: https://www.npmjs.com/package/@google/generative-ai] |
| @google/genai | 1.49.0 (published 2026-04-08) | Recommended successor SDK for Gemini API usage | Use for migration path and long-term support. [VERIFIED: npm registry] [CITED: https://ai.google.dev/gemini-api/docs/migrate] |
| jest + fast-check | 30.3.0 / 4.6.0 (published 2026-03-10 / 2026-03-08) | Unit/integration/property checks for boundary contract invariants | Use to lock deterministic-vs-AI boundary rules and non-regression on detector outputs. [VERIFIED: backend/package.json] [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process EventEmitter orchestration | External queue/event broker | Better scale/replay semantics but adds infra complexity and is outside current phase scope. [ASSUMED] |
| `@google/generative-ai` | `@google/genai` | Migration effort now vs avoiding legacy/EOL risk later. [CITED: https://www.npmjs.com/package/@google/generative-ai] [CITED: https://ai.google.dev/gemini-api/docs/migrate] |

**Installation:**
```bash
# Optional only if Phase 7 includes SDK migration scope
cd backend
npm install @google/genai
```

**Version verification:**
```bash
npm view express version
npm view mongoose version
npm view socket.io version
npm view ajv version
npm view ajv-formats version
npm view jsonwebtoken version
npm view @google/generative-ai version
npm view @google/genai version
npm view jest version
npm view fast-check version
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── detection/                 # Deterministic graph and anomaly signal generation (source-of-truth for exact graph patterns)
├── scoring/                   # Risk decomposition, confidence derivation, ranking policies
├── policy/                    # NEW: explicit boundary policy contracts (deterministic_required, ai_advisory_only)
├── explainability/            # NEW: packet builders binding evidence + decomposition + narrative + confidence
├── sar/                       # AI-assisted SAR draft generation behind human review guards
└── routes/                    # Investigator-facing and manager-facing API with authorization + audit hooks
```

### Pattern 1: Deterministic Truth Gate
**What:** Exact graph typologies must be validated by deterministic detectors before pattern-type assertions are persisted or surfaced. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md]
**When to use:** Any alert path involving circular flows, short loops, or time-bounded path claims. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md]
**Example:**
```javascript
// Source: backend/src/detection/DetectionOrchestrator.js
const [cycles, smurfingSignal, behavioralSignal] = await Promise.all([
  this.cycleDetector.detectCycles(...),
  this.smurfingDetector.evaluateSmurfing(...),
  this.behavioralProfiler.scoreAnomaly(...),
]);

const result = {
  cycle_signals: cycles,
  smurfing_signal: smurfingSignal,
  behavioral_signal: behavioralSignal,
};
```

### Pattern 2: Evidence-Bound Explainability Packet
**What:** Assemble alert explanation packet from deterministic evidence, weighted decomposition, narrative, and confidence in one immutable shape. [VERIFIED: .planning/REQUIREMENTS.md] [ASSUMED]
**When to use:** At alert creation and alert API serialization boundaries. [VERIFIED: backend/src/scoring/RiskScorer.js] [VERIFIED: backend/src/routes/alerts.js]
**Example:**
```javascript
// Source: backend/src/scoring/RiskScorer.js
score_breakdown: {
  cycle_score,
  smurfing_score,
  behavioral_score,
  geographic_score,
  ...weights,
},
cycle_detail: detectionResult.cycle_signals?.[0] || null,
smurfing_detail: detectionResult.smurfing_signal || null,
behavioral_detail: detectionResult.behavioral_signal || null,
```

### Pattern 3: AI Advisory Gate with Human-In-The-Loop Decision
**What:** AI-generated outputs remain assistive and cannot finalize regulated actions. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md]
**When to use:** SAR generation, ranking recommendation, case summarization, and workflow suggestion. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md]
**Example:**
```javascript
// Source: backend/src/routes/alerts.js
const sarDraft = await sarService.generateSAR({
  alert,
  account: req.body?.account || null,
  generatedBy: req.user.user_id,
  caseId: req.body?.case_id || null,
});

return res.status(202).json({ sar_id: sarDraft.sar_id, is_partial: sarDraft.is_partial });
```

### Anti-Patterns to Avoid
- **AI decides graph pattern truth:** Violates D-01/D-02 and breaks explainability defensibility. Use DFS confirmation before persistence. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md]
- **Narrative without evidence IDs:** Produces non-auditable rationale and raises compliance risk. Bind narrative fragments to transaction/account evidence identifiers. [ASSUMED]
- **Parallel unsynchronized scoring logic in AI layer:** Causes drift between deterministic decomposition and narrative claims. Keep one canonical scoring source (`RiskScorer`). [VERIFIED: backend/src/scoring/RiskScorer.js]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph cycle/path traversal | New custom graph engine in Phase 7 | Existing `GraphManager` + `CycleDetector` | Already tested and aligned to bounded-window evidence output. [VERIFIED: backend/src/detection/GraphManager.js] [VERIFIED: backend/src/detection/CycleDetector.js] |
| Schema validation for explainability payloads | Ad-hoc if/else validators | AJV schema contracts | Reduces silent contract drift and runtime inconsistencies. [VERIFIED: backend/package.json] [ASSUMED] |
| AI queueing/retry semantics | Manual Promise pools per route | Existing `SARQueue` abstraction | Centralizes concurrency control and retry behavior for SAR path. [VERIFIED: backend/src/sar/SARService.js] |
| Auth and role checks | Custom token parsing in route handlers | Existing JWT/RBAC middleware | Prevents duplicated auth bugs and inconsistent authorization. [VERIFIED: backend/src/auth/JWTMiddleware.js] [VERIFIED: backend/src/auth/RBACMiddleware.js] |

**Key insight:** Phase 7 success depends more on contract enforcement and provenance metadata than on adding new algorithms; custom re-implementation of solved modules increases risk without improving compliance outcomes. [VERIFIED: backend/src/detection/CycleDetector.js] [VERIFIED: backend/src/scoring/RiskScorer.js] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Boundary Drift Between AI Narrative and Deterministic Evidence
**What goes wrong:** Narrative claims a typology not present in deterministic signals. [ASSUMED]
**Why it happens:** Narrative generation runs without explicit evidence-binding schema. [ASSUMED]
**How to avoid:** Require narrative references to `transaction_ids`, `involved_accounts`, and detector output IDs in packet builder. [VERIFIED: backend/src/models/Alert.js] [ASSUMED]
**Warning signs:** High volume of narrative statements without matching path/timeline artifacts. [ASSUMED]

### Pitfall 2: Missing Confidence Signal in Alert API
**What goes wrong:** Analysts cannot triage effectively and over-trust weak alerts. [VERIFIED: .planning/REQUIREMENTS.md]
**Why it happens:** Current `Alert` schema has no dedicated `confidence` field. [VERIFIED: backend/src/models/Alert.js]
**How to avoid:** Add explicit confidence derivation and persist it as first-class field/versioned contract. [ASSUMED]
**Warning signs:** UI fallback to risk tier as proxy for confidence. [ASSUMED]

### Pitfall 3: Legacy Gemini SDK Risk
**What goes wrong:** Operational/API drift or unsupported SDK behavior impacts SAR drafting reliability. [CITED: https://www.npmjs.com/package/@google/generative-ai]
**Why it happens:** Current dependency is deprecated and EOL-dated; migration not yet scheduled. [CITED: https://www.npmjs.com/package/@google/generative-ai]
**How to avoid:** Time-box migration decision in Phase 7 planning and add adapter layer in `GeminiClient`. [VERIFIED: backend/src/sar/GeminiClient.js] [ASSUMED]
**Warning signs:** Increased partial SAR responses and maintenance burden around model/API changes. [VERIFIED: backend/src/sar/GeminiClient.js] [ASSUMED]

## Code Examples

Verified patterns from existing implementation and official docs:

### Deterministic Evidence Artifact Shape
```javascript
// Source: backend/src/detection/CycleDetector.js
cycles.push({
  pattern_type: "CIRCULAR_TRADING",
  involved_accounts: accountIds,
  transaction_sequence: cycleEdges.map((cEdge) => ({
    from: cEdge.from,
    to: cEdge.to,
    amount: cEdge.amount,
    timestamp: new Date(cEdge.timestamp).toISOString(),
    txId: cEdge.txId,
  })),
  cycle_score: score,
  window_type: isRelaxed ? "RELAXED" : "STRICT",
});
```

### AI Prompt Grounding with Decomposition Inputs
```javascript
// Source: backend/src/sar/PromptBuilder.js
JSON.stringify(
  {
    pattern_type: alert.pattern_type,
    risk_score: alert.risk_score,
    risk_tier: alert.risk_tier,
    score_breakdown: alert.score_breakdown,
    cycle_detail: alert.cycle_detail,
    smurfing_detail: alert.smurfing_detail,
    behavioral_detail: alert.behavioral_detail,
    transaction_ids: alert.transaction_ids,
  },
  null,
  2
)
```

### Express Policy Boundary Placement
```javascript
// Source: https://expressjs.com/
const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World!')
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary framing: "AI vs deterministic" | Responsibility split: deterministic truth + AI assistive augmentation | Current phase strategy (2026 planning) | Better auditability while preserving productivity gains from AI. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-CONTEXT.md] |
| Legacy Gemini JS SDK (`@google/generative-ai`) | Google Gen AI SDK (`@google/genai`) | New SDK introduced with Gemini 2.0 (late 2024); migration guidance updated 2026-01-22 | Planning should include migration path or explicit technical debt acceptance. [CITED: https://ai.google.dev/gemini-api/docs/migrate] [CITED: https://www.npmjs.com/package/@google/generative-ai] [VERIFIED: npm registry] |

**Deprecated/outdated:**
- `@google/generative-ai`: package page marks it deprecated with limited maintenance and EOL notice. [CITED: https://www.npmjs.com/package/@google/generative-ai]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing EventEmitter topology is sufficient for Phase 7 throughput without broker introduction. | Standard Stack / Alternatives | May under-estimate production queuing/backpressure needs. |
| A2 | Confidence can be derived from existing detector/scorer signals without model retraining. | Common Pitfalls | Could produce misleading triage confidence if heuristic is weak. |
| A3 | Narrative evidence-binding can be enforced at API/persistence layer without UI contract changes in this phase. | Architecture Patterns | Could cause downstream consumer breakage if UI assumes current payload shape. |

## Open Questions Resolution

1. **Which requirements IDs are formally assigned to Phase 7?**
  - **Status:** RESOLVED.
  - **Decision:** Phase 7 uses dedicated IDs `PH7-HYBRID-BOUNDARY`, `PH7-XAI-PACKET`, and `PH7-AI-GUARDRAILS`.
  - **Evidence:** `.planning/REQUIREMENTS.md` traceability includes all three IDs mapped to Phase 7; `.planning/ROADMAP.md` Phase 7 requirements updated and plan files reference these IDs. [VERIFIED: .planning/REQUIREMENTS.md] [VERIFIED: .planning/ROADMAP.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-01-PLAN.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-02-PLAN.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-03-PLAN.md]

2. **Is Gemini SDK migration in-scope for Phase 7 or deferred?**
  - **Status:** RESOLVED (DEFERRED).
  - **Decision:** Migration is deferred from Phase 7 execution scope; Phase 7 focuses on boundary/policy/explainability/guardrail enforcement. Migration remains a tracked technical risk and candidate follow-up phase.
  - **Evidence:** Phase 7 execution plans do not include migration tasks or files and instead scope work to boundary policy, explainability contract, and AI guardrails. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-01-PLAN.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-02-PLAN.md] [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-03-PLAN.md]

3. **What confidence model definition should be audited?**
  - **Status:** RESOLVED.
  - **Decision:** Use an explicit ordinal confidence contract with `confidence_level` in `{LOW, MEDIUM, HIGH}` tied to deterministic evidence strength and score composition invariants.
  - **Evidence:** Confidence is explicitly required in Plan 02 schema/scorer/API tasks and acceptance criteria. [VERIFIED: .planning/phases/07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-/07-02-PLAN.md]

All prior open questions are now resolved or explicitly deferred with scope rationale.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime + tests | YES | v22.18.0 | - |
| npm | Dependency management/test scripts | YES | 10.9.3 | - |
| MongoDB server (`mongod`) | Transaction/alert/case persistence | NO | - | Run MongoDB via Docker container for local execution. [ASSUMED] |
| Mongo shell (`mongosh`) | Operational diagnostics and DB smoke checks | NO | - | Use app-level integration tests and Docker exec shell. [ASSUMED] |
| Docker | Local fallback for MongoDB service | YES | 29.2.1 | - |
| Gemini API key (`GEMINI_API_KEY`) | Full SAR generation (non-partial) | UNKNOWN | - | System already returns partial SAR payload when key missing. [VERIFIED: backend/src/sar/GeminiClient.js] |

**Missing dependencies with no fallback:**
- None identified for planning/documentation work. [VERIFIED: local environment probe]

**Missing dependencies with fallback:**
- MongoDB runtime tooling missing locally; Docker fallback available for execution/testing. [VERIFIED: local environment probe] [ASSUMED]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + fast-check 4.6.0 [VERIFIED: backend/package.json] [VERIFIED: npm registry] |
| Config file | `backend/jest.config.js` [VERIFIED: backend/jest.config.js] |
| Quick run command | `cd backend && npm test -- src/detection/DetectionOrchestrator.test.js -i` [ASSUMED] |
| Full suite command | `cd backend && npm test` [VERIFIED: backend/package.json] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 / D-02 | Deterministic graph detection remains source-of-truth for exact patterns | unit + integration | `cd backend && npm test -- src/detection/DetectionOrchestrator.test.js -i` | YES |
| D-07 / EXP-01 / EXP-02 | Explanation packet includes decomposition + graph evidence artifacts | unit | `cd backend && npm test -- src/scoring/RiskScorer.property.test.js -i` | YES |
| D-09 / EXP-03 | Narrative is evidence-grounded and traceable | unit | `cd backend && npm test -- src/sar/SAR.property.test.js -i` | YES |
| D-05 / SAR-01 | SAR drafting remains advisory and human-triggered route | integration | `cd backend && npm test -- src/routes/CaseRoutes.property.test.js -i` | YES |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- <affected test file> -i` [ASSUMED]
- **Per wave merge:** `cd backend && npm test` [VERIFIED: backend/package.json]
- **Phase gate:** Full suite green before `/gsd-verify-work`. [VERIFIED: .planning/config.json workflow.verifier=true]

### Wave 0 Gaps
- [ ] `backend/src/routes/alerts.hybrid-boundary.test.js` - covers deterministic-vs-AI policy enforcement and explainability packet contract. [ASSUMED]
- [ ] `backend/src/sar/GeminiClient.adapter.test.js` - covers migration-safe client adapter behavior if SDK migration included. [ASSUMED]
- [ ] `backend/src/scoring/confidence.contract.test.js` - covers confidence derivation invariants and serialization. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT middleware + bearer token verification. [VERIFIED: backend/src/auth/JWTMiddleware.js] |
| V3 Session Management | yes | Stateless JWT token handling with explicit auth middleware boundaries. [VERIFIED: backend/src/auth/JWTMiddleware.js] [ASSUMED] |
| V4 Access Control | yes | RBAC middleware for role-based route protection; extend to alert/case scope constraints. [VERIFIED: backend/src/auth/RBACMiddleware.js] [VERIFIED: backend/src/routes/admin.js] |
| V5 Input Validation | yes | AJV schema validation for ingestion and payload contracts. [VERIFIED: backend/src/ingestion/TransactionValidator.js] |
| V6 Cryptography | yes | `bcrypt` for password hashing and `jsonwebtoken` for signed auth tokens; avoid custom crypto primitives. [VERIFIED: backend/src/routes/auth.js] [VERIFIED: backend/package.json] |

### Known Threat Patterns for Node/Express AML Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt/data injection into AI narrative | Tampering | Strict prompt grounding on persisted evidence + output schema validation + human review gate. [VERIFIED: backend/src/sar/PromptBuilder.js] [ASSUMED] |
| Unauthorized SAR/alert access | Information Disclosure | JWT auth + RBAC + route-level ownership scoping checks. [VERIFIED: backend/src/routes/alerts.js] [VERIFIED: backend/src/auth/RBACMiddleware.js] [ASSUMED] |
| WebSocket origin abuse | Spoofing | Restrict Socket.IO CORS origins and scope subscriptions by authorization claims. [VERIFIED: backend/src/realtime/SocketGateway.js] [ASSUMED] |
| Event contract drift causing silent policy bypass | Tampering | Contract tests around event payload shape and deterministic evidence fields. [VERIFIED: backend/src/events/eventBus.js] [ASSUMED] |

## Sources

### Primary (HIGH confidence)
- Repository code scan - `backend/src/detection/*`, `backend/src/scoring/*`, `backend/src/models/Alert.js`, `backend/src/sar/*`, `backend/src/routes/alerts.js`
- Planning docs - `.planning/phases/07-.../07-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`
- npm registry checks (live) via `npm view`:
  - express 5.2.1 (2025-12-01)
  - mongoose 9.4.1 (2026-04-03)
  - socket.io 4.8.3 (2025-12-23)
  - ajv 8.18.0 (2026-02-14)
  - ajv-formats 3.0.1 (2024-03-30)
  - jsonwebtoken 9.0.3 (2025-12-04)
  - bcrypt 6.0.0 (2025-05-11)
  - @google/generative-ai 0.24.1 (2025-04-29)
  - @google/genai 1.49.0 (2026-04-08)
  - jest 30.3.0 (2026-03-10)
  - fast-check 4.6.0 (2026-03-08)

### Secondary (MEDIUM confidence)
- Express official site summary and release context: https://expressjs.com/
- OWASP ASVS project page (v5.0.0 references): https://owasp.org/www-project-application-security-verification-standard/
- Google Gemini migration guide: https://ai.google.dev/gemini-api/docs/migrate

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against current repo usage and npm registry versions.
- Architecture: HIGH - based on existing implementation modules and locked decisions in phase context.
- Pitfalls: MEDIUM - some items inferred from architecture and compliance best practices.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10
