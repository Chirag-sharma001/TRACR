# Phase 2: Durable Transaction Processing - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 hardens ingest-to-detection durability so accepted transactions are processed exactly-once semantically with replay-safe recovery controls.

In scope:
- Durable idempotency contract for ingest and downstream processing
- Recoverable failed-item model with operator-triggered replay controls
- Operator visibility for backlog/failed items and bounded replay actions

Out of scope:
- Distributed exactly-once guarantees across multiple external services
- Multi-region replay orchestration
</domain>

<decisions>
## Implementation Decisions

### Idempotency Contract
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
</decisions>

<canonical_refs>
## Canonical References

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 2 goal/success criteria
- `.planning/REQUIREMENTS.md` - DET-02 requirement mapping
- `.planning/PROJECT.md` - hybrid evolution and reliability constraints

### Existing durability pipeline surface
- `backend/src/routes/transactions.js` - ingest API entrypoints
- `backend/src/ingestion/TransactionRepository.js` - transaction persistence and duplicate handling baseline
- `backend/src/ingestion/TransactionNormalizer.js` - ingest normalization logic
- `backend/src/events/eventBus.js` - event dispatch path
- `backend/src/detection/DetectionOrchestrator.js` - downstream processing consumer path
</canonical_refs>

<specifics>
## Specific Ideas

- Keep semantic exactly-once guarantees at transaction/business-effect level rather than relying only on transport-level uniqueness.
- Treat replay as an explicit operator workflow with auditable actions.
- Design operator controls for safe, bounded reprocessing to prevent duplicate bursts.
</specifics>

<deferred>
## Deferred Ideas

- Distributed exactly-once across multiple external services and cross-region orchestration.
</deferred>

---

*Phase: 02-durable-transaction-processing*
*Context gathered via /gsd-discuss-phase interactive questioning*
