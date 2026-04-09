# Requirements: Intelligent AML Framework

**Defined:** 2026-04-09
**Core Value:** Detect suspicious financial activity quickly and explain it clearly enough that analysts can trust and act on alerts.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Detection Quality

- [ ] **DET-01**: Analyst receives alerts scored with segment-aware risk thresholds aligned to customer/account risk context
- [ ] **DET-02**: Operations team can rely on ingest-to-detection durability so every accepted transaction is processed exactly-once semantically (idempotent replay-safe behavior)
- [ ] **DET-03**: Compliance manager can review precision/drift calibration signals for detection quality governance
- [ ] **DET-04**: Analyst can see a confidence indicator on each alert to distinguish strong vs weak evidence

### Explainability

- [x] **EXP-01**: Analyst can view per-alert score decomposition across cycle, smurfing, behavioral, and geographic components
- [x] **EXP-02**: Investigator can view transaction-path evidence (accounts, edges, sequence/timeline) supporting each alert
- [x] **EXP-03**: Investigator can view a narrative rationale summarizing why the alert was triggered
- [x] **EXP-04**: Investigator can replay suspicious movement using a graph storyline/timeline view

### Investigation Workflow

- [ ] **WFL-01**: Investigator can assign alert ownership with SLA timers and escalation states
- [ ] **WFL-02**: Investigator can progress case states with mandatory documented no-file rationale when SAR is not filed
- [ ] **WFL-03**: Manager can monitor backlog, quality, and timeliness through an oversight dashboard

### SAR Operations

- [ ] **SAR-01**: Investigator can generate SAR drafts that are grounded in alert and case evidence
- [ ] **SAR-02**: Compliance team can track SAR timeliness windows and identify imminent or breached deadlines
- [ ] **SAR-03**: Investigator can run narrative quality/completeness checks before SAR filing decisions

### Security & Governance

- [ ] **GOV-01**: Compliance/audit users can retrieve immutable logs of sensitive actions and decision changes
- [ ] **GOV-02**: Authorized roles can access SAR-sensitive data with least-privilege confidentiality controls enforced
- [ ] **GOV-03**: Admin users can submit threshold/config changes through an approval and rollback-auditable workflow
- [ ] **GOV-04**: Realtime consumers can only subscribe from approved origins and authorized channel scopes

### Hybrid Boundary Controls

- [ ] **PH7-HYBRID-BOUNDARY**: Exact graph typology truth claims require deterministic DFS/graph confirmation, while AI-only detections remain candidate signals until confirmed
- [ ] **PH7-XAI-PACKET**: Every alert exposes a stable explainability packet with deterministic evidence context (when applicable), score decomposition, evidence-bound narrative rationale, and confidence level
- [ ] **PH7-AI-GUARDRAILS**: AI outputs are advisory-only with mandatory human decision gates for regulated actions, and all AI-generated investigation/SAR content is traceable to source evidence

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Intelligence

- **INT-01**: Compliance team can update detection typologies from advisories through a controlled update workflow
- **INT-02**: Manager can run what-if threshold simulations against historical data before publishing changes
- **INT-03**: Compliance team can manage continuing-activity SAR workflows for recurring suspicious activity
- **INT-04**: System can incorporate governed analyst-feedback learning loops to reduce false positives over time
- **INT-05**: Investigator can use an evidence-grounded copilot assistant for case summarization and next-action support

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fully autonomous SAR filing without human approval | Violates investigator-in-the-loop accountability and increases legal/compliance risk |
| Black-box risk model without explainable evidence | Undermines analyst trust and examination defensibility |
| Full greenfield backend rewrite | Hybrid evolution of existing backend chosen as explicit project decision |
| Multi-region HA guarantees in initial release | Deferred until post-v1 stabilization and capacity validation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DET-01 | Phase 3 | Pending |
| DET-02 | Phase 2 | Planned |
| DET-03 | Phase 1 | Planned |
| DET-04 | Phase 3 | Pending |
| EXP-01 | Phase 4 | Completed (2026-04-10) |
| EXP-02 | Phase 4 | Completed (2026-04-10) |
| EXP-03 | Phase 4 | Completed (2026-04-10) |
| EXP-04 | Phase 4 | Completed (2026-04-10) |
| WFL-01 | Phase 5 | Pending |
| WFL-02 | Phase 5 | Pending |
| WFL-03 | Phase 5 | Pending |
| SAR-01 | Phase 6 | Pending |
| SAR-02 | Phase 6 | Pending |
| SAR-03 | Phase 6 | Pending |
| GOV-01 | Phase 6 | Pending |
| GOV-02 | Phase 6 | Pending |
| GOV-03 | Phase 1 | Planned |
| GOV-04 | Phase 6 | Pending |
| PH7-HYBRID-BOUNDARY | Phase 7 | Pending |
| PH7-XAI-PACKET | Phase 7 | Pending |
| PH7-AI-GUARDRAILS | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-10 after Phase 04 execution and verification*
