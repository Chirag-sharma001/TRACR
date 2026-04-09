# Phase 2: Durable Transaction Processing - Research

**Researched:** 2026-04-10
**Domain:** Durable ingest-to-detection processing, idempotency, replay-safe recovery
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Enforce deterministic idempotency key per transaction using stable source identity + external transaction identity.
- D-02: Duplicate ingest/replay attempts must not produce duplicate downstream side effects (alerts/cases/events).
- D-03: Idempotency state must be durable (not memory-only).

### Replay and Recovery Model
- D-04: Failed processing items move to a recoverable dead-letter style state.
- D-05: Reprocessing is operator-triggered (explicit action), not infinite automatic retry.
- D-06: Replay supports bounded time-window operations for controlled catch-up.

### Operational Visibility
- D-07: Provide operator API to list failed processing items.
- D-08: Provide operator API to reprocess single failed item.
- D-09: Provide backlog/recovery health metrics endpoint for operational monitoring.

### the agent's Discretion
- Exact storage schema for failure/replay metadata, provided D-01 through D-09 are preserved.
- Exact endpoint naming and pagination/filter conventions, while preserving existing route patterns and snake_case API fields.

### Deferred Ideas (OUT OF SCOPE)
- Distributed exactly-once across multiple external services and cross-region orchestration.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DET-02 | Operations team can rely on ingest-to-detection durability so every accepted transaction is processed exactly-once semantically (idempotent replay-safe behavior) | Idempotency ledger + unique indexes, durable failed-item store, operator replay APIs, and replay-safe downstream dedupe strategy in this research |
</phase_requirements>

## Project Constraints (from copilot-instructions.md)

- Preserve hybrid evolution (extend current backend, no greenfield rewrite). [VERIFIED: copilot-instructions.md]
- Preserve near-real-time operational target (under 1 minute ingest-to-alert intent). [VERIFIED: copilot-instructions.md]
- Preserve precision-first v1 posture for tradeoffs. [VERIFIED: copilot-instructions.md]
- Preserve balanced persona support and existing route/API conventions (including snake_case response fields). [VERIFIED: copilot-instructions.md]
- Keep reliability work scoped to v1 pragmatics (no multi-region exactly-once orchestration). [VERIFIED: copilot-instructions.md]

## Summary

