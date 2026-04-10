# Architecture Research

**Domain:** Intelligent AML detection platform (Node/Mongo brownfield evolution)
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Control Plane (Sync APIs)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Ingestion API  Alerts API  Cases API  Admin API  Auth API  Realtime API  │
│       │            │          │          │         │          │            │
├───────┴────────────┴──────────┴──────────┴─────────┴──────────┴────────────┤
│                    Eventing and Decisioning Plane                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Outbox Writer -> Durable Queue/Stream -> Detection Worker Pool            │
│          │                              │        │        │                │
│          └-> Audit Trail                ├-> Graph/Cycle    ├-> Smurfing    │
│                                         └-> Behavioral     └-> Risk Scorer  │
│                                                   │                          │
│                                    Explainability Assembler                  │
│                                                   │                          │
│                                  Alert Decision + Persistence                │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Data and Platform Plane                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ MongoDB (OLTP + outbox + read models) | Redis (queue/cache/pubsub)         │
│ Object storage (optional SAR artifacts) | OTel collector + metrics backend  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Control Plane API | Validate commands and expose query endpoints | Existing Express routes, keep request path thin |
| Ingestion Boundary | Canonicalize transaction events and assign idempotency key | Existing validator/normalizer + deterministic event key |
| Outbox/Event Relay | Persist domain event atomically with transaction write | Mongo outbox collection + relay worker (or change stream consumer) |
| Detection Worker Pool | Run cycle/smurfing/behavioral detection without blocking API | Separate Node worker process(es), same codebase initially |
| State Services | Maintain graph/window/profile state with restart-safe semantics | Mongo-backed state snapshots + Redis hot cache |
| Risk and Explainability | Produce score, reasons, and evidence graph/path | Risk scorer + explainability contract object |
| Alert/Case Read Models | Fast analyst and manager queries | Mongo indexed collections/materialized summaries |
| SAR Worker | Execute slow LLM workflows with retries and DLQ | BullMQ worker + persisted drafts/status |
| Realtime Fanout | Push updates to multi-node websocket cluster | Socket.IO + Redis adapter |
| Ops and Reliability | Telemetry, retries, circuit breakers, backpressure controls | OpenTelemetry traces/metrics + queue-level retry policies |

## Recommended Project Structure

```
backend/src/
├── control-plane/                 # synchronous APIs, auth, request validation
│   ├── routes/                    # transaction, alert, case, admin, auth routes
│   ├── middleware/                # JWT, RBAC, request guards
│   └── presenters/                # response shaping for analyst/investigator views
├── domain/                        # pure domain logic (no transport concerns)
│   ├── detection/                 # cycle, smurfing, behavioral analyzers
│   ├── scoring/                   # risk scoring and threshold policies
│   ├── explainability/            # reason codes, evidence graph/path extraction
│   └── contracts/                 # typed event names and payload schemas
├── workers/                       # async processing runtime
│   ├── detection-worker/          # consumes transaction events, emits alert decisions
│   ├── sar-worker/                # LLM-backed SAR generation pipeline
│   └── relay-worker/              # outbox to queue/stream relay
├── platform/                      # infrastructure adapters
│   ├── persistence/               # mongoose models, repositories, indexes
│   ├── messaging/                 # queue clients, producer/consumer wrappers
│   ├── realtime/                  # socket gateway and redis adapter wiring
│   ├── observability/             # tracing, metrics, log correlation
│   └── resilience/                # retry, circuit breaker, dead-letter handlers
└── app/                           # bootstrap and process composition
    ├── api-server.js              # control plane startup
    ├── detection-worker.js        # detection worker startup
    └── sar-worker.js              # SAR worker startup
```

### Structure Rationale

