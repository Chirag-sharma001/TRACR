# Pitfalls Research

**Domain:** Intelligent AML detection platform (brownfield, real-time + explainable + SAR operations)
**Researched:** 2026-04-10
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Alert Volume Optimization Instead of Detection Quality

**What goes wrong:**
Teams optimize for more alerts or faster alert generation, but precision drops and investigators lose trust. The system technically "detects" more but operationally catches less meaningful activity.

**Why it happens:**
Thresholds and detector parameters are tuned without a precision floor, segmented baselines, or analyst feedback loops.

**How to avoid:**
Define quality gates before tuning: precision floor, false positive budget, and disposition-based scorecards by risk segment. Run threshold changes as controlled experiments with rollback criteria.

**Warning signs:**
- Alert volume rises while escalation-to-case ratio falls.
- Investigator dispositions cluster in low-value reasons ("insufficient context", "expected behavior").
- Same customers repeatedly alert without material SAR outcomes.

**Phase to address:**
Phase C - Detection quality and state correctness.

---

### Pitfall 2: Fragile Event Delivery Between Ingestion and Detection

**What goes wrong:**
Transactions are persisted but some detection executions are skipped, duplicated, or processed out of intended order during restarts or traffic bursts.

**Why it happens:**
In-process eventing is treated like durable messaging, with no outbox, idempotency keys, replay workflow, or dead-letter strategy.

**How to avoid:**
Adopt transactional outbox + relay + idempotent consumers. Track event lifecycle states (written, relayed, consumed, persisted) and ship replay tooling before scale tests.

**Warning signs:**
- Daily mismatch between transaction count and processed-detection count.
- Detection gaps after deploys or process restarts.
- Duplicate alerts for same transaction/evidence tuple.

**Phase to address:**
Phase B - Durable eventing and idempotency backbone.

---

### Pitfall 3: Single-Process Detector State Assumptions

**What goes wrong:**
Graph and behavioral windows reset on restart or diverge across instances, causing inconsistent findings and non-repeatable alerts.

**Why it happens:**
Detector state remains process-local and mutable without checkpointing, deterministic rehydration, or partition ownership rules.

**How to avoid:**
Persist detector checkpoints, define state ownership keys, and validate replay determinism in integration tests. Treat in-memory caches as acceleration only, never as source of truth.

**Warning signs:**
- Alert behavior changes materially after restart without code or config changes.
- Horizontal scaling changes detection output shape.
- Incident reviews cannot reproduce prior alerts from same data.

**Phase to address:**
Phase C - Detection quality and state correctness.

---

### Pitfall 4: Explainability Added After Scoring Instead of Designed In

**What goes wrong:**
Alerts expose risk scores but cannot show stable reasons, evidence paths, or transaction-level contributions that investigators can defend.

**Why it happens:**
Explainability is treated as UI narrative generation rather than a first-class detection output contract.

**How to avoid:**
Create an explainability envelope schema (reason codes, evidence path, contributing transactions, feature contributions) and make it mandatory for every alert before release.

**Warning signs:**
- Analysts escalate "unknown reason" or "black-box" decisions.
- Same alert scenario yields different rationale text across runs.
- SAR narrative preparation requires manual reconstruction from raw data.

**Phase to address:**
Phase D - Explainability contract and evidence model hardening.

---

### Pitfall 5: No Independent Challenge of Detection and AI Models

**What goes wrong:**
Models pass internal checks but fail under drift, edge cases, or supervisory review because assumptions, limitations, and validation evidence are weak.

**Why it happens:**
The same team develops, approves, and monitors models; no independent validation cadence, model inventory discipline, or documented limitation controls.

**How to avoid:**
Implement model governance from day one: inventory, ownership, intended-use statement, independent validation, outcomes analysis, periodic review, and explicit compensating controls for known limitations.

