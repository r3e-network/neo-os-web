# Platform Runtime Ownership And Shared Runtime Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move miniapp service ownership into the shared platform runtime, align the miniapp runtime with the shared-mode/composable-contract direction already present in host definitions, and remove redundant per-app service bootstrapping.

**Architecture:** `defineMiniApp()` / `MiniAppRoot` should act as the platform runtime boundary: create the real `PlatformServices`, bridge service notifications/errors into the universal shell, and tear services down automatically. Miniapps should consume `ctx.services` instead of constructing their own OS layer. Audits should then enforce that miniapp entrypoints use platform-owned services rather than manual bootstrap.

**Tech Stack:** Vue 3, Vite/Vitest (`apps/shared/vitest.config.ts`), TypeScript, shared miniapp runtime in `apps/shared`, repo audit scripts in `deploy/scripts`.

### Task 1: Runtime-Owned Services In `MiniAppRoot`

**Files:**
- Modify: `apps/shared/components/MiniAppRoot.vue`
- Modify: `apps/shared/utils/defineMiniApp.ts`
- Modify: `apps/shared/types/miniapp-context.ts`
- Test: `apps/shared/test/miniapp-root.runtime.test.ts`

**Step 1: Write the failing test**

Add a Vitest integration test that mounts `MiniAppRoot` with a dummy play area and setup hook which only uses `ctx.services`.

The test must verify:
- `ctx.services.notify.success(...)` renders the universal status toast without manual `PlatformServices.create(...)`
- platform-level `EventBus.ERROR` payloads also surface through the same universal status channel

**Step 2: Run test to verify it fails**

Run:

```bash
node node_modules/vitest/vitest.mjs run --config apps/shared/vitest.config.ts apps/shared/test/miniapp-root.runtime.test.ts
```

Expected: FAIL because `MiniAppRoot` currently receives stub services from `defineMiniApp()` and does not subscribe to notification/error events.

**Step 3: Write minimal implementation**

Implement the platform runtime behavior:
- remove stub-service creation from `defineMiniApp()`
- create the real `PlatformServices` inside `MiniAppRoot`
- expose that real service registry through `MiniAppContext`
- subscribe `MiniAppRoot` to `NotificationService` and `EventBus.ERROR`
- destroy services automatically on unmount
- update `MiniAppContext.PlatformServices` typing so miniapps can use `notify`, `clipboard`, and `fmt` directly

**Step 4: Run test to verify it passes**

Run:

```bash
node node_modules/vitest/vitest.mjs run --config apps/shared/vitest.config.ts apps/shared/test/miniapp-root.runtime.test.ts
```

Expected: PASS

### Task 2: Remove Per-App OS Bootstrapping

**Files:**
- Modify: `apps/*/src/main.ts` files currently calling `PlatformServices.create(...)`
- Modify: `deploy/scripts/audit_platform_unified_layers.js`

**Step 1: Write the failing test / enforcement check**

Extend the unified-layer audit so `src/main.ts` is flagged when a miniapp manually constructs `PlatformServices`.

**Step 2: Run enforcement to verify it fails**

Run:

```bash
node deploy/scripts/audit_platform_unified_layers.js --strict
```

Expected: FAIL because many miniapps still create `PlatformServices` manually in `main.ts`.

**Step 3: Write minimal implementation**

Refactor each affected `main.ts` to:
- stop importing `PlatformServices` for construction
- use `const platformServices = ctx.services;`
- keep domain logic wiring unchanged
- remove `cleanup` handlers that only existed to destroy platform services

**Step 4: Run enforcement to verify it passes**

Run:

```bash
node deploy/scripts/audit_platform_unified_layers.js --strict
```

Expected: PASS or only non-blocking findings outside service bootstrap ownership

### Task 3: Tighten Runtime Consistency Audits

**Files:**
- Modify: `deploy/scripts/verify_miniapp_layout_consistency.js`
- Modify: `apps/neo-sign-anything/src/composables/useSignAnything.ts`
- Modify: `apps/shared/services/ChainService.ts`

**Step 1: Write the failing checks**

Use existing audit failures as the red step:
- layout consistency currently fails for Flamingo launcher miniapps
- unified-layer audit currently warns on direct wallet chain usage in `neo-sign-anything`

**Step 2: Run checks to verify they fail**

Run:

```bash
node deploy/scripts/verify_miniapp_layout_consistency.js
node deploy/scripts/audit_platform_unified_layers.js --strict
```

Expected: FAIL with Flamingo launcher false positives and `neo-sign-anything` chain-layer warning.

**Step 3: Write minimal implementation**

Implement:
- accept Flamingo launcher pages as valid universal-shell layouts
- add a signing method to `ChainService` and migrate `neo-sign-anything` off direct wallet chain calls

**Step 4: Run checks to verify they pass**

Run:

```bash
node deploy/scripts/verify_miniapp_layout_consistency.js
node deploy/scripts/audit_platform_unified_layers.js --strict
```

Expected: PASS or only informational findings

### Task 4: Full Verification

**Files:**
- Test: `apps/shared/test/miniapp-root.runtime.test.ts`
- Test: `contracts/__tests__/platform-contracts-only.test.ts`
- Test: selected host shared-mode tests in `platform/host-app/__tests__/lib/shared-mode.test.ts`

**Step 1: Run focused verification**

Run:

```bash
node node_modules/vitest/vitest.mjs run --config apps/shared/vitest.config.ts apps/shared/test/miniapp-root.runtime.test.ts
npm --prefix platform/host-app test -- --runInBand __tests__/lib/shared-mode.test.ts
node deploy/scripts/verify_miniapp_layout_consistency.js
node deploy/scripts/audit_platform_unified_layers.js --strict
```

**Step 2: Run contract hygiene check if the legacy build artifact directory has been cleaned**

Run:

```bash
node node_modules/vitest/vitest.mjs run contracts/__tests__/platform-contracts-only.test.ts
```

Expected: PASS after any stale `contracts/ServiceLayerGateway` artifact directory is removed from the repo tree.
