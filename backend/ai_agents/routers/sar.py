"""
Router: /sar/generate-narrative
Fetches the alert from MongoDB, then generates a SAR narrative via the AI agent.
"""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException
from pymongo import MongoClient

from schemas import SARRequest, SARNarrativeResponse
from agents import network_graph_agent
from config import MONGO_URI

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sar", tags=["SAR Generation"])

# MongoDB client (lazy, module-level)
_mongo_client: MongoClient | None = None
_db = None


def _get_db():
    global _mongo_client, _db
    if _db is not None:
        return _db
    _mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    _db = _mongo_client.get_default_database()
    return _db


@router.post(
    "/generate-narrative",
    response_model=SARNarrativeResponse,
    summary="Generate a SAR narrative from an alert",
    description=(
        "Fetches the alert by ID from MongoDB, then uses the AI agent to produce "
        "a FinCEN-compliant SAR narrative with filing type, risk indicators, and "
        "recommended SAR field mappings."
    ),
)
async def generate_sar_narrative(request: SARRequest) -> SARNarrativeResponse:
    try:
        db = _get_db()
        alert = db["alerts"].find_one(
            {"alert_id": request.alert_id},
            {"_id": 0}
        )
        if not alert:
            raise HTTPException(
                status_code=404,
                detail=f"Alert '{request.alert_id}' not found in database."
            )
        return await network_graph_agent.generate_sar(request, alert)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("SAR generation error")
        raise HTTPException(status_code=500, detail=str(e))
