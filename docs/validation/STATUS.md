# Validation Test Suite - Current Status

**Last Updated:** 2026-07-25
**Status:** Scenario conversion complete

## Quick stats

- 308 tests passing, 0 failing
- 23 test files, all under `tests/validation/executable/`
- 0 assertion-free tests
- 54 scenario groups catalogued, 52 executable, 2 moved to the deployment checklist
- 3.4s wall-clock for the full run

Counts come from `npx vitest run --reporter=json`. Grepping for `it(` gives a
different number because it misses `it.each` tables and matches `waitFor(`.

## What changed

The five documentation-only scaffolds (`business-logic-validation`,
`edge-cases-validation`, `integration-validation`,
`production-readiness-validation`, `user-experience-validation`) held 115
`it()` blocks with no assertions. They passed whether the platform worked or
not. Every scenario group in them has been converted to an executable test or,
where the claim concerns the deployed artifact rather than the code, recorded as
a release gate. The scaffolds have been deleted;
[SCENARIO-CATALOG.md](./SCENARIO-CATALOG.md) is now the scenario inventory.

The shared mock in `tests/setup.ts` was hardened at the same time. It models the
registry's admission rules - witness check, engine whitelist, appId format,
duplicate rejection, AA-core configuration - instead of answering every call
with success. Removing the engine-whitelist and witness guards from the mock
turns exactly five tests red, all in `registration-admission.test.ts`: three on
engine existence, one on admin witness, one asserting the registry is unchanged
after a rejected registration. That mutation is the check that the assertions
bind to behaviour rather than passing incidentally.

## Coverage

See [comprehensive-validation-summary.md](./comprehensive-validation-summary.md)
for the area-by-area breakdown and
[SCENARIO-CATALOG.md](./SCENARIO-CATALOG.md) for group-to-file mapping.

## Not covered by this suite

The suite runs in-process against mocks. Deployed bytecode equivalence, real gas
consumption, RPC latency and availability targets cannot be asserted here; they
are release gates in the catalog's deployment checklist.
