# Platform Contract Upgrade Readiness

Generated: 2026-07-23T03:10:51.974Z

## Summary

- Drifted contracts: 4
- Historical artifacts resolved to Git: 4/4
- Additive/equal ABI: 3
- ABI-breaking removals: 1
- Unchanged serialized record layouts: 4/4
- Changed storage-prefix values: 0
- Staged update candidates: 2
- Exact update preflights HALT: 4/4
- Preflight transactions broadcast: 0
- Distinct admin domains: 2
- Boundary: This ledger proves artifact provenance and static ABI/storage deltas. It does not authorize a chain write or prove stateful upgrade safety; exact pre/post state snapshots and funded lifecycle probes remain mandatory.

## Readiness Ledger

| Order | Contract | Deployed revision | ABI delta | Storage delta | Route | Readiness |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | PlatformRegistry | 960d43f67e55 | +11/-0 (additive-or-equal) | prefix +8/-0/~0; records ~0 (additive-or-unchanged) | timelocked-in-place-update | staged-update-candidate |
| 2 | PlatformDeFi | 5e4d20cdc65f | +26/-0 (additive-or-equal) | prefix +10/-0/~0; records ~0 (additive-or-unchanged) | direct-in-place-update | staged-update-candidate |
| 3 | MiniAppFactory | 16e6fa6abb6e | +1/-0 (additive-or-equal) | prefix +0/-0/~0; records ~0 (additive-or-unchanged) | direct-in-place-update | live-abi-and-lifecycle-certification-required |
| 4 | PlatformAnchor | 15873071cf47 | +0/-2 (breaking-removals) | prefix +0/-1/~0; records ~0 (review-orphaned-prefixes) | direct-in-place-update | abi-deprecation-decision-required |

## Contract Gates

### PlatformRegistry

- Admin: 0x13ef519c362973f9a34648a9eac5b71250b2a80a
- Deployed checksum: 372915605
- Candidate checksum: 2644796843
- Exact preflight: scheduleUpdate HALT, gas 560736, transactions 0
- ABI added: abstractAccountCore, abstractAccountCoreAvailableAt, appIdOfAbstractAccount, cancelAbstractAccountCore, cancelSpendThresholdRaise, executeSpendThresholdRaise, getAppAbstractAccount, materializeAbstractAccount, pendingAbstractAccountCore, proposeAbstractAccountCore, setAbstractAccountCore
- ABI removed: none
- Added storage prefixes: PREFIX_ABSTRACT_ACCOUNT_CORE, PREFIX_ABSTRACT_ACCOUNT_CORE_ETA, PREFIX_APP_ABSTRACT_ACCOUNT_CORE, PREFIX_APP_ABSTRACT_ACCOUNT_ID, PREFIX_APP_ID_BY_ABSTRACT_ACCOUNT, PREFIX_PENDING_ABSTRACT_ACCOUNT_CORE, PREFIX_PENDING_THRESHOLD_ETA, PREFIX_PENDING_THRESHOLD_VALUE
- Removed storage prefixes: none
- Behavior changes: spend-threshold raises become timelocked while reductions remain immediate; per-app pause is pushed into an already minted AppAccount; engine-pool funding uses the engine's appId:fund deposit grammar
- Required gates: add Registry schedule/execute support to the updater; simulate scheduleUpdate with the exact local NEF and manifest; wait the on-chain timelock and re-read the pinned hashes before execution; verify checksum, update counter, Registry rows, artifact checksum, and engine bindings afterward

### PlatformDeFi

