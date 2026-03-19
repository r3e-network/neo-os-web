# 2026-03-19 MiniApp Validation Summary

## Current status

### Contract-backed miniapps

- full testnet live smoke passed: `31 / 32`
- remaining partial validation item: `council-governance`

The only remaining gap is not a broken user flow on a normal account. It is the
`passed / execute` path for `MiniAppCouncilGovernance`, whose contract gates
voters through `NEO.GetCommittee()` and hardcodes quorum as `21 * 30% = 6`.
The current test workspace only has two live testnet committee signers
available, so this path is blocked by external signer availability rather than a
normal application regression.

### Frontend-only / launcher / console miniapps

- structure / route / shared-layout validation passed: `24 / 24`
- host app production build passed

## Contract-backed miniapps with full live testnet validation

- `flashloan`
- `exfiles`
- `masqueradedao`
- `millionpiecemap`
- `graveyard`
- `halloffame`
- `heritagetrust`
- `dicegame`
- `gascircle`
- `turtlematch`
- `breakup-contract`
- `burn-league`
- `dev-tipping`
- `on-chain-tarot`
- `unbreakable-vault`
- `event-ticket-pass`
- `gas-sponsor`
- `memorial-shrine`
- `milestone-escrow`
- `soulbound-certificate`
- `trustanchor`
- `gov-merc`
- `quadratic-funding`
- `time-capsule`
- `daily-checkin`
- `last-survivor`
- `gasbox`
- `fogplay`
- `red-envelope`
- `self-loan`
- `neo-pay`

## Contract-backed miniapp with partial live validation

- `council-governance`
  - verified on live candidate accounts:
    - candidate gating
    - proposal creation
    - voting
    - delegation / revoke delegation
    - proposal revoke
    - expiry / finalize
  - not yet fully validated:
    - `passed` policy proposal path
    - `submitSignature`
    - `executeProposal`
  - blocker:
    - contract treats only current Neo committee members as eligible voters
    - quorum is fixed at `6` votes
    - current workspace has only `2` live testnet committee signer keys

## Frontend-only / launcher / console miniapps

- `aa-account-lab`
- `aa-market-hub`
- `aa-permissions-lab`
- `aa-relay-console`
- `aa-session-key-lab`
- `explorer`
- `flamingo-action-center`
- `flamingo-analytics`
- `flamingo-earn`
- `flamingo-lend`
- `flamingo-swap`
- `neo-convert`
- `neo-multisig`
- `neo-sign-anything`
- `neo-treasury`
- `neo-x-bridge`
- `oracle-compute-lab`
- `oracle-http-console`
- `oracle-neodid-console`
- `oracle-price-console`
- `oracle-seal-console`
- `oracle-vrf-console`
- `timestamp-proof`
- `wallet-health`

## Reports

- [`2026-03-19-selected-miniapp-live-smoke.json`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-selected-miniapp-live-smoke.json)
- [`2026-03-19-remaining-miniapp-live-smoke-part1.json`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-remaining-miniapp-live-smoke-part1.json)
- [`2026-03-19-remaining-miniapp-live-smoke-part2.json`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-remaining-miniapp-live-smoke-part2.json)
- [`2026-03-19-remaining-miniapp-live-smoke-part3.json`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-remaining-miniapp-live-smoke-part3.json)
- [`2026-03-19-council-governance-live-smoke.json`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-council-governance-live-smoke.json)
- [`2026-03-19-frontend-only-structure-validation.md`](/Users/jinghuiliao/git/neo-miniapps-platform/docs/reports/2026-03-19-frontend-only-structure-validation.md)
