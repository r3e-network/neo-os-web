# 2026-03-18 Secondary MiniApp Validation

This report records the next validation wave after flagship and Oracle / AA
integration work was stabilized.

## Scope

Validated groups:

- second-tier source-owned dual-network miniapps
- source-owned testnet-only miniapps
- full frontend build sweep across all `apps/*` packages

## Frontend Build Sweep

Result:

- `47` app packages with `package.json`
- `0` build failures

This confirms every miniapp frontend currently ships a buildable artifact.

## Coverage Classification Snapshot

Current catalog classification:

- `frontend-only`: `18`
- `testnet+mainnet`: `20`
- `testnet-only`: `5`
- `mainnet-only-no-source`: `3`

## Secondary Testnet Read-Path Probe

A lightweight testnet read probe was executed against source-owned second-tier
and testnet-only contracts by selecting safe / low-risk read methods directly
from the current build manifests.

### Healthy on testnet

The following apps returned successful `HALT` reads in the latest probe:

- `council-governance`
- `dev-tipping`
- `gas-sponsor`
- `gov-merc`
- `graveyard`
- `memorial-shrine`
- `time-capsule`
- `event-ticket-pass`
- `milestone-escrow`
- `quadratic-funding`
- `soulbound-certificate`
- `trustanchor`

### Needs deeper investigation on testnet

The following apps still returned `FAULT` even on low-risk read probes and
should be treated as the next debugging set:

- `breakup-contract`
- `burn-league`
- `flashloan`
- `on-chain-tarot`
- `unbreakable-vault`

This does **not** yet prove that each app is fully broken for users, but it
does prove that these deployments are weaker than the already-validated
flagship set and deserve focused follow-up.

## Documentation Cleanup Applied

Repository documentation was also normalized during this wave:

- explorer links were migrated from `NeoTube` to `Neo3Scan`
- testnet contract hash drift in several miniapp READMEs was corrected
- the coverage audit now detects README network-hash mismatches automatically

## Current Assessment

As of 2026-03-18:

- flagship apps are the most validated production-ready set
- Oracle / AA tool miniapps are buildable and integrated
- the next highest-value engineering work is to deeply validate and, where
  needed, repair the five testnet apps listed above that still show read-path
  `FAULT`s
