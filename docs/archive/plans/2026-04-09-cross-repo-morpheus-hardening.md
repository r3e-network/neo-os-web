# Cross-Repo Morpheus Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Morpheus the canonical source of public integration metadata, stop leaking validation secrets through stdout, and align neo-miniapps-platform plus neo-abstract-account with generated Morpheus registry defaults.

**Architecture:** `neo-morpheus-oracle` exports a normalized public registry plus a split public/secret workspace validation context. Consumer repos keep checked-in generated modules derived from the Morpheus export so runtime defaults stay local, deterministic, and reviewable without introducing sibling-repo runtime coupling.

**Tech Stack:** Node.js, bash, Jest, Node test runner, TypeScript, ESM.

### Task 1: Repair and lock Morpheus registry export behavior

**Files:**
- Modify: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/lib-public-network-registry.mjs`
- Modify: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/export-public-network-registry.mjs`
- Test: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/export-public-network-registry.test.mjs`

**Step 1: Write or keep the failing test**

Use `scripts/export-public-network-registry.test.mjs` to assert the normalized mainnet/testnet registry surface.

**Step 2: Run test to verify it fails or protects behavior**

Run: `node --test scripts/export-public-network-registry.test.mjs`

**Step 3: Implement minimal export logic**

Load canonical network JSON plus supplemental deployment hashes, normalize URLs and contract/domain fields, and support optional `--output`.

**Step 4: Run test to verify it passes**

Run: `node --test scripts/export-public-network-registry.test.mjs`

### Task 2: Split public workspace context from secret material

**Files:**
- Modify: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/lib-workspace-validation-context.mjs`
- Modify: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/resolve-workspace-validation-context.mjs`
- Test: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/resolve-workspace-validation-context.test.mjs`

**Step 1: Strengthen the failing test**

Ensure the test proves secrets are absent from stdout and that the private env file contains raw dotenv values only when explicitly requested.

**Step 2: Run test to verify it fails**

Run: `node --test scripts/resolve-workspace-validation-context.test.mjs`

**Step 3: Implement minimal fix**

Keep secret values out of `publicContext`, avoid treating missing env key names as literal secrets, and write a `0600` secret env file only behind `--write-secret-env-file`.

**Step 4: Run tests to verify they pass**

Run: `node --test scripts/export-public-network-registry.test.mjs scripts/resolve-workspace-validation-context.test.mjs`

### Task 3: Update cross-repo validation scripts to consume private env files

**Files:**
- Modify: `/home/neo/git/neo-morpheus-oracle/.worktrees/cross-repo-hardening/scripts/run_workspace_live_validation.sh`
- Modify: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/deploy/scripts/verify_cross_repo_testnet.sh`

**Step 1: Add minimal behavior checks indirectly through existing tests**

Rely on the Morpheus tests plus later live-validation script reads for regression coverage.

**Step 2: Implement minimal fix**

Materialize the secret env file once, source it privately, and read only public non-secret fields from JSON stdout.

**Step 3: Run targeted verification**

Run script help or static shell validation as appropriate:
- `bash -n scripts/run_workspace_live_validation.sh`
- `bash -n deploy/scripts/verify_cross_repo_testnet.sh`

### Task 4: Move neo-miniapps-platform onto generated Morpheus registry defaults

**Files:**
- Create: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/apps/shared/constants/generated-morpheus-registry.ts`
- Modify: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/apps/shared/constants/rpc.ts`
- Modify: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/.github/workflows/ci.yml`
- Test: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/platform/host-app/__tests__/lib/external-integration-registry.test.ts`
- Test: `/home/neo/git/neo-miniapps-platform/.worktrees/cross-repo-hardening/deploy/scripts/lib/ci_workflow.test.mjs`

**Step 1: Keep the failing tests**

Use the registry and CI tests as the red tests.

**Step 2: Run tests to verify they fail**

Run:
- `npm --prefix platform/host-app test -- --runInBand __tests__/lib/external-integration-registry.test.ts`
- `node --test deploy/scripts/lib/ci_workflow.test.mjs`

**Step 3: Implement minimal fix**

Check in the generated registry module from Morpheus data, derive external integration defaults from it, and make CI install Node dependencies plus execute real Node tests.

**Step 4: Run tests to verify they pass**

Run:
- `npm --prefix platform/host-app test -- --runInBand __tests__/lib/external-integration-registry.test.ts`
- `node --test deploy/scripts/lib/ci_workflow.test.mjs`

### Task 5: Move neo-abstract-account onto generated Morpheus registry defaults

**Files:**
- Create: `/home/neo/git/neo-abstract-account/.worktrees/cross-repo-hardening/frontend/src/config/generatedMorpheusRegistry.js`
- Modify: `/home/neo/git/neo-abstract-account/.worktrees/cross-repo-hardening/frontend/src/config/runtimeConfig.js`
- Modify: `/home/neo/git/neo-abstract-account/.worktrees/cross-repo-hardening/frontend/api/morpheus-base.js`
- Test: `/home/neo/git/neo-abstract-account/.worktrees/cross-repo-hardening/frontend/tests/morpheusRegistryRuntime.test.js`

**Step 1: Keep the failing test**

Use `frontend/tests/morpheusRegistryRuntime.test.js` as the red test.

**Step 2: Run test to verify it fails**

Run: `node --test tests/morpheusRegistryRuntime.test.js`

**Step 3: Implement minimal fix**

Derive AA runtime defaults and Morpheus base URLs from the generated registry while preserving explicit env overrides.

**Step 4: Run tests to verify they pass**

Run:
- `node --test tests/morpheusRegistryRuntime.test.js`
- `node --test tests/runtimeConfig.test.js tests/morpheusApiProxy.test.js tests/operationsRuntime.test.js`

### Task 6: Cross-repo verification and architecture review

**Files:**
- Review output only

**Step 1: Run verification**

Run:
- `node --test scripts/export-public-network-registry.test.mjs scripts/resolve-workspace-validation-context.test.mjs`
- `npm --prefix platform/host-app test -- --runInBand __tests__/lib/morpheus-endpoints.test.ts __tests__/lib/external-integration-registry.test.ts`
- `node --test deploy/scripts/lib/ci_workflow.test.mjs`
- `node --test tests/runtimeConfig.test.js tests/morpheusApiProxy.test.js tests/operationsRuntime.test.js tests/morpheusRegistryRuntime.test.js`

**Step 2: Review Chainlink lessons**

Compare current Morpheus architecture against current Chainlink services and patterns, especially CRE-style workflow orchestration, Automation/Keeper semantics, registry discipline, and risk controls while preserving TEE-based execution.

**Step 3: Summarize residual risks**

Document what remains missing for production readiness after the code changes land.
