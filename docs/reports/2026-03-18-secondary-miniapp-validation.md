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
- `burn-league`
  - redeployed to `0x0946e3c3db8abdd2fa14bbae4978992015473c09`
  - `startSeason -> burnGas` succeeded
  - current season and user burn totals now update on-chain
- `breakup-contract`
  - redeployed to `0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8`
  - `createContract -> signContract -> triggerBreakup` succeeded across two real testnet accounts
  - `getContractDetails` now reflects the completed breakup state
- `on-chain-tarot`
  - redeployed to `0x5cdf29c30727ce06696736ae0fb49abd9fd79730`
  - fixed Oracle request path to use `requestFromCallback`
  - fixed callback decoding to consume raw RNG bytes from Morpheus relayer
  - fixed frontend request args to `spreadType=2`, `category=1`, and `0.1 GAS`
  - `requestReading` now completes and stores cards on-chain
- `unbreakable-vault`
  - redeployed to `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0`
  - `createVault -> attemptBreak` succeeded
  - `getVaultDetails` reflects bounty growth and attempt count correctly
- `flashloan`
  - redeployed to `0xde8e595d8d3c293731db499367ee2a768e1e458b`
  - refactored away from legacy PaymentHub-funded liquidity and async Oracle execution
  - new test harness deployed at `0x7aa01290d33f6b2313a7efd6acde58f3e64b636f`
  - `deposit -> requestLoan -> callback execute -> exact repayment` succeeded
  - `getLoanDetails`, `getPoolBalance`, and harness callback state all matched the executed transaction

### Needs deeper investigation on testnet

The following apps still require deeper investigation on testnet:

- no additional source-owned secondary miniapp remains blocked in this wave

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
- the highest-value remaining work has shifted away from these secondary
  contracts and back toward broader cross-miniapp UX and integration polish