**Warning signs:**
- Missing model cards/validation artifacts for active detectors.
- No benchmark/challenger comparisons during major threshold changes.
- Drift detected only after investigators complain.

**Phase to address:**
Phase A - Governance, contracts, and observability foundation.

---

### Pitfall 6: SAR Workflow Decoupled from Alert and Case Reality

**What goes wrong:**
SAR drafts are generated, but filing decisions, continuing activity reviews, and timelines are not operationally enforced; teams either over-file noise or miss required filings.

**Why it happens:**
SAR is implemented as an isolated generation feature instead of a controlled workflow integrated with alert disposition, legal review, and decision documentation.

**How to avoid:**
Implement SAR state machine with deadlines and controls: initial detection timestamp policy, 30/60-day filing timers, continuing activity review reminders, not-filed rationale capture, and board/legal escalation hooks.

**Warning signs:**
- Overdue SAR tasks and unclear ownership of filing decisions.
- Repeat suspicious activity without linked continuing-review events.
- High variance in SAR quality across analysts for similar typologies.

**Phase to address:**
Phase F - SAR operations and compliance assurance.

---

### Pitfall 7: SAR Confidentiality and Tipping-Off Violations via Engineering Paths

**What goes wrong:**
Sensitive SAR existence/details leak through logs, notifications, broad role access, or support tooling, creating regulatory and legal exposure.

**Why it happens:**
Confidentiality rules are known at policy level but not encoded into access control, log redaction, or event payload design.

**How to avoid:**
Tag SAR-linked fields as restricted data class, enforce least-privilege access paths, redact by default in logs/events, and add automated tests that fail on forbidden field exposure.

**Warning signs:**
- SAR references visible in generic ops logs or websocket payloads.
- Non-authorized roles can view SAR narratives or status details.
- Incident response discovers copied SAR content in external tickets.

**Phase to address:**
Phase E - Security and access control hardening.

---

### Pitfall 8: Retry and Queue Semantics That Amplify Failure

**What goes wrong:**
Transient and permanent failures are retried identically, producing queue storms, duplicated work, and hidden dead letters.

**Why it happens:**
Retry strategy is implemented as blanket retries with no error taxonomy, idempotency guardrails, or backoff/dead-letter policy.

**How to avoid:**
Classify failures (transient, external dependency, deterministic validation, policy) and assign retry budgets per class. Add poison-message detection, DLQ triage runbooks, and replay controls.

**Warning signs:**
- Repeated failures on same payload hash.
- Queue depth grows while throughput appears normal.
- Alert latency spikes after third-party outages.

**Phase to address:**
Phase B - Durable eventing and idempotency backbone.

---

### Pitfall 9: Weak Data Scope Controls in Alert and Case APIs

**What goes wrong:**
Authenticated users can access broader alert/case datasets than intended, creating internal data leakage and governance failures.

**Why it happens:**
Authentication is implemented, but authorization scope checks (tenant, role, ownership, purpose) are incomplete or inconsistent across endpoints.

**How to avoid:**
Enforce policy-as-code authorization at query construction layer and test with abuse scenarios (cross-scope reads, elevation attempts, websocket channel leakage).

**Warning signs:**
- API responses include records outside investigator assignment.
- Access logic differs between REST queries and realtime updates.
- Security testing finds horizontal privilege escalation paths.

**Phase to address:**
Phase E - Security and access control hardening.

---

### Pitfall 10: Missing End-to-End Operational Telemetry

**What goes wrong:**
Teams cannot prove SLA attainment or diagnose failures quickly because ingestion, detection, explainability, and SAR metrics are fragmented.

**Why it happens:**
Observability is left until late phases; no correlation IDs, SLO dashboards, queue lag metrics, or detector-level quality telemetry.

**How to avoid:**
Ship observability first: trace IDs across all stages, latency SLOs, quality KPIs (precision proxies, analyst outcomes), queue health metrics, and incident playbooks.

