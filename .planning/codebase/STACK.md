# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- JavaScript (Node.js CommonJS) - All backend application code in `backend/src/**/*.js`

**Secondary:**
- Python 3.x - Seed/helper script in `backend/seed_data.py`
- Markdown - Product and planning documentation in `Docs/` and `.github/get-shit-done/`

## Runtime

**Environment:**
- Node.js runtime (version not pinned in repo)
- Express HTTP server started from `backend/src/server.js`

**Package Manager:**
- npm (lockfile present: `backend/package-lock.json`)
- Package manifest: `backend/package.json`

## Frameworks

**Core:**
- Express `^5.2.1` - REST API routing and middleware (`backend/src/routes/*.js`)
- Mongoose `^8.19.1` - MongoDB models and persistence (`backend/src/models/*.js`)
- Socket.IO `^4.8.3` - Realtime subscriptions/metrics (`backend/src/realtime/SocketGateway.js`)

**Detection/Validation:**
- AJV `^8.18.0` + `ajv-formats` `^3.0.1` - Transaction schema validation (`backend/src/ingestion/TransactionValidator.js`)

**Security/Auth:**
- jsonwebtoken `^9.0.3` - JWT signing/verification (`backend/src/auth/JWTMiddleware.js`, `backend/src/routes/auth.js`)
- bcrypt `^6.0.0` - Password hash verification (`backend/src/routes/auth.js`)

**AI:**
- @google/generative-ai `^0.24.1` - SAR draft generation (`backend/src/sar/GeminiClient.js`)

**Testing:**
- Jest `^30.3.0` - Unit/integration/property test runner (`backend/jest.config.js`)
- fast-check `^4.6.0` - Property-based tests (`*.property.test.js`)

## Key Dependencies

**Critical:**
- `express` - API surface for ingestion, auth, alerts, graph, cases, admin
- `mongoose` - Data model and query layer for transactions, alerts, cases, SAR drafts, users, config
- `socket.io` - Realtime pipeline updates and dashboard metrics
- `@google/generative-ai` - External LLM call path for SAR generation
- `ajv` / `ajv-formats` - Input contract enforcement for ingestion payloads

**Infrastructure:**
- `dotenv` - Local env variable loading in `backend/src/server.js`
- `uuid` and `crypto.randomUUID()` - Identifier generation across domain objects

## Configuration

**Environment:**
- `.env.example` declares core runtime vars in `backend/.env.example`
  - `MONGO_URI`
  - `JWT_SECRET`
  - `GEMINI_API_KEY`
  - `PORT`
- Runtime loads env via `require("dotenv").config()` in `backend/src/server.js`

**Build/Run:**
- No transpile/bundle step; source executed directly by Node
- Scripts in `backend/package.json`:
  - `npm start` -> `node src/server.js`
  - `npm test` -> `jest`
  - `npm run trace:run` -> scenario runner (`backend/src/simulator/TraceRun.js`)

**Testing Config:**
- `backend/jest.config.js` sets `testEnvironment: node`, roots to `src`, and coverage collection

## Data and Processing Stack

- MongoDB stores operational entities (`Transaction`, `Alert`, `Case`, `AuditLog`, `SARDraft`, `Account`, `User`, `SystemConfig`)
- In-memory processing components for near-real-time detection:
  - `GraphManager` adjacency maps
  - `SmurfingDetector` rolling account windows
  - Event-driven orchestration via `EventEmitter` bus

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node + npm
- Accessible MongoDB instance (`mongodb://localhost:27017/intelligent_aml` by default)
- Gemini API key required for non-partial SAR generation

**Production:**
- Deployment target is not codified in repository
- Requires persistent MongoDB and secure environment variable management
- Horizontal scaling requires additional design for in-memory detector state

---
*Stack analysis: 2026-04-09*
*Update after major dependency or runtime changes*
