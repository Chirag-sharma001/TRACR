# Project Research Summary

**Project:** Intelligent AML Framework
**Domain:** AI-powered AML detection and operations platform (brownfield Node/Mongo modernization)
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a precision-first, explainable AML platform built on an existing Node/Mongo backend that already supports ingestion, detection, risk scoring, alerts, cases, and SAR draft generation. The research converges on a hybrid evolution strategy: keep the current architecture footprint where it is effective, then incrementally introduce durable eventing, worker isolation, stronger explainability contracts, and governance controls instead of attempting a risky greenfield rewrite.

The recommended build approach is to harden foundations before adding intelligence breadth: establish contracts, observability, and model/config governance first; then implement transactional outbox plus idempotent worker processing; then improve detector quality and state determinism; then formalize explainability and workflow UX contracts; and finally harden security/SAR compliance operations. This sequencing best supports the under-1-minute operational target while preserving analyst trust and regulatory defensibility.

The largest risks are silent event loss/duplication, precision collapse from unguided threshold tuning, non-deterministic detector behavior across restarts/scaling, and SAR confidentiality or workflow compliance failures. Mitigation is explicit and actionable in research: outbox + replay + reconciliation, segmented quality gates with rollback, checkpointed state with deterministic rehydration tests, mandatory explainability envelopes, and strict least-privilege/confidentiality controls for SAR-linked data.

## Key Findings

### Recommended Stack

Research strongly favors Node 24.x LTS (22.x fallback), keeping Express 5 for now, MongoDB as operational source of truth, and adding a Kafka-compatible durable event backbone with schema governance. Temporal is recommended for long-running compliance workflows, while Redis + BullMQ should remain for non-critical async work. Observability must be first-class via OpenTelemetry, structured logs, and metrics.

This stack is intentionally evolutionary: preserve current delivery speed, then improve durability, replayability, and failure isolation where AML reliability demands it.

**Core technologies:**
- Node.js 24.x LTS: runtime stability and security support window for production modernization.
- Express 5.2.x (near-term): low migration risk while hot-path bottlenecks are validated via profiling.
- MongoDB Atlas 7.x/8.x: operational persistence plus outbox/change-stream integration paths.
- Kafka-compatible platform + Schema Registry: replayable event log and contract governance.
- Temporal TS SDK: durable, auditable long-running case/SAR orchestration.
- Redis 7.x + BullMQ: auxiliary async jobs and fanout tasks (not primary compliance event backbone).
- OpenTelemetry + pino + prom-client: end-to-end SLA proof, incident triage, and operational explainability.

### Expected Features

The feature research is clear that launch quality depends on table stakes being operationally complete, not just algorithmically present. The platform must produce explainable, defendable alerts and support end-to-end investigation/SAR workflows with timeliness, auditability, and management oversight.

**Must have (table stakes):**
- Risk-based alerting tuned by segment and behavior, not global thresholds.
- End-to-end alert operations workflow with ownership, SLA timers, and escalation.
- Explainable alert packet contract with reasons, evidence, and score decomposition.
- SAR quality/timeliness controls with documented no-file rationale and deadline tracking.
- Immutable audit trail and strict SAR confidentiality guardrails.
- Config/model governance for threshold changes (approval + rollback + traceability).
- Manager oversight console for quality, throughput, and risk posture.

**Should have (competitive):**
- Investigation graph storyline replay for complex multi-hop case understanding.
- Threshold what-if simulator for safer policy updates.
- Confidence/uncertainty indicators to reduce overreaction to weak evidence.

**Defer (v2+):**
- Evidence-first investigator copilot (retrieval-grounded only, high governance burden).
- Typology update engine from advisories (requires shadow testing and controlled activation).
- Analyst feedback learning loop (requires sufficient labeled outcomes and mature controls).

### Architecture Approach

Architecture research recommends a modular-monolith-to-worker decomposition path using transactional outbox and idempotent consumers. Keep synchronous APIs thin (validate, persist, acknowledge), move heavy detection/SAR flows to workers, and make explanation envelopes a first-class domain contract. This approach addresses latency, scale, replay, and auditability without a disruptive rewrite.

**Major components:**
1. Control plane APIs: command validation, authorization, and query surfaces for alerts/cases/admin.
2. Eventing and worker plane: outbox relay, detection workers, SAR workers, retry/DLQ handling.
3. Data/platform plane: Mongo source of truth, Redis acceleration, observability pipeline, realtime fanout.
4. Domain contracts layer: detector outputs, score policies, explainability envelope, event schema versioning.

### Critical Pitfalls

1. **Precision collapse from volume-first tuning** - enforce segment-level quality gates, false-positive budgets, and rollback criteria.
2. **Fragile ingestion-to-detection delivery** - implement transactional outbox, idempotent consumers, replay tooling, and reconciliation.
3. **Non-deterministic detector state** - checkpoint and rehydrate state deterministically; never rely on memory as source of truth.
4. **Explainability as afterthought** - require schema-valid reasons/evidence for every alert before release gates.
5. **SAR confidentiality/workflow breakdowns** - encode least privilege, redaction defaults, and deadline-governed SAR state machine controls.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 1: Governance, Contracts, and Observability Foundation
**Rationale:** Every later phase depends on measurable SLAs, stable contracts, and auditable change control.
**Delivers:** Event schema/versioning policy, correlation IDs, OTel traces/metrics, model/config governance baseline.
**Addresses:** Config/model governance, manager oversight prerequisites, compliance evidence readiness.
**Avoids:** Missing telemetry, weak model challenge discipline, untracked threshold drift.

