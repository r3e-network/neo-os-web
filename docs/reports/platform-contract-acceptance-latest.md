# Platform Contract Acceptance Ledger

Generated: 2026-07-25T11:06:04.432Z

## Summary

- Contracts inventoried: 9
- Source/build/test acceptance: 9/9
- Retained deployment reports: 4/9
- Partial operational evidence: 2/9
- No deployment record: 3
- Current testnet artifact matches: 2/9
- Testnet artifact drifts: 4
- Factory templates source/build/lifecycle acceptance: 2/2
- Boundary: Source acceptance and read-only testnet checks do not prove funded lifecycle behavior, mainnet parity, or operational health. A retained deployment report is historical evidence, not current bytecode equality.

## Ledger

| Contract | ABI methods/events | Permissions | Money callback | Update | Tests | Source acceptance | Testnet artifact | Evidence class | Deployment evidence |
| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- | --- |
| PlatformRegistry | 75/32 | 5 | yes | yes | 20 | accepted | live-artifact-drift | deployment-report | testnet registry report retained; fresh live read documented separately |
| AppAccount | 13/5 | 4 | yes | yes | 11 | accepted | active-artifact-match | artifact-activation | artifact active on testnet registry; no fleet accounts materialized |
| MiniAppFactory | 20/6 | 3 | yes | yes | 3 | accepted | live-artifact-drift | consumer-binding | consumer bindings exist; no dedicated deployment report retained |
| PlatformAnchor | 51/8 | 4 | yes | yes | 5 | accepted | live-artifact-drift | deployment-report | testnet and mainnet deployment reports retained |
| PlatformGame | 77/36 | 6 | yes | yes | 17 | accepted | live-artifact-match | deployment-report | testnet and mainnet deployment reports retained; testnet Registry row active |
| PlatformDeFi | 83/35 | 5 | yes | yes | 11 | accepted | live-artifact-drift | deployment-report | testnet hash retained in anchor deployment report; no live app bindings |
| PlatformSocial | 48/25 | 6 | yes | yes | 8 | accepted | no-deployment-record | none | no deployment record |
| PlatformVesting | 32/8 | 5 | yes | yes | 3 | accepted | not checked | none | source-only; no deployment record |
| PlatformEscrow | 39/10 | 6 | yes | yes | 3 | accepted | not checked | none | source-only; no deployment record |

## Factory Templates

| Template | Standard | ABI methods/events | Tests | Generated hashes | Source acceptance |
| --- | --- | ---: | ---: | --- | --- |
| FactoryNep17Token | NEP-17 | 16/3 | 1 | fresh | accepted |
| FactoryNep11Collection | NEP-11 | 23/3 | 1 | fresh | accepted |

## Evidence Detail

### PlatformRegistry

