# Repo Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Raise the repo from buildable to production-ready by closing the highest-risk correctness, runtime-safety, and maintainability gaps across web apps, contracts, and backend services.

**Architecture:** Work in vertical slices that each end with a verifiable production gate. Start with configuration/runtime safety, then strengthen contract behavior coverage, then tighten service boundary handling and deployment consistency. Prefer small, test-backed changes over broad rewrites.

**Tech Stack:** Next.js 15, TypeScript/Vitest, Go services and tests, .NET/Neo smart contracts, shell build scripts.

**Status update (2026-03-06):** Focused web env tests/build/typecheck, host-app build, focused Go boundary tests, contract warning/build gates, `npm test --silent`, `dotnet test contracts/__tests__/NeoContracts.Tests.csproj -v q`, and `go test ./...` are green in this workspace. NeoExpress fresh-chain deployment no longer fails with `Insufficient GAS`; the remaining environment-specific limitation is spendable NEO on named NeoExpress wallets, so the Governance staking portion of `test/contract/platform_contracts_integration_test.go` now skips explicitly when NeoExpress reports `NEO transfer failed`.

**Next slice:** Replace the remaining NeoExpress Governance skip with an RPC-backed signer flow that can spend consensus-held NEO or pre-seed a dedicated spendable NEO holder. Start with `test/contract/neoexpress_test.go` and `test/contract/platform_contracts_integration_test.go`, then verify with `go test -count=1 -v ./test/contract -run TestPlatformContractsNeoExpressSmoke` and `go test ./...`.

### Task 1: Unify web environment access and runtime validation

**Files:**
- Inspect: `platform/admin-console/src/lib/env.ts`
- Inspect: `platform/admin-console/src/lib/api-client.ts`
- Inspect: `platform/host-app/next.config.js`
- Inspect: `platform/host-app/src/**/*.{ts,tsx,js}`
- Inspect: `platform/edge/functions/**/*.{ts,tsx}`
- Test: `platform/admin-console/src/lib/__tests__/env.test.ts`

**Step 1: Inventory env access patterns**

Run: `rg -n "process\.env|getEnv\(" platform/admin-console platform/host-app platform/edge -g'*.ts' -g'*.tsx' -g'*.js'`
Expected: a complete list of direct env usage sites grouped by app.

**Step 2: Add failing tests for one inconsistent path**

Add or extend one focused test per app where env access still happens too early or too loosely.

**Step 3: Patch the narrowest shared pattern**

Move remaining eager env reads behind helpers so build-time imports stay side-effect free and runtime-required secrets fail only at the call sites that need them.

**Step 4: Verify web gates**

Run: `npm --prefix platform/admin-console run test -- --run src/lib/__tests__/env.test.ts src/lib/__tests__/api-routes.test.ts src/lib/__tests__/api-client.test.ts src/lib/__tests__/api-client-extended.test.ts`
Run: `npm --prefix platform/admin-console run build`
Run: `npm --prefix platform/admin-console run typecheck`
Run: `npm --prefix platform/host-app run build`
Expected: all pass with no new env-related warnings or build-time crashes.

### Task 2: Replace structural-only contract checks with runtime behavior checks

**Files:**
- Inspect: `test/contract/neoexpress_test.go`
- Inspect: `test/fairy/fairy.go`
- Inspect: `test/fairy/miniapp_factory_v2_test.go`
- Inspect: `test/fairy/miniapp_template_lottery_test.go`
- Inspect: `contracts/__tests__/MiniAppFactoryV2Test.cs`
- Inspect: `contracts/__tests__/MiniAppTemplateBaseTest.cs`

**Step 1: Identify the highest-value behavioral assertions**

Pick one factory flow and one template flow that are currently verified only by source shape.

**Step 2: Write one failing runtime test per flow**

Run: `go test -count=1 -v ./test/fairy -run 'TestMiniAppFactoryV2Contract|TestMiniAppTemplateLotteryContract'`
Expected: at least one missing or weak behavior case is exposed by the new assertions.

**Step 3: Patch runtime harness or contract code minimally**

Implement only what the new runtime checks prove is missing.

**Step 4: Re-run targeted runtime tests**

Run: `go test -count=1 -v ./test/fairy -run 'TestMiniAppFactoryV2Contract|TestMiniAppTemplateLotteryContract'`
Expected: pass or cleanly skip only when the external runtime is unavailable.

### Task 3: Harden Go service boundary errors and timeouts

**Files:**
- Inspect: `services/requests/nitro/clients.go`
- Inspect: `services/requests/nitro/executor.go`
- Inspect: `services/datafeed/nitro/handlers.go`
- Inspect: `services/gasbank/nitro/handlers.go`
- Inspect: `infrastructure/service/healthcheck.go`
- Test: `services/requests/nitro/clients_test.go`
- Test: `services/requests/nitro/executor_test.go`
- Test: `services/datafeed/nitro/handlers_test.go`
- Test: `services/gasbank/nitro/handlers_test.go`

**Step 1: Map external call boundaries**

Run: `rg -n "http\.Client|context\.WithTimeout|fetch|Do\(|NewRequest" services infrastructure -g'*.go'`
Expected: a list of service edges that need consistent timeout and error shaping.

**Step 2: Add one failing regression test for the weakest boundary**

Choose the path that currently leaks transport details or misses timeout classification.

**Step 3: Introduce a shared error/timeout pattern**

Keep it local to the involved package unless duplication clearly justifies a common helper.

**Step 4: Verify focused Go packages**

Run: `go test ./services/requests/nitro ./services/datafeed/nitro ./services/gasbank/nitro ./infrastructure/service`
Expected: pass with clearer, deterministic boundary behavior.

### Task 4: Keep contract builds warning-free

**Files:**
- Inspect: `contracts/MiniAppTemplates/MiniAppTemplate.Base.cs`
- Inspect: `contracts/MiniAppTemplates/Template.*.cs`
- Test: `contracts/__tests__/MiniAppTemplateWarningsTest.cs`

**Step 1: Re-run the focused build gate**

Run: `dotnet build contracts/MiniAppTemplates/MiniAppTemplates.csproj -v q`
Expected: `0 Warning(s)` and `0 Error(s)`.

**Step 2: Re-run the structural guard tests**

Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj -v q`
Expected: pass.

**Step 3: Re-run the full contracts sweep**

Run: `./contracts/build.sh`
Expected: exit 0 without compiler warnings.

### Task 5: Re-run repo release gates and record status

**Files:**
- Update: `docs/plans/2026-03-06-repo-hardening-plan.md`
- Update: `RELEASE_NOTES_v1.0.0.md` (only if user-facing release quality changed materially)

**Step 1: Run broad validation**

Run: `go test ./...`
Run: `npm test --silent`
Run: `dotnet test contracts/__tests__/NeoContracts.Tests.csproj -v q`
Expected: all green.

**Step 2: Capture remaining known risks**

Document anything still structural, optional, skipped, or environment-dependent.

**Step 3: Hand off the next slice**

Summarize the next highest-risk task with exact commands and files.
