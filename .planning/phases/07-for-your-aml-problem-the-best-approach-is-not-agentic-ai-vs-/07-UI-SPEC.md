---
phase: 07
slug: for-your-aml-problem-the-best-approach-is-not-agentic-ai-vs-
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-10
---

# Phase 07 - UI Design Contract

> Visual and interaction contract for the hybrid DFS + AI AML responsibility split.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react (default recommendation if UI implementation starts) |
| Font | "IBM Plex Sans", "Inter", sans-serif |

---

## Hybrid Responsibility Interaction Contract

| Interaction Surface | Contract |
|---------------------|----------|
| Alert detail header | Show two explicit badges: `Deterministic Evidence: Confirmed/Not Confirmed` and `AI Assistance: Advisory`. |
| Pattern claim rendering | Never render a graph typology as confirmed unless DFS/graph detector evidence is present. If missing, show `Awaiting deterministic confirmation`. |
| Explanation packet panel | Render in fixed order: 1) deterministic evidence, 2) score decomposition, 3) narrative rationale, 4) confidence. |
| AI action boundaries | AI outputs can prefill rank, summary, SAR draft, and next-step suggestions, but cannot directly execute `Close case`, `Suppress alert`, or `File SAR`. |
| Human decision points | Any regulated decision action requires explicit user click plus reason text. No auto-commit from AI suggestions. |
| Traceability affordances | Every AI-generated sentence must expose `View source evidence` links to transaction IDs, accounts, and path segments. |
| Confidence display | Show confidence as `High`, `Medium`, or `Low` with a short tooltip describing evidence strength. |
| Missing evidence state | If decomposition or deterministic evidence is unavailable, disable final recommendation actions and show remediation guidance. |

---

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: 44px minimum touch target for icon-only controls in alert timeline and graph controls.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 600 | 1.4 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

Allowed weights for this phase: 400 and 600 only.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #F6F7F9 | App background and primary surfaces |
| Secondary (30%) | #E7EDF3 | Cards, side panels, tab rails, timeline containers |
| Accent (10%) | #0D9488 | Primary CTA, active tab indicator, selected evidence path highlight, high-confidence chip |
| Destructive | #B91C1C | Destructive actions only |

Accent reserved for: `Review Evidence Packet` primary CTA, active section indicator, selected graph path highlight, and high-confidence status chip only.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Review Evidence Packet |
| Empty state heading | No hybrid-boundary alerts yet |
| Empty state body | DFS-confirmed and AI-prioritized alerts will appear here. Ingest new transactions or run replay to generate evidence. |
| Error state | We could not build the explanation packet. Retry once. If the issue continues, open the audit log and escalate to compliance engineering. |
| Destructive confirmation | Discard SAR draft: This removes the current draft text only. Type `DISCARD` to confirm. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required (tool not initialized) |
| third-party registries | none | not applicable |

---

## Source Notes

- Pre-populated from 07-CONTEXT.md: deterministic versus advisory boundary, mandatory evidence, explainability components, confidence requirement, and human-review guardrails.
- Pre-populated from 07-RESEARCH.md: evidence-first packet ordering, advisory-only AI action posture, and traceability expectations.
- Pre-populated from REQUIREMENTS.md: decomposition visibility, narrative rationale, and investigator workflow constraints.
- Defaults applied: design tokens, typography scale, color palette, and copywriting text because no existing frontend design system or component baseline exists in this repository.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
