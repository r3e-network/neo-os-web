# Comprehensive Validation Suite - Summary

**Last updated:** 2026-07-25
**Suite:** `tests/validation/executable/` - 23 files, 308 executable tests
**Scenario inventory:** [SCENARIO-CATALOG.md](./SCENARIO-CATALOG.md)

## What this suite is

The validation suite exercises the platform contract library against mock
contracts that model the on-chain admission rules: witness checks, engine
whitelist, appId format, duplicate rejection, AA-core configuration, pool
solvency and pause semantics. Every test asserts observable state, so a rule
that regresses turns a test red.

Run it from the repository root:

```bash
npm run test:validation
```

The script does its own `cd tests`, so running it from anywhere else fails.

## History

This document previously described five suites - business logic, user
experience, production readiness, edge cases, integration - as complete, on the
strength of 115 `it()` blocks that contained no assertions. Those blocks
documented expected behaviour in comments and passed unconditionally, whether
the platform worked or not.

All 54 scenario groups from those five files have been converted to executable
tests, except two groups whose subject is the deployed artifact rather than the
code; those became release gates. The five scaffolds have been deleted.
`SCENARIO-CATALOG.md` records every group, the file that now covers it, and the
two deployment-checklist items.

## Coverage by area

| Area | Executable files | Notes |
| --- | --- | --- |
| Registry and admission | `registry-core`, `registration-admission` | Engine whitelist, admin witness, appId and address format, duplicate rejection |
| Abstract accounts | `aa-account`, `integration` | Uniqueness, idempotency, unconfigured AA core |
| Credit and pools | `credit-system`, `pool-management` | Deposits, witness-gated withdrawals, solvency, over-payout prevention |
| Game engine | `game-engine`, `state-transitions` | Lifecycle, timeout, daily cap, invalid transitions |
| Oracle | `oracle-integration`, `oracle-edge-cases` | End-to-end flow, timeout, invalid response, expired game |
| Governance | `governance`, `descriptor` | Timelock boundaries, cancellation, descriptor range checks |
| Security | `security`, `security-enhanced` | Access control, pause semantics, emergency withdrawal |
| Boundaries | `boundary-numeric`, `boundary-string` | Zero, maximum, negative, overflow, empty and oversized strings |
| Concurrency | `concurrency` | Concurrent registration, game start, withdrawal, config race |
| Observability | `observability-upgrade` | Event stream reconstructs contract state; upgrade and storage limits |
| Recovery | `error-recovery`, `error-message-quality` | Failure paths and actionable error text |
| Performance | `performance-limits` | Gas and payload ceilings enforced in-process |
| Journeys | `user-journeys`, `integration-flows` | Three end-to-end actor journeys, framework surfaces |

## What the suite does not establish

These tests run against mocks in-process. They constrain the library's logic and
its handling of contract responses; they do not prove behaviour of deployed
bytecode, real gas consumption, RPC latency or availability. The deployment
checklist in `SCENARIO-CATALOG.md` covers what has to be verified against a
running system instead.
