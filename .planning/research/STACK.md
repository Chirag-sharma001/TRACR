# Stack Research

**Domain:** Production-grade intelligent AML backend modernization (Node/Mongo baseline)
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Must-Have Upgrades (for the next milestone)

| Technology | Version Guidance | Purpose | Why Recommended for AML | Confidence |
|------------|------------------|---------|--------------------------|------------|
| Node.js runtime | 24.x Active LTS (fallback: 22.x Maintenance LTS) | Stable production runtime for API, ingestion, scoring, and workflow workers | Node 24 is current Active LTS and 22 is still supported; avoid EOL risk while preserving your current Node ecosystem | HIGH |
| API/service framework | Keep Express 5.2.x now; migrate selected hot paths to Fastify 5.6.x only if profiling proves need | HTTP ingress + control-plane APIs | You already run Express 5; replacing it immediately is high-risk/low-return. Throughput and latency gains should be evidence-driven | HIGH |
| Operational database | MongoDB Atlas 7.x/8.x replica set or sharded cluster + change streams | Durable operational store for alerts/cases/SAR drafts/config + CDC-style event hooks | Your system is already Mongo-centric. Change streams support near-real-time eventing, but must follow production caveats (oplog sizing, stream count, payload limits) | HIGH |
| Durable event backbone | Kafka-compatible platform (Confluent Cloud preferred; Redpanda/Kafka self-managed if needed) | Replayable event log for transaction, detection, and alert topics | Precision-first AML needs reprocessing, lineage, and deterministic replay. Kafka-style logs are the practical standard for this | MEDIUM-HIGH |
| Node Kafka client | kafkajs 2.2.4 + @kafkajs/confluent-schema-registry 4.0.8 | Produce/consume event streams and enforce contracts | Mature Node integration with explicit schema registry support to reduce malformed-event risk | HIGH |
| Stream contract governance | Confluent Schema Registry (Cloud or Platform) | Schema versioning + compatibility checks for event payloads | Prevents silent producer/consumer drift and reduces data quality incidents in high-volume AML pipelines | HIGH |
| Workflow orchestration | Temporal (Cloud preferred) + @temporalio/client 1.15.0 + @temporalio/worker 1.15.0 | Durable SAR generation, investigator handoffs, retries/timeouts, compensations | SAR/case workflows are long-running and failure-prone; Temporal gives durable execution semantics missing in simple queues | HIGH |
| Job queue for non-critical async work | Redis 7.x + ioredis 5.10.1 + BullMQ 5.73.3 | Email/notification fanout, enrichment backfills, non-critical deferred jobs | BullMQ is excellent for background work, but not the system-of-record event backbone | HIGH |
| Observability baseline | OpenTelemetry JS: @opentelemetry/api 1.9.1, @opentelemetry/sdk-node 0.214.0, @opentelemetry/auto-instrumentations-node 0.72.0 + OTLP exporters 0.214.0 | End-to-end traces/metrics from ingest to alert/SAR | Required for near-real-time SLA enforcement and explainability-at-operations level (why latency/regressions happened) | HIGH |
| Structured logging/metrics | pino 10.3.1 + pino-http 11.0.0 + prom-client 15.1.3 | Low-overhead structured logs + RED/USE metrics | Needed to debug false positives/negatives and operational incidents quickly | HIGH |

### Optional Upgrades (phase after stabilization)

| Technology | Version Guidance | Purpose | When to Add | Confidence |
|------------|------------------|---------|-------------|------------|
| Explainable ML scoring service (Python) | xgboost 3.2.0, lightgbm 4.6.0, shap 0.51.0, scikit-learn 1.8.0 | Improve precision and provide model-level explanation features | Add once rule/graph baseline quality is stable and labeled feedback loop exists | MEDIUM |
| MLOps tracking | mlflow 3.11.1 | Model registry, experiment lineage, offline-to-online traceability | Add when multiple model variants are being tested in production | MEDIUM |
| Feature store | feast 0.62.0 | Consistent online/offline features for AML risk scoring | Add only if feature drift or training-serving skew becomes a repeated issue | MEDIUM |
| Error monitoring | @sentry/node 10.48.0 | Exception tracking with release health | Add when incident response needs stack-trace-centric triage beyond logs/traces | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| mongodb (native driver) | 7.1.1 | Direct access to advanced Mongo features (fine-grained change stream controls) | Use for stream-intensive modules where Mongoose abstraction is limiting | HIGH |
| zod | 4.1.4 | Runtime validation for internal contracts and service boundaries | Use for typed internal DTO validation (AJV remains best for external JSON schema contracts) | HIGH |
| jose | 6.2.2 | Modern JOSE/JWT handling | Use when moving toward stronger key rotation/JWKS patterns | MEDIUM-HIGH |
| vitest | 4.1.4 | Fast unit test runner for new modules | Use for new TS-heavy modules; keep Jest where migration cost is not justified | MEDIUM |
| typescript | 5.8.4 | Safer refactors across detection/scoring/workflow code | Use incrementally on new modules first; avoid big-bang conversion | HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| OpenTelemetry Collector | Vendor-neutral telemetry routing/processing | Keep collector config versioned with environment overlays | HIGH |
| Docker Compose + Testcontainers | Reproducible local integration for Mongo/Kafka/Redis/Temporal | Essential for reliable ingestion-to-alert integration tests | MEDIUM-HIGH |
| k6 or Artillery | Ingestion/replay load tests for under-1-minute SLA | Baseline percentile latency before and after each stack change | MEDIUM |

