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

Additional real write-path validation now confirmed for testnet-only apps:

- `event-ticket-pass`
  - `createEvent` succeeded
  - `issueTicket` succeeded
  - `getEventDetails` and `getTicketDetails` returned the created state
- `soulbound-certificate`
  - `createTemplate` succeeded
  - `issueCertificate` succeeded
  - `getTemplateDetails` and `getCertificateDetails` returned the created state
- `milestone-escrow`
  - inbound token funding bug fixed by adding `OnNEP17Payment`
  - testnet update tx: `0x0ce7a07ef63721ec5541054448ff48b85090b4daa7de1e7f1e060453ce336536`
  - `createEscrow -> approveMilestone -> claimMilestone` succeeded with the signer scope required by the current deployment
- `quadratic-funding`
  - inbound token funding bug fixed by adding `OnNEP17Payment`
  - testnet update tx: `0x35723b356336309b3d503b7e1797d53c43548c55a04e22afb14e0580a9410eec`
  - `createRound -> registerProject -> contribute` succeeded with the signer scope required by the current deployment

### Needs deeper investigation on testnet

The following apps still require deeper investigation on testnet:

- `breakup-contract`
- `burn-league`
- `on-chain-tarot`
- `unbreakable-vault`
- `flashloan` is no longer a read-path concern, but still needs a proper live user-flow smoke to move from “ABI-compatible” to “validated”

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