- **control-plane/**: isolates latency-sensitive synchronous behavior from heavy analytics work.
- **domain/**: enables running identical detector logic in-process today and out-of-process tomorrow.
- **workers/**: defines explicit decomposition unit without forcing full microservices immediately.
- **platform/**: keeps infra details out of domain code and limits coupling to specific queue/storage products.
- **app/**: supports independent scaling and failure domains per process role.

## Architectural Patterns

### Pattern 1: Transactional Outbox + Async Detection

**What:** Write transaction and outbox event in one DB transaction, then relay outbox to worker queue.
**When to use:** Any alerting path where missed events are unacceptable.
**Trade-offs:** Strong durability and replayability, but added relay component and operational complexity.

**Example:**
```javascript
// Persist once, process asynchronously with at-least-once delivery.
await session.withTransaction(async () => {
  await Transaction.create([normalizedTx], { session });
  await OutboxEvent.create([toTransactionSavedEvent(normalizedTx)], { session });
});
```

### Pattern 2: Workerized Detection with Idempotent Handlers

**What:** Move cycle/smurfing/behavioral computation to workers consuming durable events.
**When to use:** API latency increases or CPU hotspots appear in monolith process.
**Trade-offs:** Better isolation/backpressure; introduces queue semantics and duplicate-delivery handling.

**Example:**
```javascript
queue.process("transaction.saved", async (job) => {
  const { eventId, transaction } = job.data;
  if (await alreadyProcessed(eventId)) return;
  const findings = await runDetectors(transaction);
  await persistFindings(eventId, findings);
});
```

### Pattern 3: Explainability Envelope as First-Class Contract

**What:** Emit a stable explanation object with every detection decision.
**When to use:** Analyst trust and SAR-readiness are product-critical.
**Trade-offs:** Slightly larger payloads and stricter schema discipline, but major gains in auditability and UX.

**Example:**
```javascript
const decision = {
  alertId,
  score,
  tier,
  reasons: ["SMURFING_PATTERN", "NEW_HIGH_RISK_GEO"],
  evidence: {
    path: ["acct:A", "acct:B", "acct:C"],
    contributingTransactions: txIds,
    featureContributions
  }
};
```

### Pattern 4: Strangler Migration (Monolith to Worker Decomposition)

**What:** Keep existing APIs and progressively redirect heavy workloads to workers.
**When to use:** Brownfield systems where full rewrite risk is too high.
**Trade-offs:** Temporary dual paths and bridge code, but minimized delivery risk and easier rollback.

## Monolith vs Worker Decomposition Trade-offs

| Dimension | Keep Monolith (Now) | Decompose to Workers (Target) | Recommendation |
|-----------|----------------------|--------------------------------|----------------|
| p95 ingest latency | Degrades as detection load grows | Stable, because API path only enqueues | Start workerization before sustained load testing |
| Failure isolation | Detector crash can impact API/realtime | Worker failures are isolated and restartable | Split detection and SAR first |
| Operational complexity | Lower | Higher (queue ops, retries, DLQ) | Accept complexity once throughput or SLA pressure appears |
| Consistency semantics | Simpler in-process ordering | At-least-once delivery requires idempotency | Add idempotency keys before decomposition |
| Dev velocity | Fast for small team | Better for parallel teams after boundaries settle | Use modular monolith now, process split next |

## Data Flow

### Request Flow (Low-Latency Alerting)

```
Client -> Ingestion API -> Validation/Normalization -> Transaction+Outbox write
       -> 202 Accepted (with traceId/eventId)

Relay Worker -> Queue/Stream -> Detection Worker -> Risk/Explainability
             -> Alert write -> alert.created event -> Realtime Fanout + Case/SAR views
```

### State Management

```
MongoDB (source of truth)
  -> Outbox events
    -> Worker computation
      -> Alert + Explanation read model
        -> API queries / websocket notifications

Redis (ephemeral acceleration)
  -> queue state, dedupe caches, realtime pubsub
```

### Key Data Flows

1. **Ingestion to alert decision:** command path is sync only until durable write, then async detection and decisioning.
2. **Alert to investigator workflow:** alert projections feed case handling and SAR generation through independent workers.
3. **Ops control loop:** telemetry and DLQ metrics drive autoscaling and runbook-triggered replay.

## Build Order Implications

1. **Phase A - Contracts and Observability First**
   - Deliverables: canonical event schemas, event versioning, trace/correlation IDs, latency SLO dashboards.
   - Why first: decomposition without contracts and telemetry creates hidden breakage.

2. **Phase B - Durable Event Backbone (Outbox + Relay)**
   - Deliverables: outbox table/collection, relay worker, replay CLI, dedupe store.
   - Dependency: Phase A schemas and IDs.
   - Success metric: no event loss across process restarts.

3. **Phase C - Detection Worker Extraction**
   - Deliverables: separate detection worker process, idempotent consumers, retry and DLQ policy.
   - Dependency: Phase B queue/backbone.
   - Success metric: API p95 stabilized under detector load.

4. **Phase D - Explainability Read Model Hardening**
   - Deliverables: explanation envelope schema, evidence-path index strategy, analyst query optimizations.
   - Dependency: Phase C decision outputs.
   - Success metric: deterministic reason/evidence availability for all alerts.

5. **Phase E - Realtime and Multi-Node Resilience**
   - Deliverables: socket cluster with Redis adapter, sticky sessions, degraded-mode behavior.
   - Dependency: stable alert.created events from Phase C.
   - Success metric: multi-instance websocket correctness during node failure.

6. **Phase F - Slow-Path Isolation (SAR and Enrichment)**
   - Deliverables: separate SAR worker concurrency controls, timeout/circuit breaker, cost guardrails.
   - Dependency: queue and contract maturity from earlier phases.
   - Success metric: SAR latency no longer affects detection SLA.

## Migration Path from Current Architecture

| Current State | Next Step | End State |
|---------------|-----------|-----------|
| EventEmitter-only in-process events | Introduce outbox writes alongside current EventEmitter publish | Queue/stream as primary transport, EventEmitter only for local hooks |
| Detection in API process | Start a dedicated detection worker using same detector modules | Horizontally scalable worker pool with isolated failure domain |
| In-memory graph/windows only | Persist snapshots/checkpoints and rehydrate workers on boot | Restart-safe, multi-worker compatible state strategy |
| Process-local SAR queue | Move SAR to durable queue with retry and DLQ | Independent SAR scaling and resilient long-running jobs |
| Single-node Socket.IO gateway | Add Redis adapter and sticky-session deployment | Multi-node realtime fanout with graceful degradation |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k monitored entities | Modular monolith + outbox + one worker per async role is sufficient |
| 1k-100k monitored entities | Increase worker pool, partition queue by tenant/risk domain, add read-model indexes and caching |
| 100k+ monitored entities | Partition graph/profile state explicitly, split control-plane and decisioning deploy units, consider dedicated stream platform |

### Scaling Priorities

1. **First bottleneck:** shared CPU in single API process. Fix by moving detection/SAR off request path.
2. **Second bottleneck:** in-memory detector state and replay limits. Fix with checkpointed state and partitioned workers.

## Anti-Patterns

### Anti-Pattern 1: Synchronous Detection in HTTP Request Path

**What people do:** Run all detectors before returning API response.
**Why it's wrong:** p95/p99 latency spikes and cascading failures during traffic bursts.
**Do this instead:** Return after durable write and process detection asynchronously with strict latency SLO on end-to-end pipeline.

### Anti-Pattern 2: Implicit Event Contracts

**What people do:** Pass ad hoc JS objects across modules with no versioning.
**Why it's wrong:** Silent breakages and hard-to-debug production regressions.
**Do this instead:** Centralize event schemas/versioning in domain contracts and add contract tests.

### Anti-Pattern 3: Single-Process State Assumptions

**What people do:** Depend on mutable in-memory graph/windows as the only truth.
**Why it's wrong:** Restarts and multi-instance deployments produce inconsistent detection behavior.
**Do this instead:** Persist checkpoints and design deterministic rehydration strategy.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MongoDB | OLTP + outbox + read models; optional change streams for relay | Change streams require replica set/sharded cluster and careful resume-token handling |
| Redis | Queue backend + pubsub for websocket fanout + short-lived cache | Needed for BullMQ and Socket.IO horizontal scaling |
| Gemini (or equivalent LLM) | Async worker call with timeout/circuit breaker | Keep off critical detection path |
| OpenTelemetry Collector | OTLP export from API/workers | Required for cross-process traces and queue-lag visibility |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| control-plane -> domain | Direct function calls | Keep domain pure and transport-agnostic |
| control-plane -> messaging | Outbox write + relay | No direct worker imports in routes |
| workers -> domain | Shared domain package/modules | Same detection logic across processes |
| workers -> persistence | Repository interfaces | Allows controlled evolution of state storage |
| decisioning -> realtime | `alert.created` event only | Avoid direct socket calls from detection code |

## Sources

- Internal project context: `.planning/PROJECT.md` (2026-04-09)
- Internal codebase architecture analysis: `.planning/codebase/ARCHITECTURE.md` (2026-04-09)
- Internal concern audit: `.planning/codebase/CONCERNS.md` (2026-04-09)
- MongoDB docs, Change Streams (accessed 2026-04-10): https://www.mongodb.com/docs/manual/changeStreams/
- BullMQ docs, queue semantics and worker patterns (accessed 2026-04-10): https://docs.bullmq.io/
- Socket.IO Redis adapter docs, multi-node behavior and caveats (accessed 2026-04-10): https://socket.io/docs/v4/redis-adapter/
- OpenTelemetry JavaScript docs, runtime support and instrumentation guidance (accessed 2026-04-10): https://opentelemetry.io/docs/languages/js/

---
*Architecture research for: Intelligent AML detection platform evolution*
*Researched: 2026-04-10*
