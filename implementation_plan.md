# TRACR AML — Frontend-Backend Integration + AI Agent Layer

## Overview

Fix all broken frontend interactions by wiring them to the existing Node.js backend REST API, and create a new `backend/ai_agents/` FastAPI service that wraps ML/LLM-powered AML analysis workflows.

---

## Issues Found & Fixes

### Critical Bugs
| # | Issue | Fix |
|---|-------|-----|
| 1 | `dashboard-engine.js` calls `localhost:5000` but backend is on port **3000** | Change `ENGINE_CONFIG.BASE_URL` to `localhost:3000` |
| 2 | Login bypasses auth — redirects to `/app.html` without calling API | Wire `handleLogin` to `POST /api/auth/login` |
| 3 | All API calls send **no JWT token** (401 errors on alerts, cases, dashboard) | Store token in `localStorage`, attach `Authorization: Bearer <token>` header |
| 4 | Dashboard metrics endpoint requires JWT | Remove `jwtMiddleware` from dashboard route (or use dev bypass) |
| 5 | "Request Guest Access" does nothing | Call `POST /api/auth/login` with demo credentials |
| 6 | "Log Out" does nothing | Clear localStorage token + redirect to `/` |
| 7 | Simulator triggers not wired | Wire to `POST /api/simulator/trigger-anomaly` |
| 8 | Case drawer SAR/Escalate/Close buttons are stubs | Wire to `POST /api/cases/:id/sar/draft`, `PATCH /api/cases/:id/state` |
| 9 | No Simulator page in dashboard | Add Simulator panel to `app.html` nav + template |

---

## Proposed Changes

### Component 1: Backend Port Fix & Auth Setup

#### [MODIFY] [dashboard-engine.js](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/public/dashboard-engine.js)
- Change `BASE_URL` from `localhost:5000` → `localhost:3000`
- Add `getHeaders()` to read JWT from `localStorage`
- Store token from login response in `localStorage`

#### [MODIFY] [dashboard.js](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/backend/src/routes/dashboard.js)
- Remove `jwtMiddleware` from `/overview-metrics` to allow unauthenticated access (dev mode)

---

### Component 2: Frontend Login + Auth Flow

#### [MODIFY] [page.tsx](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/app/page.tsx)
- Wire `handleLogin` → `POST /api/auth/login` with `{ username, password }`
- On success: store JWT in `localStorage`, redirect to `/app.html`
- Wire "Request Guest Access" → login with seeded demo credentials
- Show actual error state on auth failure

---

### Component 3: Frontend app.html — Full Wiring

#### [MODIFY] [app.html](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/public/app.html)
- Add **Simulator** nav item + page template with SMURFING / CIRCULAR_TRADING buttons
- Add Log Out button that clears token + redirects

#### [MODIFY] [interactions.js](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/public/interactions.js)
- `submitNewCase()` — already calls `POST /api/cases` but needs JWT header
- Case drawer: wire "File SAR" → `POST /api/cases/:id/sar/draft`
- Case drawer: wire "Escalate" → `PATCH /api/cases/:id/state` with `to_state: ESCALATED`
- Case drawer: wire "Close Case" → `PATCH /api/cases/:id/state` with `to_state: CLOSED_DISMISSED`
- Case drawer: wire "Save Note" → `POST /api/cases/:id/notes`
- Log Out → clear token + `window.location.href = '/'`

#### [NEW] [api-client.js](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/public/api-client.js)
- Centralized API client with auth header injection
- Token storage helpers (`getToken`, `setToken`, `clearToken`)
- `apiGet`, `apiPost`, `apiPatch` wrappers with error handling

---

### Component 4: Simulator Page

#### [MODIFY] [app.html](file:///Users/madhurchouhan/macbook/hackathon_projects/TRACR/frontend-new/public/app.html)
- Add `simulator` to PAGES array
- Add sidebar nav link for Simulator
- Add `<template id="page-simulator">` with:
  - Two trigger cards: SMURFING and CIRCULAR_TRADING
  - Live log output area that fills when triggered
  - AI Agent trigger button that calls FastAPI

---

### Component 5: FastAPI AI Agents Service

#### [NEW] `backend/ai_agents/` directory

```
backend/
  ai_agents/
    main.py              ← FastAPI app entry point
    requirements.txt     ← Python deps
    agents/
      __init__.py
      transaction_analyzer.py   ← Analyzes single transaction patterns
      behavioral_profiler.py    ← Builds behavioral baseline deviation reports
      network_graph_agent.py    ← Graph-based cycle/smurfing detection insights
      xai_narrator.py           ← Generates natural language XAI summaries
    routers/
      __init__.py
      analysis.py        ← /analyze/transaction, /analyze/behavior
      graph.py           ← /graph/anomaly-explain
      sar.py             ← /sar/generate-narrative
    schemas/
      __init__.py
      transaction.py     ← Pydantic models
      alert.py
      graph.py
    config.py            ← Settings (GEMINI_API_KEY, MONGO_URI env vars)
```

**FastAPI Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analyze/transaction` | POST | Analyze a transaction payload, return risk factors + XAI |
| `/analyze/behavior` | POST | Given account history, flag behavioral deviation |
| `/graph/anomaly-explain` | POST | Explain detected graph cycle (circular trading / smurfing) |
| `/sar/generate-narrative` | POST | Generate SAR narrative text from alert evidence |
| `/health` | GET | Health check |

**AI Workflow:**
- Uses **Google Gemini** (via `GEMINI_API_KEY`) for natural language XAI narratives
- Agents call Mongo directly or consume data passed in request body
- CORS enabled so the Node.js backend can proxy requests to it

---

## Verification Plan

### Automated
1. Run backend: `cd backend && npm start`
2. Run FastAPI: `cd backend/ai_agents && uvicorn main:app --port 8000`
3. Run frontend: `cd frontend-new && npm run dev`

### Manual Browser Testing
- [ ] Login with valid credentials → JWT stored, redirected to dashboard
- [ ] Dashboard KPIs load from real backend data
- [ ] Alerts list populates from `/api/alerts`
- [ ] Cases table populates from `/api/cases`
- [ ] Socket.io live alert events show toast notifications
- [ ] Simulator page: "Inject Smurfing" → POST to backend → live feed updates
- [ ] New Case modal → creates real case in DB
- [ ] Case drawer → SAR draft generated
- [ ] Log Out → token cleared, redirected to login
- [ ] FastAPI `/analyze/transaction` returns XAI explanation