- Source files: 11
- Test files: `contracts/__tests__/AppAccountTests.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/CreateContractHashVectorTests.cs`, `contracts/__tests__/FinancialTransferSafetyTest.cs`, `contracts/__tests__/OnNep17PaymentConventionTests.cs`, `contracts/__tests__/PlatformGameAdminTimelockTests.cs`, `contracts/__tests__/PlatformGameRewardGameModelHarness.cs`, `contracts/__tests__/PlatformGameRewardGameModelInvariantTests.cs`, `contracts/__tests__/PlatformGameRewardGameSourceSecurityTests.cs`, `contracts/__tests__/PlatformGameRewardGameTests.cs`, `contracts/__tests__/PlatformRegistryAbstractAccountTests.cs`, `contracts/__tests__/PlatformRegistryHarness.cs`, `contracts/__tests__/PlatformRegistryHashSemanticsTests.cs`, `contracts/__tests__/PlatformRegistryMintTests.cs`, `contracts/__tests__/PlatformRegistryModelHarness.cs`, `contracts/__tests__/PlatformRegistryModelInvariantTests.cs`, `contracts/__tests__/PlatformRegistrySourceSecurityTests.cs`, `contracts/__tests__/PlatformRegistryTests.cs`, `contracts/__tests__/PlatformRegistryTreasuryTests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `deploy/config/platform-registry-testnet-2026-07-19.json`
- Current testnet artifact: live-artifact-drift
- Methods missing on current testnet deployment: abstractAccountCore, abstractAccountCoreAvailableAt, appIdOfAbstractAccount, cancelAbstractAccountCore, cancelSpendThresholdRaise, executeSpendThresholdRaise, getAppAbstractAccount, materializeAbstractAccount, pendingAbstractAccountCore, proposeAbstractAccountCore, setAbstractAccountCore
- Failed checks: none

### AppAccount

- Source files: 2
- Test files: `contracts/__tests__/AppAccountSourceSecurityTests.cs`, `contracts/__tests__/AppAccountTests.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/CreateContractHashVectorTests.cs`, `contracts/__tests__/FinancialTransferSafetyTest.cs`, `contracts/__tests__/OnNep17PaymentConventionTests.cs`, `contracts/__tests__/PlatformRegistryHarness.cs`, `contracts/__tests__/PlatformRegistryMintTests.cs`, `contracts/__tests__/PlatformRegistrySourceSecurityTests.cs`, `contracts/__tests__/PlatformRegistryTreasuryTests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `deploy/config/platform-registry-testnet-2026-07-19.json`
- Current testnet artifact: active-artifact-match
- Failed checks: none

### MiniAppFactory

- Source files: 3
- Test files: `contracts/__tests__/FactoryTokenTemplateTests.cs`, `contracts/__tests__/Fix_factory_Tests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `apps/asset-factory/neo-manifest.json`, `apps/miniapp-factory/neo-manifest.json`, `apps/nft-factory/neo-manifest.json`
- Current testnet artifact: live-artifact-drift
- Methods missing on current testnet deployment: deployArtifactFromTemplate
- Failed checks: none

### PlatformAnchor

- Source files: 6
- Test files: `contracts/__tests__/AnchorBoundarySafetyTest.cs`, `contracts/__tests__/AnchorRewardAccountingInvariantTest.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/MiniAppContractFunctionalTests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `contracts/build/testnet_anchor_deployment.json`, `contracts/build/mainnet_anchor_deployment.json`
- Current testnet artifact: live-artifact-drift
- Failed checks: none

### PlatformGame

