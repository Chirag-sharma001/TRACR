# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Jest `^30.3.0`
- Config: `backend/jest.config.js`

**Assertion Library:**
- Jest built-in `expect`
- Common matchers: `toBe`, `toEqual`, `toContain`, `toHaveBeenCalledWith`, `toBeTruthy`

**Property Testing:**
- fast-check `^4.6.0` is used heavily in `*.property.test.js`
- Typical configuration: `numRuns: 100`

**Run Commands:**
```bash
cd backend
npm test                   # Run all tests
npm run test:watch         # Watch mode
npx jest path/to/file.js   # Single file
npx jest --coverage        # Coverage report
```

## Test File Organization

**Location:**
- Tests are colocated with implementation in `backend/src/**`
- Shared test helpers in `backend/src/testUtils/`

**Naming:**
- Property tests: `*.property.test.js`
- Integration tests: `*.integration.test.js`
- Targeted unit tests: `*.test.js`

**Representative layout:**
```text
backend/src/
  detection/
    CycleDetector.js
    CycleDetector.property.test.js
    DetectionOrchestrator.js
    DetectionOrchestrator.test.js
  integration/
    ingestionToAlert.integration.test.js
  testUtils/
    httpHarness.js
    factories.js
```

## Test Structure

**Suite organization pattern:**
```javascript
describe("ModuleName", () => {
  test("behavior description", async () => {
    // arrange
    // act
    // assert
  });
});
```

**Patterns observed:**
- Dependency injection with test doubles instead of full app boot
- Explicit domain behavior assertions (risk tiers, auth rejection, transition guards)
- Time-based behavior tested with fake timers where needed (`jest.useFakeTimers`)

## Mocking

**Framework:**
- Jest built-in mocks and spies (`jest.fn`, `jest.mock`)

**Common mocking patterns:**
- Module-level mocking for external services/libraries:
  - `socket.io` mocked in `backend/src/realtime/SocketGateway.test.js`
  - `@google/generative-ai` mocked in `backend/src/sar/GeminiClient.test.js`
- Model/service stubs injected into constructors and route factories
- Event bus substitution with local `EventEmitter` in integration tests

**What is commonly mocked:**
- External APIs (Gemini)
- Socket transport
- Database model methods (`findOne`, `create`, `aggregate`, `countDocuments`)
- Logging dependencies

## Fixtures and Factories

**Test data:**
- Reusable transaction factories in `backend/src/testUtils/factories.js`
- HTTP harness utilities in `backend/src/testUtils/httpHarness.js`

**Pattern:**
- Factory default object with override support
- Thin wrappers for spinning local ephemeral HTTP servers in tests

## Coverage

**Configuration:**
- `collectCoverageFrom` includes `src/**/*.js` and excludes `src/server.js`
- No explicit coverage threshold enforcement found

**Implication:**
- Coverage can be generated, but CI blocking threshold is not configured in repo

## Test Types

**Property Tests:**
- High emphasis on invariant behavior and edge spaces
- Examples:
  - JWT expiry and RBAC gate correctness
  - Cycle detection boundedness and window behavior
  - Admin config range enforcement

**Integration Tests:**
- Route + service + event pipeline integration with stubs
- Example: `backend/src/integration/ingestionToAlert.integration.test.js`

**Unit/Focused Tests:**
- Component-level behavior checks for orchestrator, socket gateway, Gemini timeout handling

## Common Patterns

**Async testing:**
- `async/await` style dominates
- Polling helper loops are used for eventual consistency assertions in event-driven flows

**Error-path testing:**
- Explicit assertions for `401/403/400` responses
- Timeout/partial response behavior covered for Gemini client path

**Event-driven testing:**
- Local `EventEmitter` used to validate emitted events and side effects

## Gaps Noted From Test Suite Shape

- Limited full-stack testing with real MongoDB and actual middleware stack startup
- No browser/UI E2E tests in repository
- No CI workflow files found to automatically enforce test execution on push

---
*Testing analysis: 2026-04-09*
*Update when test patterns change*
