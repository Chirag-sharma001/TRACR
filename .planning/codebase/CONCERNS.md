# Codebase Concerns

**Analysis Date:** 2026-04-09

## Tech Debt

**Dual baseline recomputation path:**
- Issue: Baseline updates are triggered in two places for each saved transaction
- Files: `backend/src/server.js` and `backend/src/detection/DetectionOrchestrator.js`
- Why: Both global event listener and orchestrator path call behavioral baseline update functions
- Impact: Extra DB load and duplicated baseline recomputation work under high ingestion throughput
- Fix approach: Consolidate baseline update responsibility to one pipeline stage

**Encoding anomalies in root docs/config:**
- Issue: Root text files use UTF-16 with BOM and nonstandard content formatting
- Files: `README.md`, `.gitignore`
- Why: Likely created/edited by tooling with UTF-16 encoding
- Impact: Shell tooling and simple text scanners may misread content; ignore rules may not behave as intended
- Fix approach: Normalize to UTF-8 and verify ignore semantics (`backend/node_modules` pattern correctness)

**Frontend artifact-only directory without source contract:**
- Issue: `frontend/` contains `node_modules`, `.vite`, and `dist` directories but no source/config files
- Files: `frontend/`
- Why: Partial or transient frontend setup checked into workspace
- Impact: Ambiguity for roadmap/planning and risk of committing generated artifacts
- Fix approach: Either add real frontend source + manifest or remove/generated-ignore this folder

## Known Bugs / High-Risk Behaviors

**JWT secret not explicitly validated at startup:**
- Symptoms: Runtime auth/signing can fail if `JWT_SECRET` is missing or invalid
- Files: `backend/src/routes/auth.js`, `backend/src/auth/JWTMiddleware.js`, `backend/src/server.js`
- Trigger: Starting app without `JWT_SECRET` configured
- Workaround: Set `JWT_SECRET` in env before startup
- Root cause: No hard startup guard for required auth secrets

**Transaction save retry is broad and non-discriminating:**
- Symptoms: Any persistence error triggers one retry regardless of error category
- File: `backend/src/ingestion/TransactionRepository.js`
- Trigger: Duplicate key errors or validation errors on create
- Workaround: None in code path (retry may repeat deterministic failure)
- Root cause: Retry policy does not classify transient vs permanent errors

## Security Considerations

**Unrestricted Socket.IO CORS default:**
- Risk: Any origin can subscribe unless constructor override is provided
- File: `backend/src/realtime/SocketGateway.js`
- Current mitigation: Optional constructor parameter (`corsOrigin`) exists
- Recommendations: Enforce explicit allowed origins via env/config in production

**No brute-force throttling on login endpoint:**
- Risk: Credential stuffing / repeated password attempts not rate-limited
- File: `backend/src/routes/auth.js`
- Current mitigation: Audit logging of auth failures
- Recommendations: Add IP/user rate limiting and lockout policy

**No explicit authorization checks for alert/case ownership scope:**
- Risk: Any authenticated role may access broad datasets if route is reachable
- Files: `backend/src/routes/alerts.js`, `backend/src/routes/cases.js`
- Current mitigation: JWT required; admin routes additionally RBAC-protected
- Recommendations: Add tenant/ownership filters and role-based data visibility rules

## Performance Bottlenecks

**Graph prune complexity scales with edge count:**
- Problem: `pruneOldEdges` iterates all adjacency/reverse adjacency entries and rebuilds metadata
- File: `backend/src/detection/GraphManager.js`
- Measurement: Not instrumented in repo
- Cause: Full scans over in-memory edge maps on each prune cycle
- Improvement path: Introduce time-indexed eviction or incremental metadata maintenance

**Metrics pipeline performs repeated DB aggregates every 5s:**
- Problem: Socket gateway emits metrics with aggregate queries on interval
- File: `backend/src/realtime/SocketGateway.js`
- Measurement: Not instrumented in repo
- Cause: Frequent aggregate reads (`alertCounts` + 24h trend)
- Improvement path: Cache short-window aggregates or back off update frequency under load

## Fragile Areas

**In-memory detector state tied to single process:**
- Why fragile: Graph and smurfing windows live only in process memory
- Files: `backend/src/detection/GraphManager.js`, `backend/src/detection/SmurfingDetector.js`
- Common failures: State reset on restart, inconsistent behavior in multi-instance deployment
- Safe modification: Keep persistence/rehydration strategy aligned when changing detector internals
- Test coverage: Unit/property coverage exists, but no distributed-state tests

**Event contract coupling across modules:**
- Why fragile: Multiple subsystems depend on exact event names and payload shapes
- Files: `backend/src/events/eventBus.js`, `backend/src/detection/DetectionOrchestrator.js`, `backend/src/realtime/SocketGateway.js`
- Common failures: Silent breakages when event payload fields change
- Safe modification: Introduce event schema tests and centralize event type constants
- Test coverage: Partial integration coverage; contract drift risk remains

## Scaling Limits

**Single-process throughput constraints:**
- Current capacity: Not benchmarked in repo
- Limit: CPU and memory bound by one Node process handling API + detection + realtime
- Symptoms at limit: Increased ingestion latency, delayed alert/metrics emissions
- Scaling path: Externalize shared state and adopt worker/service separation

**SAR queue concurrency is process-local:**
- Current capacity: Controlled by `GEMINI_CONCURRENCY` (default 2)
- Limit: No distributed queue semantics; pending tasks lost on process failure
- Symptoms at limit: Backlog growth and request latency for SAR generation
- Scaling path: Move queue to durable broker (Redis/worker queue) with retries and persistence

## Dependencies at Risk

**Test tooling in production dependency set:**
- Risk: `jest` and `fast-check` are listed under `dependencies` instead of `devDependencies`
- File: `backend/package.json`
- Impact: Larger production install footprint and unnecessary runtime surface
- Migration plan: Move test-only packages to `devDependencies`

## Missing Critical Features

**Startup configuration validation:**
- Problem: Required env vars are documented but not centrally validated
- Current workaround: Manual setup discipline
- Blocks: Reliable deployment confidence and fail-fast behavior
- Implementation complexity: Low (add startup schema validation)

**Operational instrumentation baseline:**
- Problem: No explicit metrics/tracing pipeline beyond ad hoc logs and socket metrics payload
- Current workaround: Manual log review
- Blocks: Confident production diagnosis under load
- Implementation complexity: Medium

## Test Coverage Gaps

**Real database integration coverage:**
- What's not tested: Full stack with real MongoDB and live Mongoose behavior (indexes, race patterns)
- Risk: Environment-specific persistence issues may surface late
- Priority: High
- Difficulty to test: Medium (requires controlled test DB lifecycle)

**Security hardening scenarios:**
- What's not tested: Rate limiting, auth abuse cases, cross-origin websocket restrictions
- Risk: Security regressions remain undetected
- Priority: High
- Difficulty to test: Medium

---
*Concerns audit: 2026-04-09*
*Update as issues are fixed or new ones discovered*