- Source files: 27
- Test files: `contracts/__tests__/ContractProjectConventionsTest.cs`, `contracts/__tests__/ContractSecurityRegressionTest.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/FinancialTransferSafetyTest.cs`, `contracts/__tests__/MiniAppContractFunctionalTests.cs`, `contracts/__tests__/PlatformGameAdminTimelockTests.cs`, `contracts/__tests__/PlatformGameComprehensiveTests.cs`, `contracts/__tests__/PlatformGameCountdownPullPayoutTests.cs`, `contracts/__tests__/PlatformGameRealKernelIntegrationTests.cs`, `contracts/__tests__/PlatformGameRewardGameModelHarness.cs`, `contracts/__tests__/PlatformGameRewardGameModelInvariantTests.cs`, `contracts/__tests__/PlatformGameRewardGameSourceSecurityTests.cs`, `contracts/__tests__/PlatformGameRewardGameTests.cs`, `contracts/__tests__/PlatformRegistrySourceSecurityTests.cs`, `contracts/__tests__/PlatformRegistryTreasuryTests.cs`, `contracts/__tests__/RealKernelHarness.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `contracts/build/testnet_game_deployment.json`, `contracts/build/mainnet_game_deployment.json`, `deploy/config/platform-registry-testnet-2026-07-19.json`
- Current testnet artifact: live-artifact-match
- Failed checks: none

### PlatformDeFi

- Source files: 19
- Test files: `contracts/__tests__/AnchorBoundarySafetyTest.cs`, `contracts/__tests__/ContractSecurityRegressionTest.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/FinancialTransferSafetyTest.cs`, `contracts/__tests__/FixV_platformdefiliquidation_Tests.cs`, `contracts/__tests__/Fix_platformdefi_Tests.cs`, `contracts/__tests__/MiniAppContractFunctionalTests.cs`, `contracts/__tests__/PlatformDeFiCreditIsolationTests.cs`, `contracts/__tests__/PlatformDeFiLegacyCreditRecoveryTests.cs`, `contracts/__tests__/PlatformDeFiSelfLoanProfileTests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: `contracts/build/testnet_anchor_deployment.json`
- Current testnet artifact: live-artifact-drift
- Methods missing on current testnet deployment: abandonLoan, activateLegacyCreditRecovery, fundCapsuleYieldReserve, gasCreditLiabilityOf, getActiveLoanId, getCapsuleYieldReserve, getDirectGasCredit, getDirectNeoCredit, getFlashProviderBalance, getFlashTotalLpDeposits, getLastPriceDropTime, getLegacyGasCredit, getLegacyNeoCredit, getLendingLiquidity, getLendingProfile, getNeoGasPrice, getSingleLoanPosition, getTotalAbandonedCollateral, getTotalCapsuleFees, getTotalLendingFees, getUnclaimedFlashLoanFees, initializeLegacyCreditRecovery, isLiquidatable, legacyCreditRecoveryState, legacyCreditSnapshotHash, legacyGasCreditLiability, legacyGasCreditRows, legacyNeoCreditLiability, legacyNeoCreditRows, lendingDeposit, liquidateLoan, migrateFlashProviderBalance, neoCreditLiabilityOf, setNeoGasPrice, totalGasCreditLiability, totalNeoCreditLiability, withdrawAbandonedCollateral, withdrawCapsuleFees, withdrawCapsulePenalties, withdrawCapsuleYieldReserve, withdrawFlashLoanFees, withdrawGasCredit, withdrawLegacyGasCredit, withdrawLegacyNeoCredit, withdrawLendingFees, withdrawLendingLiquidity, withdrawNeoCredit
- Failed checks: none

### PlatformSocial

- Source files: 11
- Test files: `contracts/__tests__/ContractSecurityRegressionTest.cs`, `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/FinancialTransferSafetyTest.cs`, `contracts/__tests__/MiniAppContractFunctionalTests.cs`, `contracts/__tests__/OnNep17PaymentConventionTests.cs`, `contracts/__tests__/PlatformSocialCreditIsolationTests.cs`, `contracts/__tests__/PlatformSocialNotaryTests.cs`, `contracts/__tests__/platform-contracts-only.test.ts`
- Deployment evidence: none
- Current testnet artifact: no-deployment-record
- Failed checks: none

### PlatformVesting

- Source files: 5
- Test files: `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/OnNep17PaymentConventionTests.cs`, `contracts/__tests__/PlatformVestingTests.cs`
- Deployment evidence: none
- Current testnet artifact: not checked
- Failed checks: none

### PlatformEscrow

- Source files: 7
- Test files: `contracts/__tests__/ContractUpdateCoverageTest.cs`, `contracts/__tests__/OnNep17PaymentConventionTests.cs`, `contracts/__tests__/PlatformEscrowTests.cs`
- Deployment evidence: none
- Current testnet artifact: not checked
- Failed checks: none

## Factory Template Evidence

### FactoryNep17Token

- Standard: NEP-17
- Source files: 1
- Lifecycle tests: `contracts/__tests__/FactoryTokenTemplateTests.cs`
- Generated artifact hashes: fresh
- Boundary: Template source/build/lifecycle acceptance does not prove the current testnet Factory exposes the six-argument deployment ABI or that a funded deployment has recovered end to end.

### FactoryNep11Collection

- Standard: NEP-11
- Source files: 2
- Lifecycle tests: `contracts/__tests__/FactoryTokenTemplateTests.cs`
- Generated artifact hashes: fresh
- Boundary: Template source/build/lifecycle acceptance does not prove the current testnet Factory exposes the six-argument deployment ABI or that a funded deployment has recovered end to end.