Current pipeline durability is partial: ingestion persists `Transaction` first, then emits `transaction:saved`, and downstream detection/alerting is driven by in-process `EventEmitter` listeners. If process crash or listener failure occurs between emit/consume boundaries, replay semantics and duplicate side-effect suppression are not yet guaranteed. [VERIFIED: backend/src/ingestion/TransactionRepository.js] [VERIFIED: backend/src/detection/DetectionOrchestrator.js] [VERIFIED: backend/src/server.js] [CITED: https://nodejs.org/api/events.html#emitteremiteventname-args]

The correct Phase 2 approach in this codebase is a durable idempotency ledger with explicit processing states (`RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`) plus a durable failed-item collection and operator-driven replay API. Use Mongo single-document atomic updates (`updateOne`/`findOneAndUpdate` with indexed filters) for claim/transition logic instead of in-memory locks. [CITED: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/]

Because `Transaction` uniqueness is only on `transaction_id` and alerts have no transaction-side-effect uniqueness contract today, duplicate side effects remain possible during replay/retry unless phase design adds downstream dedupe keys. [VERIFIED: backend/src/models/Transaction.js] [VERIFIED: backend/src/models/Alert.js] [ASSUMED]

**Primary recommendation:** Implement a Mongo-backed idempotency ledger + failed replay queue first, then route ingest/replay through the same state machine so detection side effects are emitted only after durable state transition checks. [VERIFIED: backend/src/ingestion/TransactionRepository.js] [CITED: https://www.mongodb.com/docs/manual/core/index-unique/]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP ingest and operator replay endpoints | Already used in service and aligns with existing route factory pattern. [VERIFIED: backend/package.json] [VERIFIED: registry.npmjs.org/express] |
| mongoose | 8.19.1 (repo), 9.4.1 (latest) | Durable idempotency/replay models and atomic updates | Existing ORM and index support for uniqueness + state transitions. [VERIFIED: backend/package.json] [VERIFIED: registry.npmjs.org/mongoose/latest] |
| Node EventEmitter (`events`) | Node core | In-process signaling after durable transitions | Existing pipeline primitive; listeners run synchronously by registration order. [VERIFIED: backend/src/events/eventBus.js] [CITED: https://nodejs.org/api/events.html#emitteremiteventname-args] |
| MongoDB unique indexes | Server feature | Enforce idempotency keys and replay dedupe keys | Canonical way to reject duplicate keys at write boundary. [CITED: https://www.mongodb.com/docs/manual/core/index-unique/] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest | 30.3.0 | Durability unit/integration tests and replay invariants | Existing test runner for phase regression and new DET-02 tests. [VERIFIED: backend/package.json] [VERIFIED: registry.npmjs.org/jest/latest] |
| fast-check | 4.6.0 | Property tests for idempotency/replay invariants | Useful for repeated ingest/replay sequences and exactly-once invariants. [VERIFIED: backend/package.json] [VERIFIED: registry.npmjs.org/fast-check/latest] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mongo-backed ledger/state machine | Redis/in-memory dedupe cache | Faster transient checks but violates durable idempotency requirement D-03 on restart/failover. [ASSUMED] |
| Local EventEmitter-only replay control | External queue broker | Better durability at scale, but out of scope for this phase and current architecture. [VERIFIED: .planning/phases/02-durable-transaction-processing/02-CONTEXT.md] |

**Installation:**
```bash
cd backend
npm install
```

**Version verification:**
- Verified current/latest versions via npm registry package metadata fetch. [VERIFIED: registry.npmjs.org/express/latest] [VERIFIED: registry.npmjs.org/mongoose/latest] [VERIFIED: registry.npmjs.org/jest/latest] [VERIFIED: registry.npmjs.org/fast-check/latest]
- Publish-date extraction is confirmed for `fast-check@4.6.0` (`2026-03-08T13:49:10.263Z`) via registry `time` map. [VERIFIED: registry.npmjs.org/fast-check]
- For other packages, exact per-version timestamps could not be fully extracted in-session from truncated registry responses; treat those date fields as low-confidence until re-queried with direct registry JSON tooling. [ASSUMED]

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── ingestion/
│   ├── TransactionRepository.js      # Switch save flow to ledger-aware state transitions
│   ├── ProcessingLedger.js           # Durable idempotency state machine operations
│   └── ReplayService.js              # Operator replay window + single-item replay
├── models/
│   ├── ProcessingLedger.js           # Unique idempotency key + status/indexes
│   └── ProcessingFailure.js          # Dead-letter style failed items
└── routes/
    └── transactions.js               # Existing ingest + new operator replay/list endpoints
```

### Pattern 1: Durable Idempotency Ledger State Machine
**What:** Persist an idempotency row before side effects, then atomically transition state with compare-and-set filters (`RECEIVED -> PROCESSING -> PROCESSED` or `FAILED`). [CITED: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/] [CITED: https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/]
**When to use:** Every ingest and replay attempt for DET-02.
**Example:**
```javascript
// Source: Mongo updateOne + unique index docs
await ledger.updateOne(
  { idempotency_key: key, status: { $in: ["RECEIVED", "FAILED"] } },
  { $set: { status: "PROCESSING", claimed_at: new Date().toISOString() } },
  { upsert: true }
);
```

### Pattern 2: Explicit Failed-Item + Operator Replay
**What:** On processing errors, persist failure metadata durably and expose controlled replay API (`single` and `time-window`). [VERIFIED: .planning/phases/02-durable-transaction-processing/02-CONTEXT.md]
**When to use:** Any downstream failure in detection/scoring/alert side-effect chain.
**Example:**
```javascript
// Source: phase context decisions D-04..D-08
POST /api/transactions/replay/:id
GET  /api/transactions/recovery/failed?status=FAILED&from=...&to=...
```

### Anti-Patterns to Avoid
- **In-memory dedupe sets:** Lost on restart; violates durable idempotency. [ASSUMED]
- **Emit-first then persist-state-later:** Can duplicate downstream effects after crash/replay windows. [VERIFIED: backend/src/ingestion/TransactionRepository.js]
- **Infinite auto-retry loops:** Contradicts D-05 operator-triggered replay model. [VERIFIED: .planning/phases/02-durable-transaction-processing/02-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exactly-once semantic guard | Custom JS mutex or process-local map | Mongo unique indexes + atomic state transitions | Survives restarts and concurrent workers. [CITED: https://www.mongodb.com/docs/manual/core/index-unique/] [CITED: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/] |
| Recovery queue durability | In-memory failure array | Durable failure collection with indexed status/time fields | Supports operator listing and bounded replay windows. [ASSUMED] |
| Event ordering guarantees across crash boundaries | EventEmitter-only assumptions | Durable ledger checkpoint before emit | `EventEmitter` is synchronous in-process, not crash-durable. [CITED: https://nodejs.org/api/events.html#emitteremiteventname-args] |

**Key insight:** Use Mongo as the source of truth for processing state; treat event bus as transport, not durability boundary. [VERIFIED: backend/src/events/eventBus.js] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Duplicate alerts on replay
**What goes wrong:** Replayed transaction re-runs detection and can create duplicate alert side effects.
**Why it happens:** No current downstream dedupe key tied to idempotency ledger state. [VERIFIED: backend/src/models/Alert.js] [ASSUMED]
**How to avoid:** Add deterministic side-effect key (for example `transaction_id + detector_signature`) and persist before emitting final success.
**Warning signs:** Same `transaction_id` appears in multiple newly created alerts during replay tests.

### Pitfall 2: Durable ingest but non-durable processing outcome
**What goes wrong:** Transaction insert succeeds but crash before processing completion leaves uncertain state.
**Why it happens:** Current flow emits event immediately after create; no separate durable processing ledger. [VERIFIED: backend/src/ingestion/TransactionRepository.js]
**How to avoid:** Introduce explicit processing status row and only mark `PROCESSED` after all required side effects complete.
**Warning signs:** Accepted transactions exist without terminal processing status in reporting.

### Pitfall 3: Over-broad replay blast radius
**What goes wrong:** Replay window causes duplicate pressure and operational spikes.
**Why it happens:** Missing bounded filters and explicit operator controls.
**How to avoid:** Require `from/to`, max-window limits, pagination, and dry-run count endpoint.
**Warning signs:** Large replay requests with no guardrails in audit logs.

## Code Examples

Verified patterns from official sources:

### Atomic Single-Document Transition
```javascript
// Source: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
await collection.updateOne(
  { _id: ledgerId, status: "PROCESSING" },
  { $set: { status: "PROCESSED", processed_at: new Date() } }
);
```

### Uniqueness Constraint for Idempotency Key
```javascript
// Source: https://www.mongodb.com/docs/manual/core/index-unique/
db.processing_ledger.createIndex({ idempotency_key: 1 }, { unique: true });
```

### EventEmitter Reliability Boundary Reminder
```javascript
// Source: https://nodejs.org/api/events.html#emitteremiteventname-args
// EventEmitter listeners run synchronously in-process; this is NOT a persistence guarantee.
emitter.emit("transaction:saved", payload);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Process-local retry/dedupe assumptions | Durable idempotency state in datastore | Established long-standing backend reliability practice [ASSUMED] | Enables replay-safe semantics across restarts |
| fire-and-forget event signaling | Event signaling after durable checkpoints | Widely adopted in event-driven Node services [ASSUMED] | Reduces duplicate side-effect risk |
| open-ended retry | operator-triggered bounded replay | Required by this phase decisions | Better operational control and auditability |

**Deprecated/outdated:**
- Treating in-process `EventEmitter` as durability primitive is not sufficient for failure recovery semantics. [CITED: https://nodejs.org/api/events.html#emitteremiteventname-args]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Current alert creation path lacks replay-safe dedupe key beyond `alert_id` | Summary/Common Pitfalls | Duplicate alerts could still occur under replay load |
| A2 | Mongo-backed failure collection is sufficient without external queue broker for v1 scale | Architecture Patterns | Throughput ceiling may appear earlier than expected |
| A3 | Process-local dedupe alternatives are insufficient for D-03 durability | Anti-Patterns | Could over-constrain design if hidden durable cache exists |
| A4 | Exact publish dates for some packages remain unresolved from truncated registry output | Standard Stack | Version recency reporting may be partially incomplete |

## Open Questions Resolution

1. **What should be the canonical idempotency key source fields in inbound payload?**
  - **Status:** RESOLVED.
  - **Decision:** Canonical key is composed from stable source identity and external transaction identity (`source_system` + `external_tx_id`) with explicit normalization before persistence.
  - **Evidence:** Context locks deterministic key strategy, and plans scope durability/idempotency implementation around this contract. [VERIFIED: .planning/phases/02-durable-transaction-processing/02-CONTEXT.md] [VERIFIED: .planning/phases/02-durable-transaction-processing/02-01-PLAN.md]

2. **Should replay endpoints be admin-only or operations-role scoped?**
  - **Status:** RESOLVED.
  - **Decision:** Replay/list/reprocess controls are operations-role scoped with existing JWT/RBAC enforcement; audit logging is mandatory for replay actions.
  - **Evidence:** Context mandates operator controls and planner maps these controls into dedicated replay endpoints with auditability requirements. [VERIFIED: .planning/phases/02-durable-transaction-processing/02-CONTEXT.md] [VERIFIED: .planning/phases/02-durable-transaction-processing/02-02-PLAN.md] [VERIFIED: .planning/phases/02-durable-transaction-processing/02-03-PLAN.md]

All prior open questions are now resolved for planning scope.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | backend runtime/tests | ✓ | v22.18.0 | — |
| npm | dependency/test execution | ✓ | 10.9.3 | — |
| git | workflow/versioning | ✓ | 2.50.1 | — |
| docker | optional local infra | ✓ | 29.2.1 | Use host services |
| mongod | realistic durability integration checks | ✗ | — | Mock model-level tests only |
| mongosh | mongodb ping/admin checks | ✗ | — | Use app-level health + mocked integration |
| mongodb_service | full replay/durability E2E | ✗ | — | Not available locally in-session |

**Missing dependencies with no fallback:**
- True end-to-end durability validation against running MongoDB instance is blocked in current shell environment.

**Missing dependencies with fallback:**
- Unit/integration tests can still validate state-machine logic with injected models and deterministic fixtures.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + fast-check 4.6.0 [VERIFIED: backend/package.json] |
| Config file | `backend/jest.config.js` |
| Quick run command | `cd backend && npm test -- --runInBand --testPathPattern=TransactionRepository|transactions|ingestionToAlert` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-02 | Duplicate ingest/replay attempts do not duplicate side effects | unit + integration + property | `cd backend && npm test -- --runInBand --testPathPattern=TransactionRepository|ingestionToAlert` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --runInBand --testPathPattern=TransactionRepository|transactions`
- **Per wave merge:** `cd backend && npm test -- --runInBand`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/src/ingestion/TransactionRepository.durability.test.js` - idempotency ledger state transitions and duplicate suppression
- [ ] `backend/src/routes/transactions.replay.test.js` - failed-item listing and single-item replay endpoint behavior
- [ ] `backend/src/integration/replayToAlert.integration.test.js` - replay-safe no-duplicate side effects across failure/retry windows
- [ ] Shared test fixtures for replay windows and deterministic idempotency keys

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT middleware for operator endpoints |
| V3 Session Management | no | Stateless JWT flow (no server session state in scope) |
| V4 Access Control | yes | RBAC middleware for replay/list controls |
| V5 Input Validation | yes | AJV request schema + bounded replay query validation |
| V6 Cryptography | no | No new cryptographic primitives required in phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay endpoint abuse (mass reprocessing) | Denial of Service | Bounded windows, pagination, max replay batch size, role checks |
| Unauthorized recovery actions | Elevation of Privilege | JWT + RBAC + immutable audit logging |
| Duplicate key bypass by malformed idempotency key | Tampering | Canonical key builder + unique index + strict schema validation |

## Sources

### Primary (HIGH confidence)
- Local codebase files for current behavior:
  - `backend/src/routes/transactions.js`
  - `backend/src/ingestion/TransactionRepository.js`
  - `backend/src/detection/DetectionOrchestrator.js`
  - `backend/src/events/eventBus.js`
  - `backend/src/models/Transaction.js`
  - `backend/src/models/Alert.js`
  - `backend/src/server.js`
- Phase and planning docs:
  - `.planning/phases/02-durable-transaction-processing/02-CONTEXT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/PROJECT.md`
  - `.planning/config.json`
- Official docs:
  - https://nodejs.org/api/events.html
  - https://www.mongodb.com/docs/manual/core/index-unique/
  - https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
  - https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
  - https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/

### Secondary (MEDIUM confidence)
- npm registry metadata pages:
  - https://registry.npmjs.org/express/latest
  - https://registry.npmjs.org/mongoose/latest
  - https://registry.npmjs.org/jest/latest
  - https://registry.npmjs.org/fast-check/latest

### Tertiary (LOW confidence)
- Partial registry `time` extraction from large package metadata responses where per-version timestamp parsing was truncated in-session for some packages.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - versions are verified; some per-version publish timestamps remain partially unresolved.
- Architecture: HIGH - grounded in current code paths and official Node/Mongo docs.
- Pitfalls: MEDIUM - code-grounded but replay side-effect behavior needs dedicated new tests.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10
