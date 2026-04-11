"""
Router: /analyze/transaction and /analyze/behavior
"""
from fastapi import APIRouter, HTTPException
from schemas import (
    TransactionInput,
    TransactionAnalysisResponse,
    BehaviorInput,
    BehavioralAnalysisResponse,
)
from agents import transaction_analyzer, behavioral_profiler

router = APIRouter(prefix="/analyze", tags=["Analysis"])


@router.post(
    "/transaction",
    response_model=TransactionAnalysisResponse,
    summary="Analyze a single transaction for AML risk",
    description=(
        "Scores the transaction across risk dimensions (FATF jurisdiction, high value, "
        "structuring, crypto channel) and returns an XAI explanation powered by Gemini."
    ),
)
async def analyze_transaction(tx: TransactionInput) -> TransactionAnalysisResponse:
    try:
        return await transaction_analyzer.analyze(tx)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/behavior",
    response_model=BehavioralAnalysisResponse,
    summary="Behavioral deviation analysis for an account",
    description=(
        "Compares recent transactions against the account's 90-day baseline across "
        "amount, frequency, P90 threshold, and counterparty dimensions."
    ),
)
async def analyze_behavior(payload: BehaviorInput) -> BehavioralAnalysisResponse:
    try:
        return await behavioral_profiler.analyze(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
