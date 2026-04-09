---
phase: 01
slug: governance-contracts-and-observability
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest + fast-check |
| **Config file** | backend/jest.config.js |
| **Quick run command** | `cd backend && npx jest src/routes/AdminRoutes.property.test.js --runInBand` |
| **Full suite command** | `cd backend && npm test` |
| **Estimated runtime** | ~45-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npx jest <affected-test-file> --runInBand`
- **After every plan wave:** Run `cd backend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | GOV-03 | T-01-01 | Config publish requires explicit approval gate and cannot self-approve | unit/property | `cd backend && npx jest src/routes/AdminRoutes.property.test.js --runInBand` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | GOV-03 | T-01-02 | Rollback requires reason + linked change ID and writes immutable audit trail | unit/integration | `cd backend && npx jest src/audit/AuditLogger.property.test.js --runInBand` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | DET-03 | T-01-03 | Drift/calibration telemetry segmented by detector, risk segment, and version lineage | unit/property | `cd backend && npx jest src/realtime/SocketGateway.test.js --runInBand` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 2 | DET-03 | T-01-04 | Daily + weekly observability windows are exposed and stable under config changes | integration | `cd backend && npx jest src/integration/ingestionToAlert.integration.test.js --runInBand` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/audit/AuditLogger.property.test.js` - add rollback lineage and immutability invariants
- [ ] `backend/src/routes/AdminRoutes.governance.test.js` - add approval lifecycle contract tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Governance review clarity of detector/risk segmented telemetry | DET-03 | Human interpretation of operational usefulness is subjective | Use admin telemetry endpoints with seeded data and verify compliance manager can compare drift across detector + segment + version windows |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
