# Validation Scenario Catalog

Maps every validation scenario to the executable test that proves it, so the
scenario list survives independently of the assertion-free scaffold files it
originally lived in.

## Background

The validation suite began as five documentation-only files under
`tests/validation/`: `business-logic-validation`, `edge-cases-validation`,
`integration-validation`, `production-readiness-validation` and
`user-experience-validation`. Their 115 `it()` blocks contained no assertions,
so they reported as passing in CI whether the platform worked or not. That
inflated the suite count and made coverage look better than it was.

Every scenario in those files has been either converted to an executable test
or, where a unit test cannot verify the claim, moved to the deployment
checklist at the end of this document. The five files have been removed; this
catalog replaces them as the scenario inventory.

## Running the suite

```bash
npm run test:validation        # from the repository root
```

The script does its own `cd tests`, so running it from anywhere else fails.

## Current coverage

| Metric | Count |
| --- | --- |
| Executable test files | 23 |
| Executable tests | 308 |
| Assertion-free tests | 0 |
| Scenario groups catalogued | 54 |
| Retired scaffold tests replaced | 115 |
| Deployment-checklist items (not automatable) | 2 groups |

Per-file counts are authoritative from `npx vitest run --reporter=json`, not
from grepping for `it(`, which misses `it.each` blocks.

All executable tests live in `tests/validation/executable/`; paths below are
relative to that directory.

## Business logic

Retired scaffold: `business-logic-validation.test.ts` (32 documented scenarios).

| Scenario group | Executable coverage |
| --- | --- |
| App Registration Flow - complete flow, duplicate appId | `registry-core.test.ts` |
| App Registration Flow - appId format, engine exists, admin witness | `registration-admission.test.ts` |
| AA Account Materialization - unique accounts, idempotency | `aa-account.test.ts` |
| AA Account Materialization - AA core not configured | `registration-admission.test.ts` |
| Credit System - deposits, witness-gated and pause-immune withdrawals | `credit-system.test.ts` |
| Descriptor Management - validate, apply, out-of-range rejection | `descriptor.test.ts` |
| Governance Operations - timelock, early execution, cancellation | `governance.test.ts` |
| Pause Functionality - writes blocked, reads allowed, emergency withdrawal | `security.test.ts`, `security-enhanced.test.ts` |
| Reward Game Lifecycle - flow, timeout, daily cap, difficulty levels | `game-engine.test.ts`, `state-transitions.test.ts` |
| Payout Calculations - payouts, undo penalties, refund on failure | `pool-management.test.ts` |
| Pool Management - solvency, over-payout prevention | `pool-management.test.ts` |
| Framework Surface Operations - app.chain, app.funds, app.registry | `integration-flows.test.ts` |
| Error Handling - actionable messages | `error-message-quality.test.ts` |

## Edge cases

Retired scaffold: `edge-cases-validation.test.ts` (39 documented scenarios).

| Scenario group | Executable coverage |
| --- | --- |
| Numeric Boundaries - zero, maximum, negative | `boundary-numeric.test.ts` |
| String Boundaries - empty, max length, special characters | `boundary-string.test.ts`, `registration-admission.test.ts` |
| Array Boundaries - empty and large arrays | `observability-upgrade.test.ts` |
| Race Conditions - concurrent registration, game start, withdrawal | `concurrency.test.ts` |
| Timelock Edge Cases - exact boundary, overflow | `governance.test.ts`, `boundary-numeric.test.ts` |
| Timeout Edge Cases - timeout boundary, expired games | `oracle-edge-cases.test.ts`, `state-transitions.test.ts` |
| Invalid State Transitions - game and governance | `state-transitions.test.ts` |
| Pause State Edge Cases - pause mid-game, double pause, unpause | `security-enhanced.test.ts` |
| Insufficient Funds - pool, credit, dust amounts | `pool-management.test.ts`, `credit-system.test.ts` |
| Overflow Protection - balance, payout calculation | `boundary-numeric.test.ts` |
| AA Integration Edge Cases - core unavailable, collision, config race | `registration-admission.test.ts`, `aa-account.test.ts`, `concurrency.test.ts` |
| Oracle Integration Edge Cases - timeout, invalid response, expired game | `oracle-edge-cases.test.ts` |
| Admin Edge Cases - transition during operation, zero address | `security.test.ts`, `security-enhanced.test.ts` |
| Witness Edge Cases - repeated attempts, different account | `security.test.ts`, `registration-admission.test.ts` |
| Storage Edge Cases - key collisions, growth | `observability-upgrade.test.ts` |
| Event Emission Edge Cases - all state changes, large payloads | `observability-upgrade.test.ts` |

