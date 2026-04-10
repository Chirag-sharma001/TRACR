# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Event-driven backend monolith for AML detection and case operations.

**Key Characteristics:**
- Single Node.js service process handling HTTP API + realtime socket gateway
- EventEmitter-driven detection pipeline (`transaction:saved` -> detection -> `alert:new`)
- Hybrid state model: MongoDB persistence + in-memory graph/window structures
- Config-driven risk scoring weights via runtime-loaded `SystemConfig`

## Layers

**Transport/API Layer:**
- Purpose: Expose HTTP endpoints for ingestion, auth, graph, alerts, cases, and admin
- Contains: Express routers in `backend/src/routes/*.js`
- Depends on: Middleware (`auth`), domain services, repository abstractions
- Used by: External clients and simulator/trace tooling

**Ingestion Layer:**
- Purpose: Validate, normalize, and persist incoming transactions
- Contains: `TransactionValidator`, `TransactionNormalizer`, `TransactionRepository`
- Depends on: AJV schema (`backend/src/ingestion/transactionSchema.js`), Mongo model, event bus
- Used by: `POST /api/transactions/ingest` route

**Detection Layer:**
- Purpose: Build graph context and detect suspicious behavior patterns
- Contains: `GraphManager`, `CycleDetector`, `SmurfingDetector`, `BehavioralProfiler`, `DetectionOrchestrator`
- Depends on: In-memory state + transaction/account data from Mongo + threshold config
- Used by: Event listener in orchestrator triggered on `transaction:saved`

**Scoring and Alerting Layer:**
- Purpose: Convert detector signals into risk scores and persisted alerts
- Contains: `RiskScorer`, `GeoRiskEvaluator`, `Alert` model
- Depends on: Threshold config, detection outputs, geo heuristics
- Used by: `DetectionOrchestrator` when risk scorer is configured

**SAR Generation Layer:**
- Purpose: Turn alerts into SAR drafts with LLM-assisted narrative
- Contains: `SARService`, `PromptBuilder`, `GeminiClient`, `SARFormatter`, `SARQueue`
- Depends on: Gemini API integration and persisted alert/case context
- Used by: `POST /api/alerts/:id/sar`

**Realtime Layer:**
- Purpose: Push alerts, graph updates, and rolling metrics to connected clients
- Contains: `SocketGateway`
- Depends on: Event bus events + alert aggregation queries
- Used by: Any connected Socket.IO consumer

**Persistence Layer:**
- Purpose: Persist domain entities and configurable thresholds
- Contains: Mongoose schemas in `backend/src/models/*.js`
- Depends on: MongoDB connection from `backend/src/server.js`
- Used by: All service layers

## Data Flow

**Primary Ingestion -> Detection -> Alert Flow:**
1. Client posts transaction to `POST /api/transactions/ingest` in `backend/src/routes/transactions.js`
2. Validator checks schema and normalizer transforms payload to canonical transaction shape
3. Repository writes transaction to Mongo and emits `transaction:saved` on event bus
4. Orchestrator listens to event, updates graph/baseline, runs cycle/smurfing/behavioral analysis in parallel
5. If scorer enabled, risk score is computed and alert persisted
6. Event `alert:new` is emitted for realtime and downstream consumers

**Alert Investigation Flow:**
1. Analyst fetches alerts via `backend/src/routes/alerts.js`
2. Analyst requests SAR generation (`POST /alerts/:id/sar`)
3. SAR service enqueues generation task, calls Gemini, formats output, stores `SARDraft`
4. Audit log entries are written for read/generate actions

**Config Management Flow:**
1. Admin updates thresholds via `PUT /api/admin/config`
2. Values are range-validated against `SystemConfig.valid_range`
3. `ThresholdConfig.reload()` refreshes in-memory config cache used by detectors/scorer

**State Management:**
- Durable state: Mongo collections (`Transaction`, `Alert`, `Case`, `SARDraft`, `AuditLog`, `SystemConfig`, etc.)
- Ephemeral state: in-memory graph adjacency, smurfing windows, socket subscriptions, TPS timestamps

## Key Abstractions

**Factory Route Modules:**
- Purpose: Dependency-injected route creation for easier testing
- Examples: `createTransactionRoutes`, `createAlertRoutes`, `createAdminRoutes`
- Pattern: `createXRoutes({ deps... })` returns Express router

**Event Bus Contract:**
- Purpose: Decouple ingestion, detection, scoring, and realtime updates
- Examples: `transaction:saved`, `detection:completed`, `alert:new`, `alert:updated`
- Pattern: Central `EventEmitter` in `backend/src/events/eventBus.js`

**Config Cache:**
- Purpose: Avoid repeated DB reads for threshold values
- Examples: `thresholdConfig.get("ctr_threshold")`
- Pattern: Reloadable in-memory map (`ThresholdConfig`)

## Entry Points

**Server Entry:**
- Location: `backend/src/server.js`
- Triggers: `npm start` / direct node execution
- Responsibilities:
  - Connect MongoDB
  - Seed default config
  - Build dependency graph
  - Register routes and realtime gateway
  - Start orchestrator and HTTP listener

**Simulation/Diagnostics Entry:**
- Location: `backend/src/simulator/TraceRun.js`
- Triggers: `npm run trace:run`
- Responsibilities: Generate deterministic scenario traffic and print alert trace explanations

## Error Handling

**Strategy:** Boundary-level response errors in routes, resilient fallbacks in service modules, and lightweight retry in repository writes.

**Patterns:**
- Route-level guard clauses return HTTP `400/401/403/404` JSON errors
- `TransactionRepository.save` retries once after 100ms on write failure
- `GeminiClient.generate` catches API/timeout failures and returns `partial` response shape
- Middleware logs auth failures but keeps responses generic (`unauthorized`/`forbidden`)

## Cross-Cutting Concerns

**Logging:**
- Default logger injection is `console`
- Structured-ish object payloads for warning/info events

**Validation:**
- AJV schema validation at ingestion boundary
- Admin config updates validated against persisted numeric ranges

**Authentication/Authorization:**
- JWT middleware parses bearer token and attaches `req.user`
- RBAC middleware enforces role gates for admin API

**Auditing:**
- Operational and security-sensitive actions are persisted via `AuditLogger`

**Realtime Metrics:**
- Periodic 5-second metrics emission in Socket gateway using DB aggregates + in-memory counters

---
*Architecture analysis: 2026-04-09*
*Update when major patterns change*