## Installation

```bash
# Core eventing + workflow + observability runtime dependencies
npm install kafkajs @kafkajs/confluent-schema-registry ioredis bullmq \
  @temporalio/client @temporalio/worker pino pino-http prom-client \
  @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http \
  zod jose mongodb

# Dev dependencies for incremental modernization
npm install -D typescript vitest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative | Confidence |
|-------------|-------------|-------------------------|------------|
| Kafka-compatible event log + schema registry | MongoDB change streams only | Use only for single-service or low-fanout systems where replay/governance needs are modest | HIGH |
| Temporal for SAR/case orchestration | BullMQ-only workflows | Use only for short-lived idempotent jobs where durable workflow history is not required | HIGH |
| Keep Express 5 first, optimize surgically | Full Fastify migration now | Use if profiling shows API framework bottleneck dominates latency budget | MEDIUM-HIGH |
| Redis/BullMQ for auxiliary async jobs | Redis Streams as primary backbone | Use only if org is already deeply Redis-native and does not require Kafka-grade replay/governance semantics | MEDIUM |

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| In-process EventEmitter as the primary inter-service bus | No durable replay, weak failure recovery across process boundaries, poor audit lineage | Kafka-compatible log + schema governance | HIGH |
| BullMQ as core transaction event backbone | BullMQ is queue-first; AML event forensics needs replayable log semantics and schema governance | Kafka + Schema Registry; keep BullMQ for auxiliary async work | HIGH |
| Directly coupling SAR generation to synchronous API requests | LLM/network latency and retries create investigator-facing timeouts and brittle UX | Temporal workflow + async status model with retries/timeouts | HIGH |
| Unversioned JSON event payloads | Breaks downstream consumers silently and degrades explainability lineage | Schema Registry with compatibility checks | HIGH |
| EOL Node releases (e.g., <= v18) for production evolution work | Security and ecosystem support risk | Node 24 LTS (or 22 where required) | HIGH |

## Stack Patterns by Variant

**If traffic is moderate (< 500 TPS ingest) and team is small:**
- Keep Mongo + Express + Kafka + Temporal, with minimal service splitting.
- Because this preserves delivery speed while adding durable eventing/workflow guarantees.

**If traffic is high (>= 500 TPS) or multi-team platformization begins:**
- Split into ingestion, detection, scoring, and case/SAR services; enforce schema contracts per topic.
- Because isolation improves blast-radius control and independent scaling for hot paths.

## Version Compatibility

| Package A | Compatible With | Notes | Confidence |
|-----------|-----------------|-------|------------|
| Node 24.x LTS | Express 5.2.x, KafkaJS 2.2.4, Temporal TS SDK 1.15.0 | Default target for new work; validate native addons in CI | HIGH |
| Node 22.x LTS | Existing backend baseline + above packages | Safe fallback where Node 24 rollout is constrained | HIGH |
| BullMQ 5.73.3 | ioredis 5.10.1, Redis 7.x | Good for async jobs; not your compliance-critical event log | HIGH |
| OTel SDK packages 0.214.0 | @opentelemetry/api 1.9.1, auto-instrumentations 0.72.0 | Keep OTel packages aligned by release family to avoid instrumentation drift | HIGH |
| KafkaJS 2.2.4 | @kafkajs/confluent-schema-registry 4.0.8 | Strong practical pairing for Node producers/consumers with schema governance | HIGH |

## Sources

- https://nodejs.org/en/about/previous-releases - Verified LTS/EOL status (retrieved 2026-04-10) - HIGH
- https://www.mongodb.com/docs/manual/changeStreams/ - Change stream capabilities/limits (retrieved 2026-04-10) - HIGH
- https://www.mongodb.com/docs/manual/administration/change-streams-production-recommendations/ - Production caveats for streams (retrieved 2026-04-10) - HIGH
- https://www.mongodb.com/docs/manual/core/write-operations-atomicity/ - Atomicity/transaction tradeoffs (retrieved 2026-04-10) - HIGH
- https://docs.confluent.io/platform/current/schema-registry/index.html - Schema governance rationale and compatibility model (retrieved 2026-04-10) - HIGH
- https://docs.temporal.io/develop/typescript - Temporal TS workflow capabilities (retrieved 2026-04-10) - HIGH
- https://docs.bullmq.io/ - BullMQ queue semantics and intended use (retrieved 2026-04-10) - HIGH
- https://opentelemetry.io/docs/languages/js/getting-started/nodejs/ - OTel Node guidance (retrieved 2026-04-10) - HIGH
- https://kafka.js.org/docs/getting-started - KafkaJS Node client baseline (retrieved 2026-04-10) - MEDIUM
- npm registry via `npm view` and PyPI via `pip index versions` for package versions (retrieved 2026-04-10) - HIGH

---
*Stack research for: Intelligent AML backend modernization*
*Researched: 2026-04-10*