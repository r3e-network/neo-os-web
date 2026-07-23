# Platform Contract Upgrade Readiness

Generated: 2026-07-23T05:21:51.527Z

## Summary

- Drifted contracts: 4
- Historical artifacts resolved to Git: 4/4
- Additive/equal ABI: 3
- ABI-breaking removals: 1
- Unchanged serialized record layouts: 4/4
- Changed storage-prefix values: 0
- Breaking storage-key schemas: 1
- Blocking legacy credit rows: 3
- Underbacked legacy-credit contracts: 1
- Staged update candidates: 1
- Exact update preflights HALT: 4/4
- Preflight transactions broadcast: 0
- Distinct admin domains: 2
- Boundary: This ledger proves artifact provenance and static ABI/storage deltas, including declared storage-key schema changes that prefix-byte comparison cannot detect. It does not authorize a chain write or prove stateful upgrade safety; exact pre/post state snapshots and funded lifecycle probes remain mandatory.

## Readiness Ledger

| Order | Contract | Deployed revision | ABI delta | Storage delta | Route | Readiness |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | PlatformRegistry | 960d43f67e55 | +11/-0 (additive-or-equal) | prefix +8/-0/~0; records ~0; keys ~0 (additive-or-unchanged) | timelocked-in-place-update | staged-update-candidate |
| 2 | PlatformDeFi | 5e4d20cdc65f | +44/-0 (additive-or-equal) | prefix +20/-0/~0; records ~0; keys ~2 (breaking-key-schema-change) | direct-in-place-update | legacy-credit-recovery-bridge-review-required |
| 3 | MiniAppFactory | 16e6fa6abb6e | +1/-0 (additive-or-equal) | prefix +0/-0/~0; records ~0; keys ~0 (additive-or-unchanged) | direct-in-place-update | live-abi-and-lifecycle-certification-required |
| 4 | PlatformAnchor | 15873071cf47 | +0/-2 (breaking-removals) | prefix +0/-1/~0; records ~0; keys ~0 (review-orphaned-prefixes) | direct-in-place-update | abi-deprecation-decision-required |

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
- Changed storage-key schemas: none
- Live storage snapshot: none
- Behavior changes: spend-threshold raises become timelocked while reductions remain immediate; per-app pause is pushed into an already minted AppAccount; engine-pool funding uses the engine's appId:fund deposit grammar
- Required gates: add Registry schedule/execute support to the updater; simulate scheduleUpdate with the exact local NEF and manifest; wait the on-chain timelock and re-read the pinned hashes before execution; verify checksum, update counter, Registry rows, artifact checksum, and engine bindings afterward

### PlatformDeFi

