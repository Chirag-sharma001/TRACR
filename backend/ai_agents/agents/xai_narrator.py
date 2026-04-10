"""
XAI Narrator Agent
Calls Google Gemini to generate human-readable explanations for AML anomalies.
Falls back to a structured template if Gemini is unavailable.
"""
from __future__ import annotations
import logging
from typing import Optional
from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# Lazy import — Gemini SDK is optional
_gemini_model = None


def _get_gemini():
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'replace_with_gemini_key':
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(GEMINI_MODEL)
        logger.info(f"Gemini model loaded: {GEMINI_MODEL}")
        return _gemini_model
    except Exception as e:
        logger.warning(f"Gemini init failed: {e}")
        return None


async def narrate(prompt: str, fallback: str) -> str:
    """Call Gemini with a prompt, fall back gracefully."""
    model = _get_gemini()
    if model is None:
        logger.info("Gemini unavailable — using fallback narrative")
        return fallback

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.3,
                "max_output_tokens": 600,
            }
        )
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini call failed: {e}")
        return fallback


async def explain_transaction(tx_data: dict, risk_score: float, risk_factors: list[str]) -> str:
    """Generate XAI summary for a single transaction."""
    factors_text = "\n".join(f"- {f}" for f in risk_factors)
    prompt = f"""You are a senior AML analyst at a top financial institution.
Explain in 2-3 clear, professional sentences why the following transaction is suspicious.
Focus on the key risk indicators and what a compliance officer should investigate next.

Transaction details:
- Sender: {tx_data.get('sender_account_id', 'Unknown')}
- Receiver: {tx_data.get('receiver_account_id', 'Unknown')}
- Amount: ${tx_data.get('amount_usd', 0):,.2f} {tx_data.get('currency_original', 'USD')}
- Type: {tx_data.get('transaction_type', 'WIRE')}
- Origin→Destination: {tx_data.get('geolocation', {}).get('sender_country', '?')} → {tx_data.get('geolocation', {}).get('receiver_country', '?')}
- Risk Score: {risk_score:.1f}/100

Risk factors identified:
{factors_text}

Response (2-3 sentences, professional AML tone):"""

    fallback = (
        f"This transaction scored {risk_score:.0f}/100 due to: {', '.join(risk_factors[:3])}. "
        f"The amount of ${tx_data.get('amount_usd', 0):,.0f} to {tx_data.get('receiver_account_id', 'unknown')} "
        f"requires immediate review by the compliance team."
    )
    return await narrate(prompt, fallback)


async def explain_graph_anomaly(alert: dict) -> str:
    """Generate narrative for a SMURFING or CIRCULAR_TRADING alert."""
    pattern = alert.get('pattern_type', 'SUSPICIOUS_PATTERN')
    subject = alert.get('subject_account_id', 'Unknown')
    score = alert.get('risk_score', 0)
    involved = alert.get('involved_accounts', [])

    detail_text = ""
    if pattern == 'SMURFING' and alert.get('smurfing_detail'):
        d = alert['smurfing_detail']
        detail_text = (
            f"Transaction count: {d.get('transaction_count')}, "
            f"Aggregate: ${d.get('aggregate_amount', 0):,.0f}, "
            f"Receivers: {d.get('distinct_receiver_count')}, "
            f"Time window: {d.get('time_span_hours', 0):.1f}h"
        )
    elif pattern == 'CIRCULAR_TRADING' and alert.get('cycle_detail'):
        d = alert['cycle_detail']
        detail_text = (
            f"Cycle length: {d.get('cycle_length')} hops, "
            f"FATF flag: {d.get('fatf_flag')}, "
            f"Cycle score: {d.get('cycle_score')}"
        )

    prompt = f"""You are a financial crime analyst. Write a concise 3-sentence SAR-ready narrative explaining this AML alert.

Pattern: {pattern.replace('_', ' ')}
Subject account: {subject}
Risk score: {score}/100
Accounts involved: {', '.join(involved[:6]) or 'N/A'}
{detail_text}

Write the narrative in the third person, as it would appear in a regulatory Suspicious Activity Report.
Response (3 sentences, formal regulatory language):"""

    fallback = (
        f"Account {subject} was flagged for {pattern.replace('_', ' ').lower()} with a risk score of {score}/100. "
        f"The detected pattern involves {len(involved)} accounts and exhibits characteristics consistent with financial layering. "
        f"Immediate investigation and potential SAR filing is recommended."
    )
    return await narrate(prompt, fallback)


async def generate_sar_narrative(alert: dict) -> str:
    """Generate a full SAR narrative from an alert document."""
    pattern = alert.get('pattern_type', 'SUSPICIOUS_ACTIVITY')
    subject = alert.get('subject_account_id', 'Unknown')
    score = alert.get('risk_score', 0)
    tier = alert.get('risk_tier', 'HIGH')

    prompt = f"""You are a Compliance Officer filing a Suspicious Activity Report (SAR) with FinCEN.

Write a formal SAR narrative paragraph (150-200 words) for the following alert.
Include: entity identification, suspicious behavior description, risk indicators, and recommended action.
Use regulatory language appropriate for a US Bank Secrecy Act SAR submission.

Alert Details:
- Pattern: {pattern.replace('_', ' ')}
- Subject Account: {subject}  
- Risk Tier: {tier}
- Risk Score: {score}/100
- Involved Accounts: {', '.join(alert.get('involved_accounts', [])[:5])}

SAR Narrative:"""

    fallback = (
        f"The reporting institution identified suspicious activity by account {subject} consistent with "
        f"{pattern.replace('_', ' ').lower()} behavior. The account received a risk score of {score}/100 "
        f"({tier} tier) based on automated detection of transaction patterns that deviate significantly from "
        f"established norms. The activity involves {len(alert.get('involved_accounts', []))} related accounts "
        f"and presents indicators of potential layering or structuring. This report is submitted in accordance "
        f"with 31 U.S.C. § 5318(g) and applicable Bank Secrecy Act requirements."
    )
    return await narrate(prompt, fallback)