- Admin: 0x6d0656f6dd91469db1c90cc1e574380613f43738
- Deployed checksum: 3687605410
- Candidate checksum: 3365527823
- Exact preflight: update HALT, gas 29132042, transactions 0
- ABI added: abandonLoan, fundCapsuleYieldReserve, getCapsuleYieldReserve, getFlashProviderBalance, getFlashTotalLpDeposits, getLastPriceDropTime, getLendingLiquidity, getNeoGasPrice, getTotalAbandonedCollateral, getTotalCapsuleFees, getTotalLendingFees, getUnclaimedFlashLoanFees, isLiquidatable, lendingDeposit, liquidateLoan, migrateFlashProviderBalance, setNeoGasPrice, withdrawAbandonedCollateral, withdrawCapsuleFees, withdrawCapsulePenalties, withdrawCapsuleYieldReserve, withdrawFlashLoanFees, withdrawGasCredit, withdrawLendingFees, withdrawLendingLiquidity, withdrawNeoCredit
- ABI removed: none
- Added storage prefixes: PREFIX_CAPSULE_GAS_RESERVE, PREFIX_FLASH_PROVIDER_BAL, PREFIX_FLASH_TOTAL_LP_DEPOSITS, PREFIX_LENDING_GAS_LIQUIDITY, PREFIX_NEO_GAS_PRICE, PREFIX_NEO_GAS_PRICE_TIME, PREFIX_PRICE_DROP_TIME, PREFIX_TOTAL_ABANDONED_COLLATERAL, PREFIX_TOTAL_CAPSULE_FEES, PREFIX_TOTAL_LENDING_FEES
- Removed storage prefixes: none
- Behavior changes: adds lending liquidity, liquidation, fee sweep, abandoned-collateral, pricing, and flash-provider accounting lanes
- Required gates: simulate update with the DeFi admin identity; snapshot balances, credits, product rows, loans, capsules, and flash-loan accounting; verify checksum, update counter, old safe reads, and every new safe read afterward; run funded lending, capsule, and flash-loan lifecycle probes before binding a live tenant

### MiniAppFactory

- Admin: 0x6d0656f6dd91469db1c90cc1e574380613f43738
- Deployed checksum: 2240313340
- Candidate checksum: 905792977
- Exact preflight: update HALT, gas 7818730, transactions 0
- ABI added: deployArtifactFromTemplate
- ABI removed: none
- Added storage prefixes: none
- Removed storage prefixes: none
- Behavior changes: deployFromTemplate becomes record-only for templates without artifacts and rejects artifact templates; artifact-backed deployment moves to deployArtifactFromTemplate with caller-supplied creator-unique artifacts and a digest over NEF, manifest, and init parameters; caller-supplied NEF must match the governed artifact and the manifest may only vary by its creator-unique contract name
- Required gates: retain the implemented creator-unique NEF and manifest generator with exact six-argument calls and artifact-digest coverage; register the exact generated FactoryNep17Token and FactoryNep11Collection artifacts under the governed template IDs; verify the live contract exposes deployArtifactFromTemplate(String,String,String,String,ByteArray,String) returning Hash160 through getcontractstate; prove legacy records remain readable and package IDs remain unique; simulate both record-only and unique-artifact flows before updating; verify checksum, update counter, template indexes, deployment indexes, and consumer ABI afterward; execute funded NEP-17 and NEP-11 deployments and verify transaction, event, readback, restart, and recovery behavior

### PlatformAnchor

- Admin: 0x6d0656f6dd91469db1c90cc1e574380613f43738
- Deployed checksum: 1604090204
- Candidate checksum: 1528462004
- Exact preflight: update HALT, gas 14953972, transactions 0
- ABI added: none
- ABI removed: setAgentAccounts, setAgentWeight
- Added storage prefixes: none
- Removed storage prefixes: PREFIX_AGENT_WEIGHT
- Behavior changes: removes batch agent-account rotation to prevent one-transaction redirection of all agents; removes unused agent-weight mutation and reporting from the manual AA routing model; accepts safe plain-string stake memos without deserializing untrusted transfer data
- Required gates: decide whether removed public methods need deprecated compatibility stubs; inventory external callers before publishing the reduced ABI; snapshot app, stake, reward, credit, agent, candidate, and selected-agent state; verify checksum, update counter, historical reads, withdrawals, claims, transfers, and votes afterward

## Ordered Plan

1. PlatformRegistry: add timelocked updater support, schedule exact candidate hashes, wait, execute, then reconcile all Registry and AppAccount-artifact invariants.
2. PlatformDeFi: take accounting snapshots, simulate a direct in-place update, verify old and new reads, then run funded product lifecycles before tenant binding.
3. MiniAppFactory: retain the completed creator-artifact builder and fail-closed consumer cutover, then certify the exact live ABI, governed artifacts, and funded transaction/event/readback recovery lifecycle before updating.
4. PlatformAnchor: make an explicit public-ABI deprecation decision before removing setAgentAccounts and setAgentWeight on-chain.
5. PlatformSocial: treat first deployment or retirement as a separate architecture decision, not part of this update batch.
