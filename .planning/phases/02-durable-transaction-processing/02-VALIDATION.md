---
phase: 02
slug: durable-transaction-processing
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest + fast-check |
| **Config file** | backend/jest.config.js |
| **Quick run command** | `cd backend && npx jest --runInBand src/ingestion/TransactionRepository.property.test.js` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~60-180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest --runInBand <affected-test-files>`
- **After every plan wave:** Run `cd backend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DET-02 | T-02-01 | Deterministic idempotency key blocks duplicate side effects | property | `cd backend && npx jest --runInBand src/ingestion/TransactionRepository.property.test.js` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DET-02 | T-02-02 | Idempotency ledger transitions are atomic and replay-safe | unit | `cd backend && npx jest --runInBand src/ingestion/ProcessingLedger.test.js` | ❌ W0 | ⬜ pending |
| 02-02-01 | 2 | 2 | DET-02 | T-02-03 | Failed processing items are persisted with recoverable status | integration | `cd backend && npx jest --runInBand src/routes/TransactionRecoveryRoutes.test.js` | ❌ W0 | ⬜ pending |
| 02-02-02 | 2 | 2 | DET-02 | T-02-04 | Reprocess action is bounded, auditable, and idempotent | property | `cd backend && npx jest --runInBand src/routes/TransactionRecoveryRoutes.property.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ingestion/TransactionRepository.property.test.js` - duplicate ingest/replay idempotency invariants
- [ ] `backend/src/ingestion/ProcessingLedger.test.js` - idempotency ledger state-machine tests
- [ ] `backend/src/routes/TransactionRecoveryRoutes.test.js` - list/reprocess/replay endpoint tests
- [ ] `backend/src/routes/TransactionRecoveryRoutes.property.test.js` - bounded replay/idempotent recovery properties

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator can safely replay bounded failure window without duplicate alerts | DET-02 | Requires operational review of replay controls and failure dashboards | Seed failed events, trigger bounded replay, verify no duplicate alert side effects and confirm operator-visible recovery status changes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
