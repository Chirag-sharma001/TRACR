"""
Network Graph Agent
Generates XAI explanations for detected graph-based anomalies
(SMURFING, CIRCULAR_TRADING). Optionally pulls alert data from MongoDB.
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from schemas import (
    AlertInput,
    GraphExplanationResponse,
    SARRequest,
    SARNarrativeResponse,
)
from agents.xai_narrator import explain_graph_anomaly, generate_sar_narrative

logger = logging.getLogger(__name__)

FATF_COUNTRIES = {"IR", "KP", "MM", "SY", "YE", "PK"}


def _get_key_indicators(alert: dict) -> List[str]:
    indicators = []
    pattern = alert.get("pattern_type", "")

    if pattern == "SMURFING":
        d = alert.get("smurfing_detail") or {}
        if d.get("transaction_count", 0) >= 6:
            indicators.append(f"High transaction count: {d.get('transaction_count')} transactions in {d.get('time_span_hours', 0):.1f}h window")
        if d.get("aggregate_amount", 0) > 0:
            indicators.append(f"Aggregate amount: ${d.get('aggregate_amount', 0):,.0f} (below CTR threshold per transaction)")
        if d.get("distinct_receiver_count", 0) >= 3:
            indicators.append(f"Coordinated dispersal to {d.get('distinct_receiver_count')} distinct receivers")
        if d.get("coordinated_multiplier_applied"):
            indicators.append("Coordinated smurfing multiplier triggered (≥3 receivers)")

    elif pattern == "CIRCULAR_TRADING":
        d = alert.get("cycle_detail") or {}
        if d.get("cycle_length"):
            indicators.append(f"{d['cycle_length']}-hop circular transaction chain detected")
        if d.get("fatf_flag"):
            indicators.append("FATF high-risk jurisdiction involved in the cycle")
        if d.get("cycle_score", 0) >= 80:
            indicators.append(f"High cycle score: {d.get('cycle_score')}/100 — strong layering signal")
        seq = d.get("transaction_sequence", [])
        if seq:
            total = sum(s.get("amount", 0) for s in seq)
            indicators.append(f"Total funds cycled: ${total:,.0f}")

    elif pattern == "BEHAVIORAL_ANOMALY":
        d = alert.get("behavioral_detail") or {}
        for anomaly in (d.get("anomalies") or []):
            t = anomaly.get("anomalyType", "")
            if t == "HIGH_VALUE_NEW_COUNTERPARTY":
                indicators.append(
                    f"Transaction of ${anomaly.get('observedValue', 0):,.0f} to unknown counterparty "
                    f"(P90 baseline: ${anomaly.get('baselineP90', 0):,.0f})"
                )
            else:
                indicators.append(t.replace("_", " ").title())

    if not indicators:
        indicators.append(f"Risk score: {alert.get('risk_score', 0)}/100 ({alert.get('risk_tier', 'UNKNOWN')} tier)")

    return indicators


def _typology_match(alert: dict) -> str:
    """Map the alert to FATF/FinCEN typology language."""
    pattern = alert.get("pattern_type", "")
    d = alert.get("cycle_detail") or {}
    smurfing_d = alert.get("smurfing_detail") or {}

    if pattern == "CIRCULAR_TRADING":
        if d.get("fatf_flag"):
            return "FATF Typology: Trade-Based Money Laundering (TBML) with Offshore Jurisdiction Routing"
        return "FATF Typology: Layering via Circular Fund Movement (FinCEN Advisory FIN-2014-A007)"
    elif pattern == "SMURFING":
        if smurfing_d.get("coordinated_multiplier_applied"):
            return "FinCEN Typology: Coordinated Structuring Scheme (31 U.S.C. § 5324)"
        return "FinCEN Typology: Currency Transaction Structuring / Smurfing (BSA §5324)"
    elif pattern == "BEHAVIORAL_ANOMALY":
        return "FinCEN Advisory FIN-2019-A003: Behavioral Anomaly Consistent with Layering"
    return "General AML Pattern: Suspicious Activity requiring investigation"


def _confidence(alert: dict) -> float:
    score = alert.get("risk_score", 50.0) or 50.0
    return round(min(1.0, score / 100.0), 2)


def _recommended_action(alert: dict) -> str:
    tier = (alert.get("risk_tier") or "LOW").upper()
    if tier == "HIGH":
        return "File SAR within 30 days. Immediately freeze suspicious account pending AML investigation. Escalate to Compliance Officer."
    elif tier == "MEDIUM":
        return "Initiate Enhanced Due Diligence (EDD). Request Source of Funds documentation. Monitor for 60 days."
    return "Log for audit trail. Apply standard due diligence monitoring."


async def explain(alert_data: AlertInput) -> GraphExplanationResponse:
    """Generate explanation for a SMURFING or CIRCULAR_TRADING alert."""
    alert_dict = alert_data.model_dump()
    narrative = await explain_graph_anomaly(alert_dict)
    indicators = _get_key_indicators(alert_dict)
    typology = _typology_match(alert_dict)
    confidence = _confidence(alert_dict)
    action = _recommended_action(alert_dict)

    return GraphExplanationResponse(
        alert_id=alert_data.alert_id,
        pattern_type=alert_data.pattern_type,
        narrative=narrative,
        key_indicators=indicators,
        typology_match=typology,
        confidence=confidence,
        recommended_action=action,
    )


async def generate_sar(request: SARRequest, alert: dict) -> SARNarrativeResponse:
    """Generate SAR narrative and filing metadata from an alert document."""
    res = await generate_sar_narrative(alert)
    narrative = res["text"]
    agent_name = res["agent_name"]

    # Determine filing type
    pattern = alert.get("pattern_type", "")
    filing_type = "CTR" if pattern == "SMURFING" else "SAR"

    indicators = _get_key_indicators(alert)

    # Standard FinCEN SAR fields
    recommended_fields = {
        "Part I (Financial Institution)": "Reporting financial institution name and contact",
        "Part II (Suspicious Activity)": f"{pattern.replace('_', ' ').title()} — detected by automated AML engine",
        "Part III (Subject Information)": alert.get("subject_account_id", ""),
        "Part IV (Suspicious Activity Description)": narrative[:200] + "…",
        "Item 29 (Amount)": f"${sum(t.get('amount', 0) for t in ((alert.get('cycle_detail') or {}).get('transaction_sequence') or [])):,.0f}" if pattern == "CIRCULAR_TRADING" else "See smurfing_detail.aggregate_amount",
        "Item 35 (Activity)": "Structuring / Layering / Unusual EFT Activity",
        "Investigator Agent": agent_name
    }

    return SARNarrativeResponse(
        alert_id=request.alert_id,
        sar_narrative=narrative,
        filing_type=filing_type,
        risk_indicators=indicators,
        recommended_fields=recommended_fields,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
