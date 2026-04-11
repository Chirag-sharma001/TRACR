"""
Router: /graph/anomaly-explain
"""
from fastapi import APIRouter, HTTPException
from schemas import GraphAnomaly, GraphExplanationResponse
from agents import network_graph_agent

router = APIRouter(prefix="/graph", tags=["Graph Analysis"])


@router.post(
    "/anomaly-explain",
    response_model=GraphExplanationResponse,
    summary="Explain a graph-based anomaly alert",
    description=(
        "Accepts a SMURFING or CIRCULAR_TRADING alert document and returns a "
        "structured XAI explanation with key indicators, FATF typology match, "
        "confidence score, and recommended compliance action."
    ),
)
async def explain_graph_anomaly(body: GraphAnomaly) -> GraphExplanationResponse:
    try:
        return await network_graph_agent.explain(body.alert)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
