<!-- GSD:project-start source:PROJECT.md -->
## Project

**Intelligent AML Framework**

An AI-powered anti-money-laundering platform for financial operations teams that detects suspicious transaction behavior in near real time and explains why an alert was raised. It combines graph-based pattern detection, behavior anomaly detection, configurable risk scoring, and investigator workflows (alerts, cases, and SAR draft generation). The v1 direction is a hybrid evolution of the existing backend: preserve the current core pipeline and improve precision, explainability, and operational reliability.

**Core Value:** Detect suspicious financial activity quickly and explain it clearly enough that analysts can trust and act on alerts.

### Constraints

- **Architecture**: Hybrid evolution — preserve and extend existing backend modules instead of rewriting from scratch
- **Latency**: Near-real-time operations — ingestion-to-alert pipeline should target under 1 minute
- **Quality Priority**: Precision-first in v1 when precision/recall tradeoffs occur
- **Personas**: Balanced MVP for analyst, investigator, and manager workflows (no single persona-only product)
- **Operational Baseline**: No hard timeline/budget/compliance constraints provided at initialization; use pragmatic defaults
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (Node.js CommonJS) - All backend application code in `backend/src/**/*.js`
- Python 3.x - Seed/helper script in `backend/seed_data.py`
- Markdown - Product and planning documentation in `Docs/` and `.github/get-shit-done/`
## Runtime
- Node.js runtime (version not pinned in repo)
- Express HTTP server started from `backend/src/server.js`
- npm (lockfile present: `backend/package-lock.json`)
- Package manifest: `backend/package.json`
## Frameworks
- Express `^5.2.1` - REST API routing and middleware (`backend/src/routes/*.js`)
- Mongoose `^8.19.1` - MongoDB models and persistence (`backend/src/models/*.js`)
- Socket.IO `^4.8.3` - Realtime subscriptions/metrics (`backend/src/realtime/SocketGateway.js`)
- AJV `^8.18.0` + `ajv-formats` `^3.0.1` - Transaction schema validation (`backend/src/ingestion/TransactionValidator.js`)
- jsonwebtoken `^9.0.3` - JWT signing/verification (`backend/src/auth/JWTMiddleware.js`, `backend/src/routes/auth.js`)
- bcrypt `^6.0.0` - Password hash verification (`backend/src/routes/auth.js`)
- @google/generative-ai `^0.24.1` - SAR draft generation (`backend/src/sar/GeminiClient.js`)
- Jest `^30.3.0` - Unit/integration/property test runner (`backend/jest.config.js`)
- fast-check `^4.6.0` - Property-based tests (`*.property.test.js`)
## Key Dependencies
- `express` - API surface for ingestion, auth, alerts, graph, cases, admin
- `mongoose` - Data model and query layer for transactions, alerts, cases, SAR drafts, users, config
- `socket.io` - Realtime pipeline updates and dashboard metrics
- `@google/generative-ai` - External LLM call path for SAR generation
- `ajv` / `ajv-formats` - Input contract enforcement for ingestion payloads
- `dotenv` - Local env variable loading in `backend/src/server.js`
- `uuid` and `crypto.randomUUID()` - Identifier generation across domain objects
## Configuration
- `.env.example` declares core runtime vars in `backend/.env.example`
- Runtime loads env via `require("dotenv").config()` in `backend/src/server.js`
- No transpile/bundle step; source executed directly by Node
- Scripts in `backend/package.json`:
- `backend/jest.config.js` sets `testEnvironment: node`, roots to `src`, and coverage collection
## Data and Processing Stack
- MongoDB stores operational entities (`Transaction`, `Alert`, `Case`, `AuditLog`, `SARDraft`, `Account`, `User`, `SystemConfig`)
- In-memory processing components for near-real-time detection:
## Platform Requirements
- macOS/Linux/Windows with Node + npm
- Accessible MongoDB instance (`mongodb://localhost:27017/intelligent_aml` by default)
- Gemini API key required for non-partial SAR generation
- Deployment target is not codified in repository
- Requires persistent MongoDB and secure environment variable management
- Horizontal scaling requires additional design for in-memory detector state
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Domain services often use PascalCase filenames: `RiskScorer.js`, `GraphManager.js`, `TransactionValidator.js`
- Route modules use lowercase filenames: `auth.js`, `alerts.js`, `graph.js`, `admin.js`
- Tests are colocated and use explicit suffixes:
- Route factory naming pattern: `createXRoutes(...)`
- Regular helper/service methods use camelCase
- Event handlers commonly prefixed with `on` (for example `onTransactionSaved`)
- JavaScript locals: camelCase
- API and persisted domain fields often use snake_case (`transaction_id`, `risk_tier`, `created_at`)
- Enum-like constants use UPPER_SNAKE_CASE labels for domain values (`HIGH`, `SMURFING`)
- Class names are PascalCase (`CycleDetector`, `SARService`, `ThresholdConfig`)
- No TypeScript interfaces/types (JavaScript-only codebase)
## Code Style
- Semicolons are consistently present
- String quotes are predominantly double quotes
- Object literals often use trailing commas in multiline structures
- Mixed indentation widths exist (2-space and 4-space files); preserve surrounding file style when editing
- No ESLint/Prettier configuration files found in `backend/`
- Formatting conventions are currently enforced by repository habits and test review, not auto-format tools
## Import/Require Organization
- Logical blank lines between dependency groups are common
- Strict alphabetical ordering is not consistently applied
## Error Handling
- Route handlers use guard clauses and return explicit HTTP error payloads
- Middleware emits generic auth errors to client (`unauthorized`, `forbidden`) and logs details server-side
- Service modules prefer graceful fallback for external failures (for example partial SAR on Gemini failures)
- `TransactionRepository.save` has single retry with short sleep for transient persistence failures
- Detection orchestrator catches baseline update errors and continues core detection flow
## Logging
- Default logger is injected `console`
- Structured context is passed as object in log calls (`logger.warn("key", { ... })`)
- Event-oriented log keys (`graph_bootstrap_complete`, `detection_complete`, `jwt_auth_failed`)
- Warning/error logs at boundary failures, info logs for lifecycle events
## Comments
- Sparse in implementation modules
- More explanatory comments in test files (feature/property references)
- Prefer self-descriptive code over heavy comments
- Minimal inline comments; documentation emphasis is in test names and variable naming
## Function Design
- Constructor dependency injection with defaults is common (`{ dep = defaultDep } = {}`)
- Guard-clause-first flow in route handlers
- Private helper methods via `#privateMethod` are used in several classes
- Methods generally focus on one responsibility (validation, normalization, scoring, etc.)
## Module Design
- CommonJS `module.exports` everywhere
- Single-export class/module pattern is dominant
- Aggregator `index.js` modules expose grouped exports for routes/models
- Many modules accept model/logger/config dependencies for testability
- Test suites exploit this pattern with stubs/mocks rather than full stack boot
## Conventions to Preserve for New Code
- Maintain route factory pattern (`createXRoutes`) for Express routers
- Keep event bus emission names consistent (`domain:action` format)
- Match existing snake_case API field contracts
- Inject dependencies into services for easier test mocking
- Preserve per-file indentation style to avoid noisy diffs
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Single Node.js service process handling HTTP API + realtime socket gateway
- EventEmitter-driven detection pipeline (`transaction:saved` -> detection -> `alert:new`)
- Hybrid state model: MongoDB persistence + in-memory graph/window structures
- Config-driven risk scoring weights via runtime-loaded `SystemConfig`
## Layers
- Purpose: Expose HTTP endpoints for ingestion, auth, graph, alerts, cases, and admin
- Contains: Express routers in `backend/src/routes/*.js`
- Depends on: Middleware (`auth`), domain services, repository abstractions
- Used by: External clients and simulator/trace tooling
- Purpose: Validate, normalize, and persist incoming transactions
- Contains: `TransactionValidator`, `TransactionNormalizer`, `TransactionRepository`
- Depends on: AJV schema (`backend/src/ingestion/transactionSchema.js`), Mongo model, event bus
- Used by: `POST /api/transactions/ingest` route
- Purpose: Build graph context and detect suspicious behavior patterns
- Contains: `GraphManager`, `CycleDetector`, `SmurfingDetector`, `BehavioralProfiler`, `DetectionOrchestrator`
- Depends on: In-memory state + transaction/account data from Mongo + threshold config
- Used by: Event listener in orchestrator triggered on `transaction:saved`
- Purpose: Convert detector signals into risk scores and persisted alerts
- Contains: `RiskScorer`, `GeoRiskEvaluator`, `Alert` model
- Depends on: Threshold config, detection outputs, geo heuristics
- Used by: `DetectionOrchestrator` when risk scorer is configured
- Purpose: Turn alerts into SAR drafts with LLM-assisted narrative
- Contains: `SARService`, `PromptBuilder`, `GeminiClient`, `SARFormatter`, `SARQueue`
- Depends on: Gemini API integration and persisted alert/case context
- Used by: `POST /api/alerts/:id/sar`
- Purpose: Push alerts, graph updates, and rolling metrics to connected clients
- Contains: `SocketGateway`
- Depends on: Event bus events + alert aggregation queries
- Used by: Any connected Socket.IO consumer
- Purpose: Persist domain entities and configurable thresholds
- Contains: Mongoose schemas in `backend/src/models/*.js`
- Depends on: MongoDB connection from `backend/src/server.js`
- Used by: All service layers
## Data Flow
- Durable state: Mongo collections (`Transaction`, `Alert`, `Case`, `SARDraft`, `AuditLog`, `SystemConfig`, etc.)
- Ephemeral state: in-memory graph adjacency, smurfing windows, socket subscriptions, TPS timestamps
## Key Abstractions
- Purpose: Dependency-injected route creation for easier testing
- Examples: `createTransactionRoutes`, `createAlertRoutes`, `createAdminRoutes`
- Pattern: `createXRoutes({ deps... })` returns Express router
- Purpose: Decouple ingestion, detection, scoring, and realtime updates
- Examples: `transaction:saved`, `detection:completed`, `alert:new`, `alert:updated`
- Pattern: Central `EventEmitter` in `backend/src/events/eventBus.js`
- Purpose: Avoid repeated DB reads for threshold values
- Examples: `thresholdConfig.get("ctr_threshold")`
- Pattern: Reloadable in-memory map (`ThresholdConfig`)
## Entry Points
- Location: `backend/src/server.js`
- Triggers: `npm start` / direct node execution
- Responsibilities:
- Location: `backend/src/simulator/TraceRun.js`
- Triggers: `npm run trace:run`
- Responsibilities: Generate deterministic scenario traffic and print alert trace explanations
## Error Handling
- Route-level guard clauses return HTTP `400/401/403/404` JSON errors
- `TransactionRepository.save` retries once after 100ms on write failure
- `GeminiClient.generate` catches API/timeout failures and returns `partial` response shape
- Middleware logs auth failures but keeps responses generic (`unauthorized`/`forbidden`)
## Cross-Cutting Concerns
- Default logger injection is `console`
- Structured-ish object payloads for warning/info events
- AJV schema validation at ingestion boundary
- Admin config updates validated against persisted numeric ranges
- JWT middleware parses bearer token and attaches `req.user`
- RBAC middleware enforces role gates for admin API
- Operational and security-sensitive actions are persisted via `AuditLogger`
- Periodic 5-second metrics emission in Socket gateway using DB aggregates + in-memory counters
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.github/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
