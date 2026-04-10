"""
TRACR — FastAPI AI Agents Service
══════════════════════════════════════════════════════════════════════════
Start:   cd backend/ai_agents && uvicorn main:app --reload --port 8000
Docs:    http://localhost:8000/docs
══════════════════════════════════════════════════════════════════════════

Endpoints:
  GET  /health                        — service health check
  POST /analyze/transaction           — single-tx AML risk + XAI
  POST /analyze/behavior              — account behavioral deviation
  POST /graph/anomaly-explain         — SMURFING / CIRCULAR_TRADING XAI
  POST /sar/generate-narrative        — SAR narrative from alert_id
"""
import logging
import sys
import os

# ── Path Bootstrap ─────────────────────────────────────────────────────
# Ensure ai_agents/ is on sys.path so relative imports work regardless
# of where uvicorn is launched from.
sys.path.insert(0, os.path.dirname(__file__))

# ── Logging ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("sentinel.ai")

# ── FastAPI App ────────────────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

app = FastAPI(
    title="TRACR AI Agents",
    description=(
        "Intelligent AML Agent Layer — provides XAI narration, behavioral profiling, "
        "graph anomaly explanation, and SAR narrative generation powered by Google Gemini."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow requests from Next.js frontend and Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Node.js backend
        "http://localhost:3001",   # Next.js dev server (alt port)
        "http://localhost:3002",   # Another possible Next.js port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include Routers ────────────────────────────────────────────────────
from routers.analysis import router as analysis_router
from routers.graph import router as graph_router
from routers.sar import router as sar_router

app.include_router(analysis_router)
app.include_router(graph_router)
app.include_router(sar_router)

# ── Health Check ───────────────────────────────────────────────────────
@app.get("/health", tags=["System"], summary="Service health check")
async def health():
    from config import GEMINI_API_KEY, GEMINI_MODEL, MONGO_URI
    gemini_configured = bool(GEMINI_API_KEY and GEMINI_API_KEY != "replace_with_gemini_key")
    return {
        "status": "ok",
        "service": "TRACR AI Agents",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gemini": {
            "configured": gemini_configured,
            "model": GEMINI_MODEL if gemini_configured else None,
            "fallback_mode": not gemini_configured,
        },
        "endpoints": [
            "POST /analyze/transaction",
            "POST /analyze/behavior",
            "POST /graph/anomaly-explain",
            "POST /sar/generate-narrative",
        ],
    }


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "TRACR AI Agents — visit /docs for API documentation"}


# ── Startup / Shutdown Hooks ───────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    from config import GEMINI_API_KEY, MONGO_URI
    gemini_ok = bool(GEMINI_API_KEY and GEMINI_API_KEY != "replace_with_gemini_key")
    logger.info("══════════════════════════════════════════")
    logger.info("  TRACR AI Agents — ONLINE")
    logger.info(f"  Gemini  : {'✅ Configured' if gemini_ok else '⚠️  Not configured (fallback mode)'}")
    logger.info(f"  MongoDB : {MONGO_URI[:40]}...")
    logger.info("  Docs    : http://localhost:8000/docs")
    logger.info("══════════════════════════════════════════")


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("TRACR AI Agents — shutting down")
