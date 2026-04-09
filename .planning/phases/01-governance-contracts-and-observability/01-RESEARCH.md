# Phase 1: Governance, Contracts, and Observability - Research

**Researched:** 2026-04-10
**Domain:** AML governance workflow contracts, auditability, and detector quality telemetry
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- What-if threshold simulation tooling (future phase, likely advanced governance/intelligence track).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DET-03 | Compliance manager can review precision/drift calibration signals for detection quality governance | Segmented aggregation contract by detector/risk tier, daily+weekly windows via Mongo aggregation, and lineage-aware telemetry shape [VERIFIED: codebase grep][CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/] |
| GOV-03 | Admin users can submit threshold/config changes through an approval and rollback-auditable workflow | Two-person approval state machine, no self-approval, immutable audit events, rollback link-to-origin semantics [VERIFIED: codebase grep][CITED: https://expressjs.com/en/guide/using-middleware.html] |
</phase_requirements>

## Project Constraints (from copilot-instructions.md)

- Keep hybrid evolution architecture: extend existing backend modules rather than rewrite them [VERIFIED: codebase grep].
- Preserve precision-first behavior and near-real-time operating assumptions while adding governance controls [VERIFIED: codebase grep].
- Preserve snake_case API/persistence field conventions in new contracts [VERIFIED: codebase grep].
- Preserve dependency-injection and route-factory patterns (`createXRoutes`) for testability [VERIFIED: codebase grep].
- Preserve CommonJS module style and existing per-file formatting conventions [VERIFIED: codebase grep].
- Use backend-first delivery for this phase; UI work remains non-blocking [VERIFIED: codebase grep].

## Summary

Current admin governance is direct-write: `PUT /api/admin/config` updates active config immediately, then reloads in-memory thresholds. There is no draft state, no explicit approver identity, and no rollback linkage model today [VERIFIED: codebase grep].

Current observability telemetry exists but is insufficient for DET-03 governance intent. `SocketGateway` emits coarse `alertCounts` by risk tier plus 24-hour hourly trend, but does not segment by detector (`cycle/smurfing/behavioral`), does not expose weekly window, and does not attach config version lineage [VERIFIED: codebase grep].

Phase 1 should add a dedicated config change request lifecycle with two-person control and immutable event journaling, then add governance metrics endpoints/streams that group by detector and risk context with daily and weekly windows. This can be implemented with existing Express, Mongoose, and Mongo aggregation patterns; no framework migration is required [VERIFIED: npm registry][CITED: https://expressjs.com/en/guide/routing.html][CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/].

**Primary recommendation:** Implement a new approval-gated config workflow model plus lineage-aware telemetry aggregations in backend routes/services, reusing current stack and test harnesses instead of introducing new infrastructure [VERIFIED: codebase grep].

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP route/middleware contracts for governance endpoints | Existing API foundation; router-level middleware and mounted mini-app pattern are first-class [VERIFIED: npm registry][CITED: https://expressjs.com/en/guide/using-middleware.html] |
| mongoose | 8.19.1 (repo pin), 9.4.1 latest | Model persistence for config requests, approval events, and lineage snapshots | Existing model layer across all backend entities; lowest-risk path is phase-local extension without major bump [VERIFIED: codebase grep][VERIFIED: npm registry] |
| mongodb aggregation | Server feature (MongoDB 5+) | Daily/weekly telemetry buckets with detector/risk segmentation | `$dateTrunc` directly supports week/day bins and timezone control [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.18.0 | Validate structured config-change payload metadata | Use for schema validation of request payloads and rollback metadata [VERIFIED: npm registry][CITED: https://ajv.js.org/guide/getting-started.html] |
| socket.io | 4.8.3 | Realtime metric push for dashboards | Use as optional transport for governance telemetry once API contract is stable [VERIFIED: npm registry][VERIFIED: codebase grep] |
| jest | 30.3.0 | Unit/integration test execution | Keep for route, service, and contract tests [VERIFIED: npm registry][CITED: https://jestjs.io/docs/getting-started] |
| fast-check | 4.6.0 | Property tests for invariant-heavy governance logic | Use for state machine and anti-self-approval invariants [VERIFIED: npm registry][VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend current `SystemConfig` + new governance model | Full policy engine/workflow platform | Overkill for Phase 1 scope; increases integration and ops burden [ASSUMED] |
| Mongo aggregation in current DB | External metrics store (Prometheus/ClickHouse) | Better long-term analytics but adds infrastructure before contract is settled [ASSUMED] |
| Existing Jest + fast-check | New test framework | No value for this phase; existing suite already includes route/property coverage [VERIFIED: codebase grep] |

**Installation:**
```bash
cd backend
npm install
```

**Version verification (npm registry):**
- express 5.2.1 published 2025-12-01T20:49:43.268Z [VERIFIED: npm registry]
- mongoose 9.4.1 published 2026-04-03T19:03:41.421Z (repo currently pins 8.19.1) [VERIFIED: npm registry][VERIFIED: codebase grep]
- socket.io 4.8.3 published 2025-12-23T16:42:13.022Z [VERIFIED: npm registry]
- ajv 8.18.0 published 2026-02-14T15:41:17.656Z [VERIFIED: npm registry]
- jest 30.3.0 published 2026-03-10T02:00:06.592Z [VERIFIED: npm registry]
- fast-check 4.6.0 published 2026-03-08T13:49:09.976Z [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure
```
src/
├── governance/                  # Config change request model + approval/rollback service
│   ├── ConfigChangeRequest.js
│   ├── ConfigGovernanceService.js
│   └── ConfigGovernance.property.test.js
├── observability/               # Detection quality telemetry aggregations
│   ├── DetectionQualityMetrics.js
│   └── DetectionQualityMetrics.test.js
└── routes/
    └── admin.js                 # Extend with submit/approve/activate/rollback + telemetry endpoints
```

### Pattern 1: Approval-Gated Config Lifecycle
**What:** Add explicit states: `DRAFT -> APPROVED -> ACTIVE`, with actor separation checks and immutable state transitions [VERIFIED: codebase grep].
**When to use:** Any write path that changes detector/scoring behavior in production [VERIFIED: codebase grep].
**Example:**
```javascript
// Source: existing route factory + Express middleware pattern
// https://expressjs.com/en/guide/using-middleware.html
router.post("/config/changes", jwtMiddleware, adminOnly, async (req, res) => {
  // validate reason/scope/detector/risk_segment payload via AJV before persistence
  // create DRAFT request with requester metadata
});

router.post("/config/changes/:id/approve", jwtMiddleware, adminOnly, async (req, res) => {
  // deny if approver === requester (two-person control)
  // set status=APPROVED with approver metadata
});

router.post("/config/changes/:id/activate", jwtMiddleware, adminOnly, async (req, res) => {
  // enforce APPROVED precondition before applying to SystemConfig
  // append immutable audit log entries and reload threshold cache
});
```

### Pattern 2: Immutable Governance Event Journal
**What:** Use append-only audit records for submit/approve/activate/rollback events; never mutate prior audit entries [VERIFIED: codebase grep].
**When to use:** All GOV-03 actions including rollback [VERIFIED: codebase grep].
**Example:**
```javascript
await auditLogger.log({
  userId: actorId,
  userRole: actorRole,
  actionType: "CONFIG_ROLLBACK",
  resourceType: "CONFIG_CHANGE",
  resourceId: rollbackRequestId,
  outcome: "SUCCESS",
  metadata: {
    rollback_reason,
    reverted_change_id,
    restored_version,
  },
});
```

### Pattern 3: Telemetry Segmentation with Time Buckets
**What:** Aggregate detector/risk segmented quality data into daily and weekly buckets; include config lineage id in each point [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/].
**When to use:** DET-03 views and governance reports [VERIFIED: codebase grep].
**Example:**
```javascript
// Source: MongoDB aggregation date bucketing
// https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/
{
  $group: {
    _id: {
      window_day: {
        $dateTrunc: { date: "$created_at", unit: "day", timezone: "UTC" }
      },
      detector_type: "$pattern_type",
      risk_tier: "$risk_tier",
      config_version: "$config_version"
    },
    alert_count: { $sum: 1 }
  }
}
```

### Anti-Patterns to Avoid
- **Direct active-config mutation endpoint only:** Current `PUT /api/admin/config` bypasses approval gate and violates D-01/D-04 [VERIFIED: codebase grep].
- **Rollback as manual edit:** Editing values without provenance link breaks D-09/D-10 traceability [VERIFIED: codebase grep].
- **Single-window metrics only:** 24-hour-only trend cannot satisfy D-08 weekly governance view [VERIFIED: codebase grep].
- **Telemetry without config lineage:** Cannot compare quality before/after threshold publication [VERIFIED: codebase grep].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON contract validation | Custom per-field if/else validator | AJV schema compilation and cached validators | Better consistency and error reporting; already in stack [VERIFIED: npm registry][CITED: https://ajv.js.org/guide/getting-started.html] |
| Time bucketing for trend windows | Manual JS date math per request | MongoDB `$dateTrunc` in aggregation pipeline | Correct UTC/week/day boundary handling in DB engine [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/] |
| Access control checks | Inline role checks in every route | Existing JWT + RBAC middleware chain | Centralized enforcement reduces bypass risk [VERIFIED: codebase grep][CITED: https://expressjs.com/en/guide/using-middleware.html] |
| Audit persistence semantics | In-memory history arrays | Existing `AuditLog` model + append-only events | Durable queryable audit trail already modeled [VERIFIED: codebase grep] |

**Key insight:** Phase 1 complexity is mostly contract/state semantics, not technology gaps; reuse current primitives and add explicit lifecycle boundaries [VERIFIED: codebase grep].

## Common Pitfalls

### Pitfall 1: Self-Approval Leakage
**What goes wrong:** Requester can approve their own change through alternate endpoint path [ASSUMED].
**Why it happens:** Actor identity checks are implemented only at one route layer or only in UI [ASSUMED].
**How to avoid:** Enforce requester/approver inequality in service layer and route tests [ASSUMED].
**Warning signs:** Approval records where `requester_id == approver_id` [ASSUMED].

### Pitfall 2: Non-Atomic Activation + Audit
**What goes wrong:** Config becomes active but audit write fails (or inverse), creating irreconcilable governance history [ASSUMED].
**Why it happens:** State updates and audit append executed in separate non-guarded operations [ASSUMED].
**How to avoid:** Apply update + event append in one transactional unit where supported, or implement compensating error handling and failure outcomes [ASSUMED].
**Warning signs:** Active config without corresponding `CONFIG_ACTIVATE` event [ASSUMED].

### Pitfall 3: Drift Metrics Without Ground Truth Labeling
**What goes wrong:** Reported "precision/drift" is only volume trend, not quality signal [ASSUMED].
**Why it happens:** No disposition/outcome labels joined into telemetry query [ASSUMED].
**How to avoid:** Define explicit quality signal source (case outcomes, SAR decisions, investigator dispositions) before metric naming [ASSUMED].
**Warning signs:** DET-03 dashboards show only counts and no quality denominator [ASSUMED].

### Pitfall 4: Weekly Window Ambiguity
**What goes wrong:** Different callers get inconsistent weekly aggregation boundaries [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/].
**Why it happens:** Missing explicit `startOfWeek` and timezone in bucketing [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/].
**How to avoid:** Fix timezone and `startOfWeek` in aggregation contract [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/].
**Warning signs:** Weekly totals differ between endpoints and reports for same date range [ASSUMED].

## Code Examples

Verified patterns from official sources and codebase:

### Router-level middleware composition
```javascript
// Source: https://expressjs.com/en/guide/using-middleware.html
const router = express.Router();
router.use(jwtMiddleware, adminOnly);

router.post("/config/changes", submitChangeHandler);
router.post("/config/changes/:id/approve", approveChangeHandler);
router.post("/config/changes/:id/rollback", rollbackHandler);
```

### Daily and weekly telemetry bucketing
```javascript
// Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/
{
  $project: {
    day_bucket: { $dateTrunc: { date: "$created_at", unit: "day", timezone: "UTC" } },
    week_bucket: {
      $dateTrunc: {
        date: "$created_at",
        unit: "week",
        timezone: "UTC",
        startOfWeek: "monday"
      }
    },
    pattern_type: 1,
    risk_tier: 1,
    config_version: 1
  }
}
```

### Append-only audit logging
```javascript
// Source: backend/src/audit/AuditLogger.js
await auditLogger.log({
  userId: req.user.user_id,
  userRole: req.user.role,
  actionType: "CONFIG_APPROVE",
  resourceType: "CONFIG_CHANGE",
  resourceId: req.params.id,
  outcome: "SUCCESS",
  metadata: { approver_note: req.body.note },
  ipAddress: req.ip,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct config writes to active values (`PUT /api/admin/config`) | Approval-gated lifecycle with separate draft/approval/activation records | Planned for Phase 1 | Meets GOV-03 two-person control and auditability [VERIFIED: codebase grep] |
| Coarse realtime metrics (`alertCounts` + 24h trend) | Detector/risk/context segmented telemetry with daily+weekly windows and lineage | Planned for Phase 1 | Meets DET-03 governance observability contract [VERIFIED: codebase grep] |
| Audit events for threshold change only | Expanded governance action taxonomy (submit/approve/activate/rollback) | Planned for Phase 1 | Restores end-to-end governance traceability [VERIFIED: codebase grep] |

**Deprecated/outdated:**
- Single-step `PUT /config` as sole policy change entrypoint: insufficient for D-01 through D-11 [VERIFIED: codebase grep].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing collections can support config-approval transactionality without introducing Mongo sessions immediately | Common Pitfalls / Architecture | Medium: may require explicit transaction/session work if consistency needs are strict |
| A2 | Precision/drift governance can be computed from currently persisted alert+case data with small schema additions | Common Pitfalls | High: DET-03 may need additional labeled outcome fields |
| A3 | New governance workflow can be added in `admin.js` without splitting into separate bounded context module in this phase | Architecture Patterns | Low: refactor may be needed if route complexity grows quickly |
| A4 | No additional compliance retention policy applies to audit storage duration in v1 | Open Questions | High: could alter schema/index/storage requirements |

## Open Questions Resolution

1. **What is the canonical quality label source for DET-03 precision/drift?**
  - **Status:** RESOLVED.
  - **Decision:** Phase 1 telemetry contract is governance-focused and must expose segmented quality/drift signals with lineage and windows; exact long-term label-calibration strategy is deferred to later detection-quality phases.
  - **Evidence:** DET-03 is scoped in Phase 1 plans as contract delivery (segmentation + lineage + daily/weekly windows), not model-calibration redesign. [VERIFIED: .planning/phases/01-governance-contracts-and-observability/01-03-PLAN.md] [VERIFIED: .planning/ROADMAP.md]

2. **How should config version lineage be represented?**
  - **Status:** RESOLVED.
  - **Decision:** Use global snapshot lineage identifiers (`config_version_id`, `published_change_id`) so governance comparisons stay consistent across detectors and risk segments.
  - **Evidence:** Lineage fields are explicitly planned in lifecycle contracts and telemetry tasks. [VERIFIED: .planning/phases/01-governance-contracts-and-observability/01-01-PLAN.md] [VERIFIED: .planning/phases/01-governance-contracts-and-observability/01-03-PLAN.md]

3. **What rollback granularity is required?**
  - **Status:** RESOLVED.
  - **Decision:** Full approved snapshot rollback with mandatory provenance (`rollback_reason`, `original_change_id`) and immutable audit event chain.
  - **Evidence:** Governance API and rollback tasks explicitly require snapshot restoration plus provenance-linked audit records. [VERIFIED: .planning/phases/01-governance-contracts-and-observability/01-02-PLAN.md]

All prior open questions are now resolved for planning scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | Backend API and tests | Yes | v22.18.0 | - |
| npm | Package/test execution | Yes | 10.9.3 | - |
| git | Change management and review | Yes | 2.50.1 | - |
| docker | Optional local Mongo bring-up for integration checks | Yes | 29.2.1 | Use `docker run mongo` for local DB |
| mongod | Local Mongo daemon for manual/integration verification | No | - | Use Docker-hosted Mongo |
| mongosh | Manual DB verification and index checks | No | - | Use app-level tests or Docker + container shell |
| mongodb_service | Runtime DB reachable from local shell | No | mongosh_missing | Start local/docker Mongo before integration tests |

**Missing dependencies with no fallback:**
- None for planning/research.

**Missing dependencies with fallback:**
- `mongod`, `mongosh`, and local Mongo service can be substituted by Docker-hosted Mongo for implementation verification.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + fast-check 4.6.0 [VERIFIED: npm registry] |
| Config file | `backend/jest.config.js` [VERIFIED: codebase grep] |
| Quick run command | `cd backend && npm test -- --runInBand src/routes/AdminRoutes.property.test.js src/realtime/SocketGateway.test.js` (verified pass) [VERIFIED: codebase grep] |
| Full suite command | `cd backend && npm test` [VERIFIED: codebase grep] |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOV-03 | Submit -> approve -> activate with requester != approver and auditable rollback | integration + property | `cd backend && npm test -- --runInBand src/routes/AdminGovernance.lifecycle.test.js src/routes/AdminGovernance.property.test.js` | No - Wave 0 |
| DET-03 | Daily/weekly segmented detector+risk telemetry with config lineage | integration + contract | `cd backend && npm test -- --runInBand src/observability/DetectionQualityMetrics.test.js src/routes/AdminTelemetry.contract.test.js` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --runInBand src/routes/AdminGovernance.property.test.js src/observability/DetectionQualityMetrics.test.js`
- **Per wave merge:** `cd backend && npm test -- --runInBand src/routes/AdminGovernance.lifecycle.test.js src/routes/AdminTelemetry.contract.test.js`
- **Phase gate:** `cd backend && npm test`

### Wave 0 Gaps
- [ ] `backend/src/routes/AdminGovernance.lifecycle.test.js` - end-to-end approval/activation/rollback path for GOV-03
- [ ] `backend/src/routes/AdminGovernance.property.test.js` - invariants: no self-approval, no activate-before-approve
- [ ] `backend/src/observability/DetectionQualityMetrics.test.js` - segmentation + daily/weekly bucketing assertions for DET-03
- [ ] `backend/src/routes/AdminTelemetry.contract.test.js` - API contract assertions for governance telemetry payload

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT auth middleware on admin routes [VERIFIED: codebase grep] |
| V3 Session Management | no (stateless JWT flow) | Token expiry/validation in JWT layer [VERIFIED: codebase grep] |
| V4 Access Control | yes | Existing role gate (`requireRole("ADMIN")`) plus two-person control checks [VERIFIED: codebase grep] |
| V5 Input Validation | yes | AJV schema validation for governance payload contracts [VERIFIED: npm registry][CITED: https://ajv.js.org/guide/getting-started.html] |
| V6 Cryptography | no direct new crypto in phase scope | Reuse existing secure token/password primitives; do not add custom crypto [VERIFIED: codebase grep] |

### Known Threat Patterns for Node/Express + Mongo governance endpoints

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized config activation | Elevation of Privilege | JWT + RBAC middleware and service-level actor checks [VERIFIED: codebase grep][CITED: https://expressjs.com/en/guide/using-middleware.html] |
| Self-approval bypass | Elevation of Privilege | Enforce requester != approver in write path and tests [ASSUMED] |
| Audit tampering by update/delete operations | Repudiation | Append-only audit events; restrict mutation routes for audit logs [VERIFIED: codebase grep] |
| Malformed rollback metadata | Tampering | AJV schema constraints for required reason and linked change ID [VERIFIED: npm registry][CITED: https://ajv.js.org/guide/getting-started.html] |
| Time-window manipulation due timezone drift | Tampering | Explicit UTC and `startOfWeek` in `$dateTrunc` [CITED: https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/] |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`) - current package versions, publish dates, and descriptions for express/mongoose/socket.io/ajv/jest/fast-check
- https://expressjs.com/en/guide/routing.html - router and mounted route patterns
- https://expressjs.com/en/guide/using-middleware.html - router-level middleware and control flow
- https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/ - daily/weekly date bucketing semantics
- https://www.mongodb.com/docs/manual/core/index-unique/ - unique index behavior and constraints
- Workspace code inspection: `backend/src/routes/admin.js`, `backend/src/audit/AuditLogger.js`, `backend/src/models/SystemConfig.js`, `backend/src/scoring/ThresholdConfig.js`, `backend/src/realtime/SocketGateway.js`, `backend/src/models/AuditLog.js`, `backend/src/models/Alert.js`

### Secondary (MEDIUM confidence)
- https://jestjs.io/docs/getting-started - command and setup references for Jest workflow
- https://ajv.js.org/guide/getting-started.html - validator lifecycle and performance guidance
- https://owasp-aasvs.readthedocs.io/en/latest/ - ASVS category mapping reference

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - confirmed by repository usage plus npm registry verification.
- Architecture: MEDIUM - current gaps are verified, but final workflow shape depends on unresolved lineage and labeling decisions.
- Pitfalls: MEDIUM - based on known governance failure modes; some mitigations are assumption-tagged pending stakeholder confirmation.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10
