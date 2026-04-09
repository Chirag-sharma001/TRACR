# Roadmap: Intelligent AML Framework

## Overview

This roadmap evolves the existing AML backend into a precision-first, explainable, and operationally reliable platform. The sequence starts with governance and observability controls, hardens end-to-end processing durability, improves detector quality, then delivers explainability and investigation workflows before finishing with SAR and security-grade operations.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Governance, Contracts, and Observability** - Establish audit-ready config governance and detection quality telemetry. (completed 2026-04-09)
- [x] **Phase 2: Durable Transaction Processing** - Ensure accepted transactions are processed replay-safely with operational recovery controls. (completed 2026-04-09)
- [x] **Phase 3: Detection Precision and Confidence** - Improve alert quality with segment-aware scoring and confidence signaling. (completed 2026-04-09)
- [ ] **Phase 4: Explainability Interface and Evidence Replay** - Deliver explainable alert evidence and replayable suspicious movement context.
- [ ] **Phase 5: Investigation Workflow Dashboard** - Formalize ownership, SLA escalation, and manager oversight for case handling.
- [ ] **Phase 6: SAR Operations and Security Controls** - Complete SAR decision support with immutable auditability and scoped confidentiality.

## Phase Details

### Phase 1: Governance, Contracts, and Observability
**Goal**: Compliance and admin users can govern detection policy changes and track quality drift with full auditability.
**Depends on**: Nothing (first phase)
**Requirements**: DET-03, GOV-03
**Success Criteria** (what must be TRUE):
  1. Compliance manager can retrieve calibration and drift signals segmented by detector/risk context.
  2. Admin can submit threshold/config changes that require explicit approval before activation.
  3. Admin can roll back a published config change, and the audit trail records requester, approver, and rollback reason.
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md - Implement governance lifecycle contracts with two-person approval and activation gates
- [x] 01-02-PLAN.md - Wire admin submit/approve/activate/rollback endpoints with immutable rollback audit provenance
- [x] 01-03-PLAN.md - Deliver detector/risk/version segmented daily and weekly governance telemetry contracts

### Phase 2: Durable Transaction Processing
**Goal**: Operations can trust that every accepted transaction is processed exactly-once semantically, including replay and recovery scenarios.
**Depends on**: Phase 1
**Requirements**: DET-02
**Success Criteria** (what must be TRUE):
  1. Re-submitting the same accepted transaction does not create duplicate downstream processing or duplicate alerts.
  2. Operators can replay accepted transaction events after failure windows without double-counting outcomes.
  3. Recovery tooling exposes failed items for controlled reprocessing and confirms end-to-end catch-up.
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Implement durable idempotency ledger and failure persistence for replay-safe ingest semantics
- [x] 02-02-PLAN.md - Add operator-triggered bounded replay APIs for failed-item listing and single-item reprocess
- [x] 02-03-PLAN.md - Expose admin durability telemetry for backlog and replay recovery health

### Phase 3: Detection Precision and Confidence
**Goal**: Analysts receive more trustworthy alerts through segment-aware scoring and explicit confidence indicators.
**Depends on**: Phase 2
**Requirements**: DET-01, DET-04
**Success Criteria** (what must be TRUE):
  1. Alert risk tiers reflect customer/account segment context rather than one global threshold behavior.
  2. Each alert includes a confidence indicator that distinguishes stronger from weaker evidence.
  3. Compliance manager can compare precision and drift outcomes before and after threshold updates.
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md - Implement deterministic confidence + segment/pattern/geo-aware threshold policy in scoring contracts
- [x] 03-02-PLAN.md - Expose config-version before/after precision comparison telemetry for governance dashboards

### Phase 4: Explainability Interface and Evidence Replay
**Goal**: Investigators and analysts can inspect why an alert fired through structured decomposition, evidence paths, and timeline replay.
**Depends on**: Phase 3
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):
  1. Analyst can open an alert interface that shows score decomposition across cycle, smurfing, behavioral, and geographic components.
  2. Investigator can inspect linked account/edge path evidence with ordered transaction sequence context.
  3. Investigator can read a narrative rationale grounded in the same evidence packet used for scoring.
  4. Investigator can replay suspicious movement in a timeline view to reconstruct event progression.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Investigation Workflow Dashboard
**Goal**: Investigation operations run with clear ownership, SLA-aware escalation, and manager oversight.
**Depends on**: Phase 4
**Requirements**: WFL-01, WFL-02, WFL-03
**Success Criteria** (what must be TRUE):
  1. Investigator can assign or claim alert ownership and SLA timers start automatically.
  2. Escalation states update when SLA thresholds are crossed, and managers can triage from an oversight dashboard.
  3. Case progression to no-file outcomes requires a mandatory documented rationale.
**Plans**: TBD
**UI hint**: yes

### Phase 6: SAR Operations and Security Controls
**Goal**: SAR decisions are evidence-grounded, deadline-aware, and protected by strict confidentiality and audit controls.
**Depends on**: Phase 5
**Requirements**: SAR-01, SAR-02, SAR-03, GOV-01, GOV-02, GOV-04
**Success Criteria** (what must be TRUE):
  1. Investigator can generate SAR drafts directly grounded in linked alert and case evidence.
  2. Compliance team can identify SAR windows that are upcoming, at risk, or breached.
  3. Investigator can run SAR narrative quality and completeness checks before filing decisions.
  4. Audit/compliance users can retrieve immutable logs of sensitive SAR and case decision actions.
  5. Only authorized roles from approved origins and channel scopes can access SAR-sensitive data and realtime subscriptions.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 1.2 -> 2 -> 2.1 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Governance, Contracts, and Observability | 3/3 | Complete    | 2026-04-09 |
| 2. Durable Transaction Processing | 3/3 | Complete    | 2026-04-09 |
| 3. Detection Precision and Confidence | 2/2 | Complete    | 2026-04-09 |
| 4. Explainability Interface and Evidence Replay | 0/TBD | Not started | - |
| 5. Investigation Workflow Dashboard | 0/TBD | Not started | - |
| 6. SAR Operations and Security Controls | 0/TBD | Not started | - |

### Phase 7: For your AML problem, the best approach is not “agentic AI vs DFS.” It should be a hybrid system: DFS/graph algorithms for exact pattern detection, and AI/agentic AI for prioritization, explanation, investigation support, and SAR drafting. Graph analytics is especially strong for AML because money laundering is fundamentally a network problem, while explainable AI is important because AML teams need clear, auditable reasons for alerts.

Best split of responsibilities
Use DFS for things that must be exact:

Circular fund flows.

Short transaction loops.

Time-bounded path search.

Deterministic evidence for investigators.

Use AI / agentic AI for things that are softer and broader:

Behavioral anomaly scoring.

Alert ranking.

Case summarization.

SAR drafting.

Investigator workflow automation

**Goal:** Analysts and investigators operate on a governed hybrid boundary where DFS-confirmed graph evidence remains deterministic truth and AI remains assistive, explainable, and reviewable.
**Requirements**: PH7-HYBRID-BOUNDARY, PH7-XAI-PACKET, PH7-AI-GUARDRAILS
**Depends on:** Phase 6
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md - Enforce deterministic graph-truth boundary with candidate-vs-confirmed policy and evidence invariants
- [x] 07-02-PLAN.md - Implement canonical explainability packet contract (evidence, decomposition, narrative mapping, confidence)
- [x] 07-03-PLAN.md - Enforce advisory-only AI guardrails and human-decision gates for case/SAR actions