## Integration journeys

Retired scaffold: `integration-validation.test.ts` (11 documented scenarios).

| Scenario group | Executable coverage |
| --- | --- |
| Journey 1: Developer Onboards New Game - full registration flow | `user-journeys.test.ts`, `integration.test.ts` |
| Journey 2: Player Plays Game - full game session | `user-journeys.test.ts`, `game-engine.test.ts` |
| Journey 3: Developer Manages App - app lifecycle | `user-journeys.test.ts`, `descriptor.test.ts` |
| Registry to UnifiedSmartWallet - AA end to end | `integration.test.ts`, `aa-account.test.ts` |
| Engine to Oracle - oracle end to end | `oracle-integration.test.ts` |
| Framework to Contracts - framework surfaces | `integration-flows.test.ts` |
| Transaction Failure Recovery - failed registration, oracle timeout | `error-recovery.test.ts`, `oracle-edge-cases.test.ts` |
| State Inconsistency Recovery - pool insolvency | `error-recovery.test.ts`, `pool-management.test.ts` |
| Concurrent Operations - concurrent sessions, query load | `concurrency.test.ts`, `performance-limits.test.ts` |

## Production readiness

Retired scaffold: `production-readiness-validation.test.ts` (17 documented scenarios).

| Scenario group | Executable coverage |
| --- | --- |
| Security Validation - input validation, access control, reentrancy | `security.test.ts`, `security-enhanced.test.ts`, `registration-admission.test.ts` |
| Data Integrity - accounting invariants, double-spend prevention | `pool-management.test.ts`, `credit-system.test.ts` |
| Error Recovery - contract failures handled gracefully | `error-recovery.test.ts` |
| Performance Validation - gas cost targets, concurrent operations | `performance-limits.test.ts`, `concurrency.test.ts` |
| Monitoring and Observability - event emission, operational queries | `observability-upgrade.test.ts` |
| Upgrade Safety - upgrade procedures, emergency procedures | `observability-upgrade.test.ts`, `security-enhanced.test.ts` |
| Cross-Contract Integration - Registry to wallet, Engine to Oracle | `integration.test.ts`, `oracle-integration.test.ts` |
| Framework Integration - all framework surfaces | `integration-flows.test.ts` |
| Audit Requirements - source matches bytecode, documentation | Deployment checklist (below) |
| Operational Requirements - SLA targets | Deployment checklist (below) |

## User experience

Retired scaffold: `user-experience-validation.test.ts` (16 documented scenarios).

| Scenario group | Executable coverage |
| --- | --- |
| Onboarding Experience - first registration, clear error messages | `user-journeys.test.ts`, `error-message-quality.test.ts` |
| Transaction Flow UX - status, failure handling, wait times | `error-message-quality.test.ts`, `error-recovery.test.ts` |
| Cost Transparency - costs shown before operations, fee explanation | `performance-limits.test.ts` |
| Feedback and Confirmation - success confirmation, receipts | `user-journeys.test.ts`, `observability-upgrade.test.ts` |
| Performance Expectations - response time targets | `performance-limits.test.ts` |
| API Usability - method naming, type safety, JSDoc | `integration-flows.test.ts` |
| Error Debugging - stack traces, debug information | `error-message-quality.test.ts` |
| Testing Support - test utilities | `tests/setup.ts` exercised by every executable file |

## Deployment checklist

Two scenario groups made claims that a unit test cannot verify, because the
subject is the deployed artifact or the running system rather than the code.
They are recorded here as release gates instead of being silently dropped.

**Audit requirements** (was `production-readiness-validation.test.ts:230`)

- Deployed contract bytecode matches the audited source revision. Verify by
  compiling the tagged revision and comparing the resulting NEF checksum
  against the on-chain script, not by asserting a boolean in a test.
- Audit findings are closed or explicitly accepted, with the accepting owner
  recorded.
- Public documentation covers every externally callable method.

**Operational requirements** (was `production-readiness-validation.test.ts:245`)

- Availability target 99.9%, measured over a trailing 30 day window from
  production monitoring.
- Read query response under 500 ms at the 95th percentile, measured against a
  deployed RPC endpoint under representative load.
- Alerting is wired for pause events, pool insolvency and oracle timeout rates
  before the first production app is registered.

A test process cannot observe any of these; asserting them in Vitest would
restate the intent while proving nothing about the deployed system.