- Admin: 0x6d0656f6dd91469db1c90cc1e574380613f43738
- Deployed checksum: 3687605410
- Candidate checksum: 334460533
- Exact preflight: update HALT, gas 29132042, transactions 0
- ABI added: abandonLoan, activateLegacyCreditRecovery, fundCapsuleYieldReserve, gasCreditLiabilityOf, getCapsuleYieldReserve, getDirectGasCredit, getDirectNeoCredit, getFlashProviderBalance, getFlashTotalLpDeposits, getLastPriceDropTime, getLegacyGasCredit, getLegacyNeoCredit, getLendingLiquidity, getNeoGasPrice, getTotalAbandonedCollateral, getTotalCapsuleFees, getTotalLendingFees, getUnclaimedFlashLoanFees, initializeLegacyCreditRecovery, isLiquidatable, legacyCreditRecoveryState, legacyCreditSnapshotHash, legacyGasCreditLiability, legacyGasCreditRows, legacyNeoCreditLiability, legacyNeoCreditRows, lendingDeposit, liquidateLoan, migrateFlashProviderBalance, neoCreditLiabilityOf, setNeoGasPrice, totalGasCreditLiability, totalNeoCreditLiability, withdrawAbandonedCollateral, withdrawCapsuleFees, withdrawCapsulePenalties, withdrawCapsuleYieldReserve, withdrawFlashLoanFees, withdrawGasCredit, withdrawLegacyGasCredit, withdrawLegacyNeoCredit, withdrawLendingFees, withdrawLendingLiquidity, withdrawNeoCredit
- ABI removed: none
- Added storage prefixes: PREFIX_APP_GAS_CREDIT_LIABILITY, PREFIX_APP_NEO_CREDIT_LIABILITY, PREFIX_CAPSULE_GAS_RESERVE, PREFIX_FLASH_PROVIDER_BAL, PREFIX_FLASH_TOTAL_LP_DEPOSITS, PREFIX_LEGACY_CREDIT_RECOVERY_STATE, PREFIX_LEGACY_CREDIT_SNAPSHOT_HASH, PREFIX_LEGACY_GAS_CREDIT_LIABILITY, PREFIX_LEGACY_GAS_CREDIT_ROWS, PREFIX_LEGACY_NEO_CREDIT_LIABILITY, PREFIX_LEGACY_NEO_CREDIT_ROWS, PREFIX_LENDING_GAS_LIQUIDITY, PREFIX_NEO_GAS_PRICE, PREFIX_NEO_GAS_PRICE_TIME, PREFIX_PRICE_DROP_TIME, PREFIX_TOTAL_ABANDONED_COLLATERAL, PREFIX_TOTAL_CAPSULE_FEES, PREFIX_TOTAL_GAS_CREDIT_LIABILITY, PREFIX_TOTAL_LENDING_FEES, PREFIX_TOTAL_NEO_CREDIT_LIABILITY
- Removed storage prefixes: none
- Changed storage-key schemas: PREFIX_NEO_CREDIT payer Hash160 -> appId + payer Hash160 (an existing payer-only NEO credit cannot be assigned to a tenant deterministically); PREFIX_GAS_CREDIT payer Hash160 -> appId + payer Hash160 (an existing payer-only GAS credit cannot be assigned to a tenant deterministically)
- Live storage snapshot: docs/reports/platform-defi-legacy-credit-snapshot-latest.json, block count 17924995, legacy rows 3, status blocked-nonempty-and-underbacked, transactions 0
- Behavior changes: adds lending liquidity, liquidation, fee sweep, abandoned-collateral, pricing, and flash-provider accounting lanes; changes direct NEO and GAS credit ownership from payer-global to appId-and-payer scoped with exact appId:credit routing; adds per-app and global direct-credit liabilities and preserves them across every native-asset payout; adds an auto-paused legacy-credit recovery state machine with exact snapshot initialization, deficit top-up, activation, and payer-witnessed withdrawals
- Required gates: freeze deposits and enumerate every legacy 0x14 and 0x15 storage row from one exact state snapshot; review the exact payer arrays and 32-byte snapshot hash before initializing the recovery bridge; simulate the exact update and require automatic pause plus recovery state SnapshotRequired before any other action; initialize the snapshot and require the recorded row counts and NEO/GAS liabilities to match the public snapshot exactly; resolve the 134226336 datoshi GAS deficit through a separately approved top-up before activation; no withdrawal or unpause may succeed while underbacked; simulate every legacy payer withdrawal and require zero residual rows and liabilities before recovery completes; prefer a fresh PlatformDeFi v1.2 deployment because the current testnet contract has zero tenant bindings; snapshot native balances, product rows, loans, capsules, flash-loan accounting, and all new liability totals; verify checksum, update counter, old safe reads, every new safe read, and native-balance-versus-liability solvency afterward; run funded lending, capsule, and flash-loan lifecycle probes before binding a live tenant

### MiniAppFactory

- Admin: 0x6d0656f6dd91469db1c90cc1e574380613f43738
- Deployed checksum: 2240313340
- Candidate checksum: 905792977
- Exact preflight: update HALT, gas 7818730, transactions 0
- ABI added: deployArtifactFromTemplate
- ABI removed: none
- Added storage prefixes: none
- Removed storage prefixes: none
- Changed storage-key schemas: none
- Live storage snapshot: none
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
- Changed storage-key schemas: none
- Live storage snapshot: none
- Behavior changes: removes batch agent-account rotation to prevent one-transaction redirection of all agents; removes unused agent-weight mutation and reporting from the manual AA routing model; accepts safe plain-string stake memos without deserializing untrusted transfer data
- Required gates: decide whether removed public methods need deprecated compatibility stubs; inventory external callers before publishing the reduced ABI; snapshot app, stake, reward, credit, agent, candidate, and selected-agent state; verify checksum, update counter, historical reads, withdrawals, claims, transfers, and votes afterward

## Ordered Plan

1. PlatformRegistry: add timelocked updater support, schedule exact candidate hashes, wait, execute, then reconcile all Registry and AppAccount-artifact invariants.
2. PlatformDeFi: review and simulate the v1.2 auto-paused recovery bridge against the exact public legacy-credit snapshot, separately resolve the GAS deficit, prove all payer withdrawals, and because bindings are zero still prefer a fresh deployment before funded product lifecycles and tenant binding.
3. MiniAppFactory: retain the completed creator-artifact builder and fail-closed consumer cutover, then certify the exact live ABI, governed artifacts, and funded transaction/event/readback recovery lifecycle before updating.
4. PlatformAnchor: make an explicit public-ABI deprecation decision before removing setAgentAccounts and setAgentWeight on-chain.
5. PlatformSocial: treat first deployment or retirement as a separate architecture decision, not part of this update batch.
