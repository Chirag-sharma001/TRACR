# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Domain services often use PascalCase filenames: `RiskScorer.js`, `GraphManager.js`, `TransactionValidator.js`
- Route modules use lowercase filenames: `auth.js`, `alerts.js`, `graph.js`, `admin.js`
- Tests are colocated and use explicit suffixes:
  - `*.property.test.js`
  - `*.integration.test.js`
  - `*.test.js`

**Functions:**
- Route factory naming pattern: `createXRoutes(...)`
- Regular helper/service methods use camelCase
- Event handlers commonly prefixed with `on` (for example `onTransactionSaved`)

**Variables and Fields:**
- JavaScript locals: camelCase
- API and persisted domain fields often use snake_case (`transaction_id`, `risk_tier`, `created_at`)
- Enum-like constants use UPPER_SNAKE_CASE labels for domain values (`HIGH`, `SMURFING`)

**Types/Classes:**
- Class names are PascalCase (`CycleDetector`, `SARService`, `ThresholdConfig`)
- No TypeScript interfaces/types (JavaScript-only codebase)

## Code Style

**Formatting:**
- Semicolons are consistently present
- String quotes are predominantly double quotes
- Object literals often use trailing commas in multiline structures
- Mixed indentation widths exist (2-space and 4-space files); preserve surrounding file style when editing

**Linting/Formatting Tooling:**
- No ESLint/Prettier configuration files found in `backend/`
- Formatting conventions are currently enforced by repository habits and test review, not auto-format tools

## Import/Require Organization

**Pattern:**
1. External package requires first (`express`, `mongoose`, `jsonwebtoken`)
2. Internal module requires next (`../models/...`, `../events/eventBus`)
3. Exports at bottom (`module.exports = ...`)

**Grouping:**
- Logical blank lines between dependency groups are common
- Strict alphabetical ordering is not consistently applied

## Error Handling

**Patterns:**
- Route handlers use guard clauses and return explicit HTTP error payloads
- Middleware emits generic auth errors to client (`unauthorized`, `forbidden`) and logs details server-side
- Service modules prefer graceful fallback for external failures (for example partial SAR on Gemini failures)

**Resilience patterns:**
- `TransactionRepository.save` has single retry with short sleep for transient persistence failures
- Detection orchestrator catches baseline update errors and continues core detection flow

## Logging

**Framework:**
- Default logger is injected `console`
- Structured context is passed as object in log calls (`logger.warn("key", { ... })`)

**Patterns:**
- Event-oriented log keys (`graph_bootstrap_complete`, `detection_complete`, `jwt_auth_failed`)
- Warning/error logs at boundary failures, info logs for lifecycle events

## Comments

**When comments appear:**
- Sparse in implementation modules
- More explanatory comments in test files (feature/property references)

**Observed style:**
- Prefer self-descriptive code over heavy comments
- Minimal inline comments; documentation emphasis is in test names and variable naming

## Function Design

**Style:**
- Constructor dependency injection with defaults is common (`{ dep = defaultDep } = {}`)
- Guard-clause-first flow in route handlers
- Private helper methods via `#privateMethod` are used in several classes
- Methods generally focus on one responsibility (validation, normalization, scoring, etc.)

## Module Design

**Exports:**
- CommonJS `module.exports` everywhere
- Single-export class/module pattern is dominant
- Aggregator `index.js` modules expose grouped exports for routes/models

**Dependency injection:**
- Many modules accept model/logger/config dependencies for testability
- Test suites exploit this pattern with stubs/mocks rather than full stack boot

## Conventions to Preserve for New Code

- Maintain route factory pattern (`createXRoutes`) for Express routers
- Keep event bus emission names consistent (`domain:action` format)
- Match existing snake_case API field contracts
- Inject dependencies into services for easier test mocking
- Preserve per-file indentation style to avoid noisy diffs

---
*Convention analysis: 2026-04-09*
*Update when patterns change*