**Warning signs:**
- Unknown root cause for under-1-minute SLA misses.
- Time-to-diagnose incidents exceeds one business day.
- Phase sign-off uses anecdotal evidence instead of telemetry.

**Phase to address:**
Phase A - Governance, contracts, and observability foundation.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping in-process EventEmitter as primary transport | Fast implementation | Event loss/duplication risk, weak replayability, brittle scale-out | Only as temporary bridge while outbox is being implemented |
| Global thresholds with no segmenting | Simple tuning | Alert fatigue, precision collapse in high-variance customer cohorts | Never in production AML monitoring |
| Storing detector truth in memory only | Low latency | Non-deterministic behavior on restarts and multi-instance runs | Only for cache layers with persisted source of truth |
| SAR generation without workflow controls | Faster demo output | Regulatory timeline misses and inconsistent filing decisions | Never beyond prototype |
| Broad retry-on-error logic | Fewer immediate failures | Retry storms and hidden deterministic failures | Only with tight retry budget and DLQ visibility |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MongoDB change streams/outbox relay | Assuming stream semantics without replica set and resume-token handling | Use transactional outbox as source of truth and validate replay from persisted events |
| LLM provider for SAR drafting | Blocking request path on model call | Run SAR generation asynchronously with timeout, circuit breaker, and deterministic fallback templates |
| Realtime websocket fanout | Running multi-node without adapter and channel authorization checks | Use Redis adapter, enforce channel scoping, and test failover behavior |
| FinCEN-facing SAR process | Treating SAR as one-time form generation | Implement complete lifecycle: decision, filing deadline, continuing review, retention, confidentiality controls |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full graph/window scans on hot path | p95 ingestion latency drifts up with transaction volume | Incremental state maintenance and background compaction | During burst traffic and larger graph cardinality |
| Recomputing baseline/profile multiple times per event | Elevated DB/CPU without detection quality gain | Single ownership of baseline update per transaction event | As throughput increases and detector mix expands |
| Pull-heavy realtime metrics every few seconds | DB pressure and stale dashboards | Cache short windows, sample adaptively, and back off under load | As dashboard consumers or alert volume grows |
| Synchronous explainability enrichment | Spiky API latency | Split synchronous minimum evidence from async deep enrichment | During investigator peak usage |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing SAR existence/details in logs or broad notifications | Regulatory breach, legal exposure, investigation compromise | Classified-field handling, redaction defaults, strict access paths, continuous leak tests |
| Missing brute-force/rate controls on auth and privileged endpoints | Account takeover, policy abuse | Add per-IP and per-account throttling, lockout policy, and anomaly alerts |
| Allowing permissive websocket origins/channels | Unauthorized stream access to operationally sensitive data | Explicit allowlist CORS, token-bound channel auth, origin checks |
| Relying only on authentication for alert/case data access | Internal overexposure of suspicious activity data | Enforce row-level authorization and purpose-bound data retrieval |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing a score without reasons/evidence | Analysts cannot trust or defend decisions | Show reason codes, evidence graph/path, and top contributing transactions |
| Mixing regulatory and investigative language inconsistently | Confusing handoff between analyst, investigator, and manager | Role-specific views built from one canonical evidence contract |
| Queue-heavy workflows without explicit SLA clocks | Tasks silently age out and compliance risk rises | Display deadline clocks, ownership, and escalation states in every workflow step |
| No visible disposition feedback loop | Teams cannot improve detector quality | Capture structured disposition reasons and feed threshold tuning cycle |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Real-time detection:** Often missing durable replay and idempotency guarantees - verify transaction-to-detection reconciliation reports.
- [ ] **Explainable alerts:** Often missing deterministic evidence contract - verify every alert has stable reason codes and evidence references.
- [ ] **SAR operations:** Often missing continuing activity controls - verify timer-driven review and filing workflows (initial + continuing).
- [ ] **Model governance:** Often missing independent validation - verify model inventory, validation ownership, and documented limitations.
- [ ] **Security hardening:** Often missing scope-aware authorization - verify cross-role and cross-scope abuse tests in CI.
- [ ] **Operational readiness:** Often missing SLO telemetry - verify ingestion-to-alert latency and queue lag dashboards are live.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Event loss/duplication in detection pipeline | HIGH | Freeze new threshold changes, reconcile from outbox, replay affected event range, run duplicate-alert cleanup, and publish incident RCA |
| Explainability gaps in active alerts | MEDIUM | Mark impacted alerts as limited-confidence, run backfill evidence job, and temporarily gate SAR drafting on evidence completeness |
| SAR backlog and missed deadlines | HIGH | Trigger surge mode (priority queue + staffed review), auto-escalate aging cases, and document remediation with compliance/legal |
| Confidentiality leak of SAR data | HIGH | Immediate access revocation, rotate secrets/tokens, legal/compliance notification workflow, forensic log review, and control patch rollout |
| Precision collapse after tuning | MEDIUM | Roll back parameter set, enable conservative fallback profile, and rerun tuning with disposition-labeled validation set |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Alert quality collapse from poor threshold tuning | Phase C - Detection quality and state correctness | Precision floor and disposition scorecards met for two release cycles |
| Fragile event delivery and duplicate processing | Phase B - Durable eventing and idempotency backbone | Reconciliation shows zero unaccounted transaction events; replay drill succeeds |
| Non-deterministic detector state | Phase C - Detection quality and state correctness | Restart and multi-instance consistency tests pass with identical findings |
| Explainability afterthought | Phase D - Explainability contract and evidence model hardening | 100% alerts include schema-valid reasons and evidence references |
| Missing independent model challenge | Phase A - Governance, contracts, and observability foundation | Model inventory complete and independent validation sign-off present |
| SAR workflow compliance failures | Phase F - SAR operations and compliance assurance | No overdue SAR tasks; continuing activity controls demonstrated |
| SAR confidentiality/tipping-off risk | Phase E - Security and access control hardening | Security tests show no unauthorized SAR field exposure |
| Retry storm and queue amplification | Phase B - Durable eventing and idempotency backbone | Error classes mapped; DLQ and retry SLOs within targets |
| Weak authorization scope in alert/case flows | Phase E - Security and access control hardening | Cross-scope abuse tests pass for API and realtime channels |
| Missing end-to-end telemetry | Phase A - Governance, contracts, and observability foundation | Live SLO dashboards and trace coverage meet release gates |

