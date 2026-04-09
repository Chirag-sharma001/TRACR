# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**LLM Service:**
- Google Gemini API - Generates SAR draft text for suspicious alerts
  - SDK/Client: `@google/generative-ai` via `backend/src/sar/GeminiClient.js`
  - Auth: `GEMINI_API_KEY` environment variable
  - Timeout/Fallback: configurable timeout (`timeoutMs`, default 10s), returns partial payload on failure

**Internal HTTP API Consumers:**
- Transaction simulator and trace runner call backend endpoints
  - Clients: `fetch` in `backend/src/simulator/TransactionSimulator.js` and `backend/src/simulator/TraceRun.js`
  - Target endpoints: `/api/transactions/ingest`
  - Auth: none by default for simulator unless ingest route is protected with JWT middleware

## Data Storage

**Databases:**
- MongoDB (primary operational store)
  - Connection: `MONGO_URI` in env (`backend/src/server.js`)
  - ODM: Mongoose models in `backend/src/models/*.js`
  - Data domains:
    - Transactions (`Transaction`)
    - Alerts (`Alert`)
    - Cases (`Case`)
    - SAR drafts (`SARDraft`)
    - Accounts/baselines (`Account`)
    - Audit logs (`AuditLog`)
    - Runtime config (`SystemConfig`)

**File Storage:**
- None implemented in application code

**Caching:**
- No external cache service (Redis/Memcached not present)
- In-memory maps are used for detection windows and graph representation

## Authentication & Identity

**Auth Provider:**
- Custom JWT auth (no third-party identity provider)
  - Token issue: `backend/src/routes/auth.js`
  - Token verification: `backend/src/auth/JWTMiddleware.js`
  - Secret: `JWT_SECRET` environment variable

**OAuth Integrations:**
- None detected

## Monitoring & Observability

**Error Tracking:**
- No external error tracker (Sentry/Datadog) detected

**Analytics:**
- None detected

**Logs:**
- Application logging uses `console`-style logger injection throughout services
- Audit trail persisted in MongoDB `AuditLog` model via `backend/src/audit/AuditLogger.js`

## CI/CD & Deployment

**Hosting:**
- Hosting platform not specified in repository

**CI Pipeline:**
- No `.github/workflows/*.yml` pipeline files detected for automated test/deploy

## Environment Configuration

**Development:**
- Required vars documented in `backend/.env.example`
- `.env` is ignored by `backend/.gitignore`
- Default local Mongo URI allows out-of-box local boot

**Staging:**
- No explicit staging configuration in repo

**Production:**
- No checked-in deployment manifest or secret manager integration
- Production hardening is expected to be provided by runtime environment

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Realtime Client Integration

- Socket.IO server publishes realtime events to connected UI clients
  - Event source: `backend/src/realtime/SocketGateway.js`
  - Topics: `alert:new`, `alert:updated`, `graph:update`, `metrics:update`
  - CORS default: `*` unless overridden by constructor options

---
*Integration audit: 2026-04-09*
*Update when adding/removing external services*
