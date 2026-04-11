# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```text
TRACR/
├── .github/                       # GSD workflows, skills, agent definitions
├── Docs/                          # Product/design requirement notes
├── backend/                       # Active Node.js backend codebase
│   ├── src/                       # Application source (routes, services, models, tests)
│   ├── package.json               # Backend runtime scripts and dependencies
│   ├── jest.config.js             # Jest test runner config
│   ├── .env.example               # Environment variable template
│   └── seed_data.py               # Python seed helper script
├── frontend/                      # Artifact-only folder (dist/.vite/node_modules)
├── RAD-Intelligent-AML-Framework.md
└── README.md
```

## Directory Purposes

**`.github/`:**
- Purpose: Workflow automation and agent orchestration
- Contains: `agents/`, `skills/`, `get-shit-done/workflows/`, templates
- Key files: `.github/copilot-instructions.md`

**`Docs/`:**
- Purpose: Human documentation for design and tasks
- Contains: `design.md`, `frontend-tasks.md`, `requirements.md`, `tasks.md`

**`backend/`:**
- Purpose: Main executable application code
- Contains: source modules, tests, npm manifest/lock, env sample
- Key files: `backend/src/server.js`, `backend/package.json`, `backend/jest.config.js`

**`backend/src/`:**
- Purpose: Feature-oriented backend modules
- Subdirectories:
  - `audit/` - Audit logging service + property tests
  - `auth/` - JWT and role middleware + auth property tests
  - `detection/` - Graph/cycle/smurfing/behavioral detectors and orchestrator
  - `events/` - Shared event bus
  - `ingestion/` - Input schema, validation, normalization, persistence
  - `integration/` - End-to-end ingestion-to-alert integration test
  - `models/` - Mongoose schemas and model exports
  - `realtime/` - Socket.IO gateway and tests
  - `routes/` - Express route factories and route property tests
  - `sar/` - SAR generation pipeline (prompt/client/format/queue)
  - `scoring/` - Threshold config, geo risk, risk scoring logic
  - `simulator/` - Transaction generator and trace runner
  - `testUtils/` - Shared harness/factories for tests

**`frontend/`:**
- Purpose: Present but currently lacks checked-in source/config files
- Contains: `.vite/`, `dist/`, `node_modules/` directories only
- Notes: No `package.json`, no source tree (`src/`) discovered

## Key File Locations

**Entry Points:**
- `backend/src/server.js`: Application bootstrap and dependency wiring
- `backend/src/simulator/TraceRun.js`: Trace/debug ingestion scenario runner

**Configuration:**
- `backend/package.json`: Scripts/dependencies
- `backend/jest.config.js`: Test configuration
- `backend/.env.example`: Required environment variables
- `.github/copilot-instructions.md`: Project workflow enforcement

**Core Logic:**
- `backend/src/routes/*.js`: HTTP API endpoints
- `backend/src/detection/*.js`: Signal detection pipeline
- `backend/src/scoring/*.js`: Risk scoring and thresholds
- `backend/src/sar/*.js`: SAR generation workflow
- `backend/src/models/*.js`: Persistence contracts

**Testing:**
- Co-located tests in `backend/src/**` using suffixes:
  - `*.property.test.js`
  - `*.integration.test.js`
  - `*.test.js`
- Shared helpers in `backend/src/testUtils/`

**Documentation:**
- `Docs/` for product-facing docs
- `.planning/` for GSD-generated planning/mapping docs

## Naming Conventions

**Files:**
- Service/module files: PascalCase in many domain modules (`RiskScorer.js`, `GraphManager.js`)
- Route files: lowercase (`auth.js`, `alerts.js`, `transactions.js`)
- Tests: descriptive suffixes (`.property.test.js`, `.integration.test.js`, `.test.js`)

**Directories:**
- Lowercase, domain-scoped feature folders under `backend/src/`

**Special Patterns:**
- `index.js` used for export aggregators (`routes/index.js`, `models/index.js`)
- Factory-style route creators named `createXRoutes`

## Where to Add New Code

**New API feature:**
- Route handler: `backend/src/routes/`
- Domain logic/service: existing feature folder in `backend/src/` (or create new domain folder)
- Model/schema: `backend/src/models/` if persistence needed
- Tests: colocated near modified module with matching test suffix

**New detector/scoring capability:**
- Detection logic: `backend/src/detection/`
- Scoring integration: `backend/src/scoring/`
- Event wiring: `backend/src/detection/DetectionOrchestrator.js`
- Tests: add property and unit tests in same folders

**New realtime stream:**
- Gateway event handling: `backend/src/realtime/SocketGateway.js`
- Event source emission: detection/scoring/service module via `eventBus`

**New simulator scenario:**
- Generate traffic in `backend/src/simulator/`
- Reuse helpers in `backend/src/testUtils/`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning artifacts (roadmaps, state, codebase maps)
- Source: Generated/maintained by GSD workflows
- Committed: Depends on workflow config (`commit_docs`)

**`backend/node_modules/` and `frontend/node_modules/`:**
- Purpose: Installed npm dependencies
- Source: Generated by npm
- Committed: Should remain ignored

**`frontend/dist/` and `frontend/.vite/`:**
- Purpose: Build cache/output artifacts
- Source: Vite tooling output
- Committed: Generally should remain ignored

---
*Structure analysis: 2026-04-09*
*Update when directory structure changes*
