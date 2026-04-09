---
phase: 07
slug: for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x |
| **Config file** | backend/jest.config.js |
| **Quick run command** | `cd backend && npx jest src/scoring/RiskScorer.property.test.js --runInBand` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest src/scoring/RiskScorer.property.test.js --runInBand`
- **After every plan wave:** Run `cd backend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PH7-HYBRID-BOUNDARY | T-07-01 / — | DFS remains confirmation source for graph-pattern hits | unit/property | `cd backend && npx jest src/detection/CycleDetector.property.test.js --runInBand` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | PH7-XAI-PACKET | T-07-02 / — | Explainability packet includes deterministic evidence + decomposition + confidence | unit/property | `cd backend && npx jest src/scoring/RiskScorer.property.test.js --runInBand` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 2 | PH7-AI-GUARDRAILS | T-07-03 / — | AI output is advisory-only and does not autonomously close/file | integration | `cd backend && npx jest src/integration/ingestionToAlert.integration.test.js --runInBand` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/scoring/RiskScorer.property.test.js` — add assertions for confidence field and explainability packet integrity
- [ ] `backend/src/routes/alerts` tests — add route-level checks for explainability payload shape and sorting/ranking behavior
- [ ] `backend/src/sar/SAR.property.test.js` — add guardrail tests for advisory-only SAR drafting policy

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Investigator trust review of narrative quality | PH7-XAI-PACKET | Narrative usefulness is qualitative and domain-specific | Use representative alerts; have investigator validate narrative-evidence alignment and capture sign-off notes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
