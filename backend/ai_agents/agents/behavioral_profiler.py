"""
Behavioral Profiler Agent
Compares recent transactions against the account's historical baseline
to detect statistical deviations across key behavioral dimensions.
"""
from __future__ import annotations
import logging
import statistics
from typing import Any, Dict, List

from schemas import (
    BehaviorInput,
    BehaviorInput as BehaviourInput,
    BehavioralAnalysisResponse,
    BehavioralDeviationItem,
)
from agents.xai_narrator import narrate

logger = logging.getLogger(__name__)


def _safe_mean(values: list) -> float:
    return statistics.mean(values) if values else 0.0


def _pct_deviation(baseline: float, observed: float) -> float:
    if baseline == 0:
        return 100.0 if observed > 0 else 0.0
    return round(((observed - baseline) / abs(baseline)) * 100, 1)


def _severity(pct: float) -> str:
    if abs(pct) >= 100:
        return "HIGH"
    elif abs(pct) >= 40:
        return "MEDIUM"
    return "LOW"


async def analyze(payload: BehaviorInput) -> BehavioralAnalysisResponse:
    """Detect behavioral deviations in an account's recent transactions."""
    account_id = payload.account_id
    transactions = payload.transactions or []
    baseline = payload.baseline or {}

    # ── Extract observed metrics ─────────────────────────────────────────
    amounts = [tx.amount_usd for tx in transactions if tx.amount_usd]
    obs_amount_mean = _safe_mean(amounts)
    obs_count = len(transactions)

    # Daily frequency: assume transactions span 7 days unless provided
    obs_daily_freq = obs_count / 7.0

    # Distinct counterparties
    counterparties = set()
    for tx in transactions:
        counterparties.add(tx.receiver_account_id)
        counterparties.add(tx.sender_account_id)
    counterparties.discard(account_id)
    known = set(baseline.get("known_counterparties", []))
    new_counterparties = counterparties - known

    # ── Compare against baseline ─────────────────────────────────────────
    bl_amount_mean = baseline.get("amount_mean", 0) or 0
    bl_daily_freq = baseline.get("daily_freq_mean", 0) or 0
    bl_amount_p90 = baseline.get("amount_p90", 0) or 0

    deviations: List[BehavioralDeviationItem] = []

    # Amount mean deviation
    if bl_amount_mean > 0:
        pct = _pct_deviation(bl_amount_mean, obs_amount_mean)
        deviations.append(BehavioralDeviationItem(
            dimension="Average Transaction Amount",
            baseline_value=bl_amount_mean,
            observed_value=round(obs_amount_mean, 2),
            deviation_pct=pct,
            severity=_severity(pct),
        ))

    # Frequency deviation
    if bl_daily_freq > 0:
        pct = _pct_deviation(bl_daily_freq, obs_daily_freq)
        deviations.append(BehavioralDeviationItem(
            dimension="Daily Transaction Frequency",
            baseline_value=bl_daily_freq,
            observed_value=round(obs_daily_freq, 2),
            deviation_pct=pct,
            severity=_severity(pct),
        ))

    # P90 exceedance
    if bl_amount_p90 > 0 and amounts:
        above_p90 = sum(1 for a in amounts if a > bl_amount_p90)
        if above_p90:
            pct = _pct_deviation(0, above_p90)  # any above-p90 tx is anomalous
            deviations.append(BehavioralDeviationItem(
                dimension="Transactions Exceeding P90 Threshold",
                baseline_value=0,
                observed_value=float(above_p90),
                deviation_pct=100.0,
                severity="HIGH",
            ))

    # New counterparties
    if new_counterparties:
        deviations.append(BehavioralDeviationItem(
            dimension="New Counterparties",
            baseline_value=0,
            observed_value=float(len(new_counterparties)),
            deviation_pct=100.0,
            severity="MEDIUM" if len(new_counterparties) <= 2 else "HIGH",
        ))

    # ── Overall risk score ────────────────────────────────────────────────
    high_count = sum(1 for d in deviations if d.severity == "HIGH")
    med_count = sum(1 for d in deviations if d.severity == "MEDIUM")
    overall_risk = min(100.0, high_count * 30 + med_count * 15)
    is_anomalous = overall_risk >= 30

    # ── Behavioral signature ──────────────────────────────────────────────
    if not deviations:
        signature = "Normal — within baseline parameters"
    elif high_count >= 2:
        signature = "Highly Anomalous — multi-dimension breach"
    elif high_count == 1:
        signature = "Anomalous — single high-severity deviation"
    else:
        signature = "Slightly Elevated — moderate behavioral drift"

    # ── XAI narrative via Gemini ─────────────────────────────────────────
    deviation_text = "\n".join(
        f"- {d.dimension}: baseline={d.baseline_value}, observed={d.observed_value} ({d.deviation_pct:+.1f}%, {d.severity})"
        for d in deviations
    )
    prompt = f"""You are an AML behavioral analyst. Write 2-3 sentences explaining why account {account_id}
shows anomalous behavior based on these deviations from its 90-day baseline:

{deviation_text or 'No significant deviations detected.'}

Overall risk score: {overall_risk:.0f}/100
Signature: {signature}

Response (professional, clear, 2-3 sentences):"""

    fallback = f"Account {account_id} shows {signature.lower()} with {len(deviations)} deviations detected. " \
               f"Risk score: {overall_risk:.0f}/100. {'Enhanced monitoring is recommended.' if is_anomalous else 'No immediate action required.'}"

    narrative = await narrate(prompt, fallback)

    action = "Initiate Source of Wealth review and request additional KYC documentation." if overall_risk >= 70 \
        else "Apply Enhanced Due Diligence and monitor for 30 days." if overall_risk >= 40 \
        else "No immediate action — log for quarterly audit review."

    return BehavioralAnalysisResponse(
        account_id=account_id,
        is_anomalous=is_anomalous,
        overall_risk_score=round(overall_risk, 1),
        deviations=deviations,
        behavioral_signature=signature,
        xai_narrative=narrative,
        suggested_action=action,
    )
