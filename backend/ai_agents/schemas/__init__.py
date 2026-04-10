"""Pydantic schemas for TRACR AI Agents API"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ── Common ──────────────────────────────────────────────────────────────

class GeoLocation(BaseModel):
    sender_country: Optional[str] = None
    receiver_country: Optional[str] = None


# ── Transaction Schemas ──────────────────────────────────────────────────

class TransactionInput(BaseModel):
    transaction_id: Optional[str] = None
    sender_account_id: str
    receiver_account_id: str
    amount_usd: float
    currency_original: Optional[str] = "USD"
    transaction_type: Optional[str] = "WIRE"
    geolocation: Optional[GeoLocation] = None
    channel: Optional[str] = None
    timestamp: Optional[str] = None

    model_config = {"extra": "allow"}


class RiskFactor(BaseModel):
    factor: str
    weight: float = Field(ge=0.0, le=1.0)
    explanation: str


class TransactionAnalysisResponse(BaseModel):
    transaction_id: Optional[str]
    risk_score: float = Field(ge=0, le=100)
    risk_tier: str  # LOW / MEDIUM / HIGH
    risk_factors: List[RiskFactor]
    xai_summary: str
    suggested_action: str
    analyzed_at: str


# ── Behavioral Schemas ───────────────────────────────────────────────────

class BehaviorInput(BaseModel):
    account_id: str
    transactions: List[TransactionInput] = Field(default_factory=list)
    baseline: Optional[Dict[str, Any]] = None


class BehavioralDeviationItem(BaseModel):
    dimension: str
    baseline_value: float
    observed_value: float
    deviation_pct: float
    severity: str  # LOW / MEDIUM / HIGH


class BehavioralAnalysisResponse(BaseModel):
    account_id: str
    is_anomalous: bool
    overall_risk_score: float
    deviations: List[BehavioralDeviationItem]
    behavioral_signature: str
    xai_narrative: str
    suggested_action: str


# ── Graph / Alert Schemas ────────────────────────────────────────────────

class AlertInput(BaseModel):
    alert_id: Optional[str] = None
    pattern_type: str  # SMURFING / CIRCULAR_TRADING / BEHAVIORAL_ANOMALY
    subject_account_id: str
    involved_accounts: Optional[List[str]] = None
    risk_score: Optional[float] = None
    risk_tier: Optional[str] = None
    smurfing_detail: Optional[Dict[str, Any]] = None
    cycle_detail: Optional[Dict[str, Any]] = None
    behavioral_detail: Optional[Dict[str, Any]] = None

    model_config = {"extra": "allow"}


class GraphAnomaly(BaseModel):
    alert: AlertInput


class GraphExplanationResponse(BaseModel):
    alert_id: Optional[str]
    pattern_type: str
    narrative: str
    key_indicators: List[str]
    typology_match: str
    confidence: float
    recommended_action: str


# ── SAR Schemas ──────────────────────────────────────────────────────────

class SARRequest(BaseModel):
    alert_id: str


class SARNarrativeResponse(BaseModel):
    alert_id: str
    sar_narrative: str
    filing_type: str
    risk_indicators: List[str]
    recommended_fields: Dict[str, str]
    generated_at: str
