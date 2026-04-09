# Feature Research

**Domain:** AI-powered AML platform (real-time monitoring + explainable alerts)
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Risk-based alerting across rules + behavior + network patterns | Examiners expect suspicious activity monitoring aligned to institution risk profile, not one static threshold for all customers | MEDIUM | Existing detectors already cover cycle/smurfing/behavior; refine with segment-specific thresholds and periodic tuning evidence |
| End-to-end alert operations workflow (identify -> manage -> decide -> file) | FFIEC emphasizes five interdependent components: alerting, alert management, SAR decisioning, SAR filing, continuing activity handling | MEDIUM | Add explicit workflow states, ownership, due dates, and queue aging metrics to reduce analyst drift |
| Explainable alert packet (reason codes + evidence + score decomposition) | Analysts need defensible context to trust and disposition alerts; weak narratives lower SAR quality and increase rework | MEDIUM | Standardize a per-alert explanation contract: triggers, key transactions, graph path, and numeric contribution breakdown |
| SAR quality and timeliness controls | SAR filing timeliness (30/60-day windows), narrative quality, and complete supporting context are core compliance expectations | MEDIUM | Add filing deadline clocks, narrative completeness checks, and controlled export package with supporting evidence |
| Case lifecycle with documented no-file rationale | Regulators focus on process adequacy; decisions not to file must be documented and reviewable | LOW | Existing case states present; add mandatory reason taxonomy, reviewer sign-off, and reopen criteria |
| Immutable audit trail and SAR confidentiality guardrails | SAR information must be restricted and logged; improper disclosure is a major compliance risk | MEDIUM | Enforce strict access boundaries, per-action audit, and protected views for SAR-sensitive fields |
| Config and model governance (threshold change control) | Monitoring parameters must be explainable, periodically reviewed, and approved by authorized roles | MEDIUM | Existing admin config APIs can be extended with dual-approval, change tickets, and rollback history |
| Manager oversight console (quality + throughput + risk posture) | Board/committee oversight requires aggregate visibility into SAR volume, timeliness, and quality | LOW | Build role-specific dashboards: backlog aging, false-positive rate, high-risk exposure, and SLA breach forecast |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Evidence-first investigator copilot (grounded summaries and next-best actions) | Cuts investigation time while improving consistency by drafting evidence-linked case summaries and suggested follow-ups | HIGH | Must be retrieval-grounded to internal case/alert data; no free-form hallucinated conclusions |
| Typology update engine from advisories (semi-automated) | Rapidly operationalizes new FinCEN/FATF typologies so detection logic evolves faster than manual quarterly rule updates | HIGH | Ingest advisory key terms and red-flag patterns; require analyst approval and shadow testing before activation |
| Alert confidence and uncertainty scoring | Improves analyst trust by distinguishing strong evidence from weak/early signals; reduces overreaction to noisy alerts | MEDIUM | Add confidence bands and data sufficiency indicators (for example, sparse history or weak network context) |
| Investigation graph storyline replay | Speeds complex case understanding by visualizing multi-hop money flow, temporal compression, and role of each entity | MEDIUM | Extend existing graph APIs with timeline playback and suspicious-subgraph annotation exports |
| Analyst feedback learning loop with policy constraints | Reduces false positives over time using disposition outcomes while preserving compliance guardrails | HIGH | Learn from close-as-false-positive patterns under strict governance; never auto-disable mandatory regulatory scenarios |
| Manager what-if simulator for threshold tuning | Lets supervisors evaluate alert volume, precision impact, and workload before publishing new thresholds | MEDIUM | Run shadow scoring on historical data to compare candidate configs; capture approval rationale |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous SAR filing without investigator approval | Promises major productivity gains | Violates investigator-in-the-loop governance and increases legal/compliance risk for incorrect narratives | Keep human approval gate; automate draft quality checks and evidence prefill only |
| Black-box risk model replacing explicit reason codes | Appears more "advanced" and easy to market | Erodes analyst trust, weakens defensibility during exams, and increases challenge rates from investigators | Use hybrid scoring with transparent feature contributions and stable reason taxonomy |
| One global threshold profile for all segments | Simplifies operations | Misses risk-based approach expectations; causes either excessive noise or blind spots by segment | Use segment-aware thresholds with governance and periodic calibration |
| Auto-close low-score alerts at ingest time | Reduces queue volume quickly | Can hide emerging typologies and weak-signal chains that become material later | Route to low-touch queue with sampling QA and delayed correlation checks |
| Continuous online model retraining in production without change control | Suggests rapid adaptation | Creates audit and reproducibility problems; impossible to explain version-to-version behavior | Use scheduled retraining windows, frozen model versions, and approval workflow |

## Feature Dependencies

```
Risk-based alerting
    └──requires──> Segment-aware CDD/EDD context
                       └──requires──> Data quality checks and entity resolution

Explainable alert packet
    └──requires──> Risk score decomposition + evidence extraction
                       └──requires──> Deterministic detector outputs

SAR quality and timeliness controls
    └──requires──> Case lifecycle + documented decisioning
                       └──requires──> Alert operations workflow

Manager oversight console
    └──requires──> Immutable audit trail + workflow telemetry

Analyst feedback learning loop
    └──enhances──> Risk-based alerting

Typology update engine
    └──enhances──> Risk-based alerting

Fully autonomous SAR filing
    └──conflicts──> Investigator approval and accountability controls

Black-box risk model
    └──conflicts──> Explainable alert packet
```

