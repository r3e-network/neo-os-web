# Neo Express Deploy Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make neo-express-backed contract runtime tests deploy contracts reliably instead of skipping with insufficient GAS.

**Architecture:** Investigate neo-express deploy mechanics first, then add a narrow regression test around deployment behavior and patch the Go test harness with the smallest fix that makes deployment deterministic. Keep scope limited to the contract test harness and avoid unrelated repo changes.

**Tech Stack:** Go test harness, neo-express CLI, .NET tooling, contract build artifacts.

**Investigation update (2026-03-06):** In this environment, fresh NeoExpress chains reproduce the deploy fault consistently for `PriceFeed` and `MiniAppTemplate.Lottery`. `neoxp show balances` is misleading for these fresh offline chains; direct native-contract inspection and deploy behavior show no usable spendable GAS for contract deployment, so deploys fault with `Insufficient GAS` before the new runtime assertions can execute. This remains a real blocker for NeoExpress-backed runtime coverage and should be solved in the harness or by switching to a different execution framework.

**Validation update (2026-03-06):** The fresh-chain deploy blocker is fixed in the current harness. `test/contract/neoexpress_test.go` now fast-forwards fresh NeoExpress chains by 150 blocks so the spendable `node1` signer accrues deployable GAS, and the harness normalizes NeoExpress `genesis` wallet lookups/deploy calls onto that spendable signer for CLI-backed flows. Verified with `go test -count=1 -v ./test/contract -run TestNeoExpressFreshChainCanDeployPriceFeed` and `go test -count=1 -v ./test/contract -run "TestContractDeploymentIntegration|TestPlatformContractsNeoExpressSmoke"`.

**Remaining limitation (2026-03-06):** NeoExpress named-wallet calls still do not provide spendable NEO for the Governance staking flow. `test/contract/platform_contracts_integration_test.go` therefore skips that final governance-only section when NeoExpress returns `NEO transfer failed`, while the rest of the platform smoke coverage continues to run and pass.

### Task 1: Reproduce the deploy failure

**Files:**
- Inspect: `test/contract/neoexpress_test.go`
- Inspect: `test/contract/miniapp_factory_v2_test.go`
- Inspect: `test/contract/miniapp_template_lottery_test.go`

**Step 1: Reproduce with the smallest command**

Run: `~/.dotnet/tools/neoxp contract deploy -j -i <temp.neo-express> contracts/build/PriceFeed.nef genesis`
Expected: fail with an insufficient GAS-related error.

**Step 2: Capture surrounding state**

Run: `~/.dotnet/tools/neoxp show balances -i <temp.neo-express> genesis`
Run: `~/.dotnet/tools/neoxp policy get -i <temp.neo-express>`
Expected: balance is high enough, so the failure points to deploy mechanics rather than wallet funding.

### Task 2: Isolate the root cause

**Files:**
- Inspect: `test/contract/neoexpress_test.go`

**Step 1: Compare deploy invocation variants**

Try wallet/account variants and supported flags from `neoxp contract deploy --help`.

**Step 2: Compare against working patterns**

Search the repo for any prior neo-express deploy flows or policy overrides.

**Step 3: Form one hypothesis**

Document a single root-cause theory before patching code.

### Task 3: Add a failing regression test

**Files:**
- Modify: `test/contract/neoexpress_test.go`
- Test: `test/contract/contract_test.go` or a focused neo-express test file under `test/contract`

**Step 1: Write one failing test**

Add a focused test that reproduces the deploy failure through the harness.

**Step 2: Run it to verify red**

Run: `go test -count=1 -v ./test/contract -run <new-test>`
Expected: FAIL for the specific deployment reason.

### Task 4: Patch the harness minimally

**Files:**
- Modify: `test/contract/neoexpress_test.go`

**Step 1: Implement the narrow fix**

Adjust neo-express setup or deploy invocation based on the proven root cause.

**Step 2: Run the focused test to verify green**

Run: `go test -count=1 -v ./test/contract -run <new-test>`
Expected: PASS.

### Task 5: Verify the affected contract suite

**Files:**
- Verify: `test/contract/miniapp_factory_v2_test.go`
- Verify: `test/contract/miniapp_template_lottery_test.go`
- Verify: `contracts/__tests__/NeoContracts.Tests.csproj`

**Step 1: Run targeted Go contract tests**

Run: `go test -count=1 -v ./test/contract -run 'TestContractCompilation/(MiniAppFactoryV2)|TestMiniAppFactoryV2Contract|TestMiniAppTemplateLotteryContract'`
Expected: PASS without deploy skips.

**Step 2: Re-run contract build if needed**

Run: `./contracts/build.sh`
Expected: exit 0.

**Step 3: Re-run C# structural tests**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj -v q`
Expected: PASS.