## Sources

- Internal project scope and operating constraints: .planning/PROJECT.md (2026-04-09) [HIGH]
- Internal engineering concern audit: .planning/codebase/CONCERNS.md (2026-04-09) [HIGH]
- FFIEC BSA/AML Manual, Suspicious Activity Reporting Overview (accessed 2026-04-10): https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/04 [HIGH]
- FinCEN press release on SAR FAQs (Oct 9, 2025): https://www.fincen.gov/news/news-releases/fincen-issues-frequently-asked-questions-clarify-suspicious-activity-reporting [HIGH]
- FDIC FIL-48-2025 SAR FAQ bulletin (updated Oct 10, 2025): https://www.fdic.gov/news/financial-institution-letters/2025/frequently-asked-questions-regarding-suspicious-activity [HIGH]
- FATF Recommendations (amended Oct 2025): https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html [HIGH]
- Federal Reserve SR 11-7 Model Risk Management guidance: https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm [HIGH]
- BIS FSI Occasional Paper No 24, Managing explanations (Sep 8, 2025): https://www.bis.org/fsi/fsipapers24.htm [MEDIUM]
- NIST AI Risk Management Framework page and resources: https://www.nist.gov/itl/ai-risk-management-framework [MEDIUM]

---
*Pitfalls research for: Intelligent AML detection platform*
*Researched: 2026-04-10*