### Dependency Notes

- **Risk-based alerting requires segment-aware CDD/EDD context:** without customer and segment context, thresholds cannot be calibrated proportionally to risk.
- **Explainable alert packet requires deterministic detector outputs:** investigators and auditors must be able to reproduce why an alert was raised.
- **SAR controls require documented case decisioning:** filing timeliness and narrative quality only work if ownership, rationale, and escalation are tracked.
- **Manager oversight requires immutable telemetry:** leadership metrics are not credible without complete workflow and audit evidence.
- **Feedback learning enhances risk-based alerting:** disposition outcomes can reduce false positives, but only under governed update cycles.
- **Typology update engine enhances risk-based alerting:** emerging risks from advisories should enter detection via controlled, testable pattern updates.
- **Autonomous SAR filing conflicts with investigator accountability:** legal accountability remains with financial institution staff.
- **Black-box models conflict with explainability:** opaque scores undermine trust and examination defensibility.

## MVP Definition

### Launch With (v1)

Minimum viable product for trust, efficiency, and oversight on top of existing backend.

- [ ] Explainable alert packet contract (reason codes, score decomposition, evidence links) - core analyst trust primitive
- [ ] Alert operations workflow with explicit ownership, SLA timers, and escalation - core investigator efficiency primitive
- [ ] SAR decision and quality controls (timeliness clock, no-file rationale, narrative checklist) - core compliance primitive
- [ ] Manager oversight console (queue health, quality metrics, filing timeliness, trend slices) - core governance primitive
- [ ] Config governance (approval workflow + change log + rollback) - prevents risky threshold drift

### Add After Validation (v1.x)

- [ ] Investigation graph storyline replay - add once base explainability contract is stable in production
- [ ] What-if threshold simulator - add after baseline telemetry quality is trustworthy
- [ ] Alert confidence/uncertainty scoring - add after detector calibration baseline is established

### Future Consideration (v2+)

- [ ] Evidence-first investigator copilot - defer until data contracts and prompt-grounding controls are mature
- [ ] Typology update engine from advisories - defer until robust shadow-testing and approval loops exist
- [ ] Analyst feedback learning loop - defer until enough labeled dispositions exist and governance is proven

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Explainable alert packet contract | HIGH | MEDIUM | P1 |
| Alert operations workflow + SLA tracking | HIGH | MEDIUM | P1 |
| SAR quality and timeliness controls | HIGH | MEDIUM | P1 |
| Manager oversight console | HIGH | LOW | P1 |
| Config governance with approval trail | HIGH | MEDIUM | P1 |
| Investigation graph storyline replay | MEDIUM | MEDIUM | P2 |
| Threshold what-if simulator | MEDIUM | MEDIUM | P2 |
| Alert confidence/uncertainty scoring | MEDIUM | MEDIUM | P2 |
| Evidence-first investigator copilot | HIGH | HIGH | P3 |
| Typology update engine | HIGH | HIGH | P3 |
| Analyst feedback learning loop | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Traditional Rule-Centric Suites | Modern AML SaaS Platforms | Our Approach |
|---------|--------------------------------|---------------------------|--------------|
| Alert explainability | Often rule text + limited context | Better narratives, mixed evidence quality | Deterministic reason codes + graph and transaction evidence contract |
| Workflow and decisioning | Mature queues but rigid customizations | Flexible workflows, variable governance depth | Role-explicit workflow with SLA control and compliance-focused decision logging |
| Typology agility | Slow update cycles, heavy professional services | Faster cloud updates | Advisory-ingestion with local approval and shadow validation |
| Feedback-driven precision tuning | Mostly manual threshold changes | Some active learning support | Governed feedback loop tied to disposition outcomes and guardrails |
| Management oversight | Strong static reporting | Better near-real-time dashboards | Oversight focused on quality, timeliness, and risk exposure trends |

## Sources

- Internal project context: `.planning/PROJECT.md` (accessed 2026-04-10)
- Internal architecture context: `.planning/codebase/ARCHITECTURE.md` (accessed 2026-04-10)
- Internal requirements baseline: `Docs/requirements.md` and `RAD-Intelligent-AML-Framework.md` (accessed 2026-04-10)
- FFIEC BSA/AML Manual - Suspicious Activity Reporting Overview (accessed 2026-04-10): https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/04
- FinCEN SAR FAQ page and October 2025 SAR FAQs reference (accessed 2026-04-10): https://www.fincen.gov/resources/statutes-regulations/guidance/frequently-asked-questions-regarding-suspicious-activity
- FinCEN SAR Advisory Key Terms (updated March 2026, accessed 2026-04-10): https://www.fincen.gov/resources/suspicious-activity-report-sar-advisory-key-terms
- FATF Recommendations (updated October 2025, accessed 2026-04-10): https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html
- FATF Risk-Based Approach Guidance for the Banking Sector (accessed 2026-04-10): https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Risk-based-approach-banking-sector.html

---
*Feature research for: AI-powered AML platform with explainable alerting*
*Researched: 2026-04-10*