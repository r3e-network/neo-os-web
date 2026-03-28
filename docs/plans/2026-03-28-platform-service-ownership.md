# Platform Service Ownership Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move miniapp service instantiation/lifecycle ownership into the shared platform entry path so miniapps stop manually creating `PlatformServices` in every `main.ts`.

**Architecture:** `defineMiniApp()` and `MiniAppRoot.vue` become the composition root for real `PlatformServices`, not a stub placeholder. Miniapps receive a real `ctx.services`, and repo-level audits enforce that app entrypoints no longer instantiate platform services directly.

**Tech Stack:** Vue 3, TypeScript, Node audit scripts, repo-level shell verification

### Task 1: Add an Architecture Guardrail

**Files:**

- Create: `deploy/scripts/lib/platform_service_ownership.test.mjs`
- Modify: `deploy/scripts/audit_platform_unified_layers.js`
- Test: `deploy/scripts/lib/platform_service_ownership.test.mjs`

**Step 1: Write the failing test**

Write a node test that executes `deploy/scripts/audit_platform_unified_layers.js --strict` and expects the audit to fail while any miniapp entrypoint still contains `PlatformServices.create(...)`.

**Step 2: Run test to verify it fails**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: FAIL because the audit does not yet block direct `PlatformServices.create(...)` ownership in app entrypoints.

**Step 3: Write minimal implementation**

Extend `deploy/scripts/audit_platform_unified_layers.js` so it scans `apps/*/src/main.ts` and emits an error finding whenever app-local service construction remains.

**Step 4: Run test to verify it passes**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: PASS and the audit reports entrypoint ownership violations until the refactor is completed.

### Task 2: Make Shared Entry Path Own Real Services

**Files:**

- Modify: `apps/shared/utils/defineMiniApp.ts`
- Modify: `apps/shared/components/MiniAppRoot.vue`
- Modify: `apps/shared/types/miniapp-context.ts`
- Modify: `apps/shared/services/PlatformServices.ts`

**Step 1: Write the failing test**

Add assertions to the architecture guard test or a focused companion test that expect:

- `defineMiniApp()` no longer documents stub-only service usage
- `MiniAppRoot.vue` is responsible for creating and destroying the real `PlatformServices`
- `ctx.services` is treated as the canonical services object

**Step 2: Run test to verify it fails**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: FAIL because the shared entry path still relies on stub services and app-local instantiation.

**Step 3: Write minimal implementation**

Refactor the shared entry path so:

- `defineMiniApp.ts` stops constructing stub services
- `MiniAppRoot.vue` creates one real `PlatformServices` instance during setup
- `ctx.services` and play-area props point at that real instance
- unmount cleanup destroys platform services exactly once

**Step 4: Run test to verify it passes**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: PASS for shared-entry ownership assertions, but the full audit still fails until app entrypoints are migrated.

### Task 3: Migrate Miniapp Entrypoints to Platform-Owned Services

**Files:**

- Modify: every `apps/*/src/main.ts` file returned by `rg -l 'PlatformServices\\.create\\(' apps/*/src/main.ts`
- Test: `deploy/scripts/lib/platform_service_ownership.test.mjs`

**Step 1: Write the failing test**

Keep the same audit test from Task 1 as the gate. No new production code should land until it reports zero direct entrypoint ownership violations.

**Step 2: Run test to verify it fails**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: FAIL because app entrypoints still instantiate `PlatformServices` directly.

**Step 3: Write minimal implementation**

For each affected `apps/*/src/main.ts`:

- remove `PlatformServices` import when unused afterwards
- replace local `platformServices` creation with `const platformServices = ctx.services`
- keep domain composable wiring the same, now consuming the platform-owned services object
- remove redundant `platformServices.destroy()` cleanup where root lifecycle now owns destruction

**Step 4: Run test to verify it passes**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: PASS with zero entrypoint ownership violations.

### Task 4: Verify the Refactor End-to-End

**Files:**

- Test: `deploy/scripts/lib/platform_service_ownership.test.mjs`
- Test: `deploy/scripts/audit_platform_unified_layers.js`
- Test: representative app entrypoints and shared layer files above

**Step 1: Run focused verification**

Run: `node --test deploy/scripts/lib/platform_service_ownership.test.mjs`
Expected: PASS

**Step 2: Run the audit directly**

Run: `node deploy/scripts/audit_platform_unified_layers.js --strict`
Expected: exit 0 for service-ownership findings

**Step 3: Spot-check migrated entrypoints**

Run: `rg -n 'PlatformServices\\.create\\(' apps/*/src/main.ts`
Expected: no app entrypoint matches

**Step 4: Commit**

```bash
git add deploy/scripts/audit_platform_unified_layers.js \
  deploy/scripts/lib/platform_service_ownership.test.mjs \
  apps/shared/utils/defineMiniApp.ts \
  apps/shared/components/MiniAppRoot.vue \
  apps/shared/types/miniapp-context.ts \
  apps/shared/services/PlatformServices.ts \
  apps/*/src/main.ts
git commit -m "refactor: move miniapp service ownership into shared entry path"
```
