# Intelligent AML Framework

## What This Is

An AI-powered anti-money-laundering platform for financial operations teams that detects suspicious transaction behavior in near real time and explains why an alert was raised. It combines graph-based pattern detection, behavior anomaly detection, configurable risk scoring, and investigator workflows (alerts, cases, and SAR draft generation). The v1 direction is a hybrid evolution of the existing backend: preserve the current core pipeline and improve precision, explainability, and operational reliability.

## Core Value

Detect suspicious financial activity quickly and explain it clearly enough that analysts can trust and act on alerts.

## Requirements

### Validated

- ✓ Transaction ingestion, schema validation, and normalization pipeline exists (`/api/transactions/ingest`) — existing
- ✓ Event-driven detection pipeline exists (cycle, smurfing, behavioral anomaly) — existing
- ✓ Risk scoring and alert persistence exist with score breakdown and risk tiers — existing
- ✓ Analyst-facing alert query endpoints exist with filtering and pagination — existing
- ✓ Case lifecycle and state transition workflow exists (`OPEN -> ... -> CLOSED_*`) — existing
- ✓ SAR draft generation pipeline exists (queue + Gemini integration + formatter + persistence) — existing
- ✓ Admin threshold config and audit log retrieval endpoints exist — existing
- ✓ Realtime push channel exists for alert and metrics updates via Socket.IO — existing
- ✓ Precision and confidence upgrades shipped (segment-aware thresholds + deterministic confidence) — v1.0
- ✓ Explainability and evidence replay contracts shipped for alert investigation workflows — v1.0
- ✓ Investigation ownership/SLA workflows and oversight controls shipped — v1.0
- ✓ SAR deadline support, quality checks, and confidentiality hardening shipped — v1.0
- ✓ Hybrid deterministic graph-truth boundary and advisory-only AI guardrails shipped — v1.0

### Active

- [ ] Validate operational SLOs in production-like load tests (p95 ingestion-to-alert latency and replay recovery duration)
- [ ] Add analyst feedback loop and false-positive analytics to prioritize precision tuning opportunities
- [ ] Introduce governed typology update workflow and what-if threshold simulation for compliance teams
- [ ] Define v1.1 scope for advanced intelligence requirements (`INT-01` to `INT-05`)

### Out of Scope

- Full autonomous regulatory filing workflow without human review — investigator-in-the-loop remains required
- Complete greenfield rewrite of backend architecture — rejected in favor of hybrid evolution
- Feature-complete UI product redesign in this initialization phase — backend capability and roadmap definition first
- Multi-region/high-availability distributed processing guarantees in initial scope — to be considered after v1 stabilization

## Context

- Existing brownfield backend already implements major AML capability primitives in `backend/src/`
- Detection is event-driven using `EventEmitter`, with in-memory graph/window state plus MongoDB persistence
- Configurable scoring and thresholds are already modeled and admin-manageable via `SystemConfig`
- Test suite includes unit, integration, and property-based tests (Jest + fast-check), with strong domain invariant coverage
- Primary challenge from project brief: static-rule AML systems struggle against evolving laundering behavior; system must detect layered, networked anomalies and explain findings clearly
- Milestone v1.0 (phases 1-7, 17 plans) shipped on 2026-04-10 with archived roadmap/requirements artifacts

## Constraints

- **Architecture**: Hybrid evolution — preserve and extend existing backend modules instead of rewriting from scratch
- **Latency**: Near-real-time operations — ingestion-to-alert pipeline should target under 1 minute
- **Quality Priority**: Precision-first in v1 when precision/recall tradeoffs occur
- **Personas**: Balanced MVP for analyst, investigator, and manager workflows (no single persona-only product)
- **Operational Baseline**: No hard timeline/budget/compliance constraints provided at initialization; use pragmatic defaults

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on existing backend with a hybrid strategy | Substantial AML pipeline already exists and is test-covered | ✓ Implemented across v1.0 |
| Optimize v1 for precision over recall | Analyst trust and actionable alert quality are primary launch drivers | ✓ Implemented with segment-aware thresholds |
| Treat under-1-minute alerting as real-time target | Operationally meaningful SLA for financial monitoring workflows | ⚠ Revisit with production load validation |
| Include all four explainability outputs in v1 (breakdown, path evidence, narrative, SAR context) | Explainability is a central requirement across balanced personas | ✓ Implemented in phases 4 and 7 |
| Use balanced MVP persona strategy | Project needs analyst + investigator + manager utility from first release | ✓ Implemented across investigation and SAR workflows |

## Current State

- Milestone `v1.0` shipped on 2026-04-10.
- Archived artifacts:
	- `.planning/milestones/v1.0-ROADMAP.md`
	- `.planning/milestones/v1.0-REQUIREMENTS.md`
- Active planning files have been reset for next-milestone workflow.

## Next Milestone Goals

1. Define `v1.1` outcome metrics and requirement set.
2. Run milestone audit retro to capture gaps/risks from shipped v1.0.
3. Prioritize advanced intelligence features while preserving deterministic evidence integrity.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after v1.0 milestone completion*