### Phase 2: Durable Event Backbone and Idempotency
**Rationale:** Reliability of transaction-to-detection flow is the core correctness dependency for all AML outcomes.
**Delivers:** Transactional outbox, relay worker, idempotent consumer contract, DLQ/replay tooling, reconciliation jobs.
**Uses:** Mongo + queue/stream + schema registry patterns from stack guidance.
**Implements:** Outbox/event relay and worker communication boundaries.
**Avoids:** Event loss/duplication and retry storms.

### Phase 3: Detection Quality and State Correctness
**Rationale:** Once delivery is durable, quality and determinism become the biggest value driver.
**Delivers:** Segmented threshold strategy, precision guardrails, checkpointed graph/behavior state, deterministic replay tests.
**Addresses:** Risk-based alerting quality and analyst trust.
**Avoids:** Volume-first optimization and single-process state divergence.

### Phase 4: Explainability Contract and Investigator Workflow Hardening
**Rationale:** Explainability and workflow controls convert detections into defendable case decisions.
**Delivers:** Mandatory explanation envelope, evidence indexing, workflow ownership/SLA clocks, no-file rationale taxonomy.
**Implements:** Explainability read models and control-plane workflow improvements.
**Avoids:** Black-box alerts, manual SAR evidence reconstruction, queue aging blind spots.

### Phase 5: Security, Access Control, and Realtime Resilience
**Rationale:** Confidentiality and scope-safe access are critical before scaling user adoption.
**Delivers:** Row/channel scoped authorization, SAR field classification/redaction, websocket hardening, multi-node realtime reliability.
**Addresses:** Audit trail integrity and secure investigator/manager operations.
**Avoids:** Tipping-off leaks, horizontal privilege escalation, insecure realtime fanout.

### Phase 6: SAR Operations Assurance and Advanced Intelligence
**Rationale:** Compliance-grade SAR lifecycle must be stable before higher-order AI differentiators are activated.
**Delivers:** Full SAR state machine with deadline controls, continuing-activity workflows, then staged rollout of copilot/typology/learning loop features.
**Addresses:** SAR timeliness/quality controls plus future differentiators.
**Avoids:** Autonomous filing risk, uncontrolled model adaptation, compliance process drift.

### Phase Ordering Rationale

- Dependencies dictate order: governance and contracts first, then durable transport, then detector quality, then explainability/workflow, then security/realtime hardening, then advanced intelligence.
- Architecture-aligned grouping reduces migration risk: outbox and workerization precede read-model and UX semantics.
- Pitfall prevention is front-loaded: highest-impact failure modes (event correctness, precision drift, telemetry gaps) are addressed before scale and feature expansion.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Specific queue/stream platform choice and contract evolution strategy by expected throughput and ops maturity.
- **Phase 3:** Detector calibration methodology, precision proxy design, and replay test data strategy.
- **Phase 6:** Regulatory-safe copilot design, typology ingestion workflow, and model governance depth for learning systems.

Phases with standard patterns (can likely skip research-phase):
- **Phase 1:** OTel instrumentation, correlation IDs, and baseline governance controls are well-documented.
- **Phase 4:** Explainability envelope and workflow state modeling have strong prior-art patterns in internal and domain guidance.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Version guidance and architecture choices are grounded in official runtime/platform documentation and fit current codebase constraints. |
| Features | MEDIUM | Regulatory/table-stakes are clear, but differentiator ROI depends on post-launch telemetry and data maturity. |
| Architecture | MEDIUM-HIGH | Brownfield-compatible migration path is coherent and dependency-aware; exact partitioning thresholds need empirical load validation. |
| Pitfalls | HIGH | Risks and mitigations align with known AML operations, reliability engineering, and compliance control failure modes. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Throughput-based decomposition threshold: define objective cutover criteria (queue lag, p95 latency, worker saturation) during planning.
- Precision KPI baseline: finalize measurable success metrics before threshold experiments.
- SAR governance interpretation details: validate institution-specific legal/compliance policy differences before automation depth increases.
- Advanced AI feature controls: define strict groundedness, approval, and rollback rules before enabling copilot or adaptive learning loops.

## Sources

### Primary (HIGH confidence)
- Official Node.js release policy and LTS schedule.
- MongoDB documentation (change streams, production guidance, atomicity patterns).
- Confluent schema governance documentation.
- Temporal TypeScript SDK documentation.
- BullMQ documentation.
- OpenTelemetry JavaScript documentation.
- FFIEC/FinCEN/FATF guidance and updates.
- Federal Reserve SR 11-7 model risk management guidance.

### Secondary (MEDIUM confidence)
- Internal research outputs in .planning/research/STACK.md, .planning/research/FEATURES.md, .planning/research/ARCHITECTURE.md, and .planning/research/PITFALLS.md.
- Internal context in .planning/PROJECT.md and architecture concern analyses.

### Tertiary (LOW confidence)
- None material in current synthesis.

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
