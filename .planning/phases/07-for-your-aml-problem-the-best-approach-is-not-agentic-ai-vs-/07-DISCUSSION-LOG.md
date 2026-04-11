# Phase 7: Hybrid DFS + AI Responsibility Split - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 07-for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
**Areas discussed:** Deterministic DFS scope, AI responsibility scope, Explainability contract

---

## Deterministic DFS scope

| Option | Description | Selected |
|--------|-------------|----------|
| DFS is source of truth for graph-pattern hits | Cycle/loop/path detection must be algorithmic and reproducible | |
| DFS + AI can both trigger pattern hits | AI may also flag graph-pattern hits | ✓ |

**Follow-up boundary confirmation:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, DFS confirmation required | AI may suggest candidates, DFS remains final truth | ✓ |
| No, AI graph hit can stand alone | AI and DFS can independently create true hits | |

**User's choice:** AI may propose graph candidates, but DFS confirmation is required before treating as a true hit.
**Notes:** Preserves deterministic evidence guarantee while allowing AI assistance upstream.

---

## AI responsibility scope

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory, never sole blocker/closer | AI can prioritize/explain/draft but cannot alone close or suppress a case | ✓ |
| AI may auto-close low-risk cases | Allow autonomous closure for selected scenarios | |
| AI may auto-file SAR | Allow autonomous filing in defined cases | |

**User's choice:** Advisory, never sole blocker/closer.
**Notes:** Human-in-the-loop governance remains required.

---

## Explainability contract

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic pattern evidence | Path/loop transactions and account chain from DFS | ✓ |
| Score decomposition | Cycle/smurfing/behavioral/geo contributions | ✓ |
| Narrative rationale | Human-readable summary mapped to evidence | ✓ |
| Confidence level | Strength/uncertainty label for analyst triage | ✓ |

**User's choice:** Include all four explainability elements.
**Notes:** Supports analyst trust and auditability objectives.

---

## the agent's Discretion

- Internal naming of policy/config keys implementing boundary controls.
- Exact API field names for explainability packet fields.

## Deferred Ideas

- None.
