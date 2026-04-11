"""
Transaction Analyzer Agent
Scores individual transactions for AML risk using rule-based heuristics
and enriches with Gemini-powered XAI narrative.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from schemas import (
    TransactionInput,
    TransactionAnalysisResponse,
    RiskFactor,
)
from agents.xai_narrator import explain_transaction

logger = logging.getLogger(__name__)

# FATF high-risk jurisdictions
FATF_HIGH_RISK = {"IR", "KP", "MM", "SY", "YE", "PK", "SO"}
HIGH_RISK_CORRIDORS = {"CYM", "PAN", "VGB", "BHS", "LIE"}
STRUCTURING_THRESHOLD = 10_000
HIGH_VALUE_THRESHOLD = 50_000


def _score_transaction(tx: TransactionInput) -> Tuple[float, List[RiskFactor]]:
    """Heuristic risk scoring — returns (0-100 score, list of RiskFactor)."""
    score = 0.0
    factors: List[RiskFactor] = []

    # 1. High value
    amount = tx.amount_usd or 0.0
    if amount >= HIGH_VALUE_THRESHOLD:
        w = min(0.4, amount / 200_000)
        score += w * 40
        factors.append(RiskFactor(
            factor="HIGH_VALUE_TRANSFER",
            weight=round(w, 2),
            explanation=f"Transfer of ${amount:,.0f} exceeds high-value threshold (${HIGH_VALUE_THRESHOLD:,})"
        ))

    # 2. Structuring — just below CTR threshold
    if 8_000 <= amount < STRUCTURING_THRESHOLD:
        score += 20
        factors.append(RiskFactor(
            factor="POSSIBLE_STRUCTURING",
            weight=0.3,
            explanation=f"Amount of ${amount:,.0f} is suspiciously close to CTR reporting threshold (${STRUCTURING_THRESHOLD:,})"
        ))

    # 3. FATF country
    geo = tx.geolocation or {}
    src = (getattr(geo, 'sender_country', None) or '').upper()
    dst = (getattr(geo, 'receiver_country', None) or '').upper()
    if src in FATF_HIGH_RISK or dst in FATF_HIGH_RISK:
        score += 30
        fatf_country = src if src in FATF_HIGH_RISK else dst
        factors.append(RiskFactor(
            factor="FATF_HIGH_RISK_JURISDICTION",
            weight=0.35,
            explanation=f"Transaction involves FATF-listed high-risk jurisdiction: {fatf_country}"
        ))
    elif src in HIGH_RISK_CORRIDORS or dst in HIGH_RISK_CORRIDORS:
        score += 15
        factors.append(RiskFactor(
            factor="HIGH_RISK_CORRIDOR",
            weight=0.18,
            explanation=f"Transaction routes through known secrecy jurisdiction: {src or dst}"
        ))

    # 4. CRYPTO type is elevated risk
    if tx.transaction_type == "CRYPTO":
        score += 15
        factors.append(RiskFactor(
            factor="CRYPTO_CHANNEL",
            weight=0.2,
            explanation="Cryptocurrency channel carries elevated anonymity and conversion risk"
        ))

    # 5. Cross-border wire
    if src and dst and src != dst and tx.transaction_type == "WIRE":
        score += 10
        factors.append(RiskFactor(
            factor="CROSS_BORDER_WIRE",
            weight=0.12,
            explanation=f"International wire transfer from {src} to {dst}"
        ))

    # Clamp to [0, 100]
    score = min(100.0, max(0.0, score))
    return score, factors


def _tier(score: float) -> str:
    if score >= 70:
        return "HIGH"
    elif score >= 40:
        return "MEDIUM"
    return "LOW"


def _action(score: float, factors: List[RiskFactor]) -> str:
    tier = _tier(score)
    if tier == "HIGH":
        return "Immediately escalate for human review and consider SAR filing within 30 days."
    elif tier == "MEDIUM":
        return "Flag for enhanced due diligence. Monitor subsequent transactions for 30 days."
    return "Log for audit trail. No immediate action required."


async def analyze(tx: TransactionInput) -> TransactionAnalysisResponse:
    """Main entry point — analyze a single transaction."""
    score, factors = _score_transaction(tx)
    tier = _tier(score)
    factor_labels = [f.factor.replace("_", " ").title() for f in factors]

    xai = await explain_transaction(tx.model_dump(), score, factor_labels)
    action = _action(score, factors)

    return TransactionAnalysisResponse(
        transaction_id=tx.transaction_id,
        risk_score=round(score, 1),
        risk_tier=tier,
        risk_factors=factors,
        xai_summary=xai,
        suggested_action=action,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
    )
