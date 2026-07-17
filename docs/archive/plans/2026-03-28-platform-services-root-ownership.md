# Platform Services Root Ownership Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the miniapp platform shell own the real `PlatformServices` instance and lifecycle so miniapps consume one platform-managed service registry instead of constructing local registries in each app.

**Architecture:** Move `PlatformServices` creation from individual `apps/*/src/main.ts` files into `MiniAppRoot.vue`, inject the real services through `defineMiniApp()`, and register load/cleanup through `LifecycleService`. Then simplify representative miniapp entry points to use `ctx.services` directly and add regression coverage for the new root-owned runtime contract.

**Tech Stack:** Vue 3, TypeScript, shared miniapp runtime in `apps/shared`, repo-level node scripts, existing miniapp entrypoints under `apps/*`.

### Task 1: Lock The Shared Runtime Contract With Tests

**Files:**
- Create: `test/layering/define-miniapp-runtime.test.mjs`
- Modify: `package.json`

**Step 1: Write the failing test**

```js
test("defineMiniApp runtime creates one real platform service registry for the root", async () => {
  // Assert MiniAppRoot/defineMiniApp no longer document or rely on stub services.
});

test("miniapp context typing/runtime surface includes notify, clipboard, and lifecycle-owned teardown", async () => {
  // Assert the shared runtime files expose the real service surface.
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: FAIL because the current runtime still creates stub services and the type surface still describes them as placeholders.

**Step 3: Write minimal implementation**

Implement the runtime changes in:
- `apps/shared/utils/defineMiniApp.ts`
- `apps/shared/components/MiniAppRoot.vue`
- `apps/shared/types/miniapp-context.ts`
- `apps/shared/services/PlatformServices.ts`

**Step 4: Run test to verify it passes**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/layering/define-miniapp-runtime.test.mjs package.json apps/shared/utils/defineMiniApp.ts apps/shared/components/MiniAppRoot.vue apps/shared/types/miniapp-context.ts apps/shared/services/PlatformServices.ts
git commit -m "refactor: let miniapp root own platform services"
```

### Task 2: Migrate Miniapp Entry Points Off Local Service Registries

**Files:**
- Modify: representative `apps/*/src/main.ts` files that still call `PlatformServices.create(...)`
- Test: `test/layering/define-miniapp-runtime.test.mjs`

**Step 1: Write the failing test**

```js
test("representative miniapps consume ctx.services instead of constructing PlatformServices manually", async () => {
  // Check a focused set of app entrypoints that currently instantiate PlatformServices.
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: FAIL because the selected app entrypoints still import/create `PlatformServices`.

**Step 3: Write minimal implementation**

Simplify selected entry points to:
- remove `PlatformServices` imports
- use `ctx.services` (typed as the shared runtime service surface)
- remove duplicated `cleanup: () => platformServices.destroy()` when root lifecycle already owns teardown

Start with high-signal apps:
- `apps/oracle-compute-lab/src/main.ts`
- `apps/red-envelope/src/main.ts`
- `apps/fogplay/src/main.ts`
- `apps/daily-checkin/src/main.ts`

**Step 4: Run test to verify it passes**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/layering/define-miniapp-runtime.test.mjs apps/oracle-compute-lab/src/main.ts apps/red-envelope/src/main.ts apps/fogplay/src/main.ts apps/daily-checkin/src/main.ts
git commit -m "refactor: consume root-owned platform services in flagship miniapps"
```

### Task 3: Update Platform Audits To Check The Real Runtime Entry Point

**Files:**
- Modify: `deploy/scripts/audit_platform_unified_layers.js`
- Modify: `deploy/scripts/verify_miniapp_layout_consistency.js`
- Test: `test/layering/define-miniapp-runtime.test.mjs`

**Step 1: Write the failing test**

```js
test("platform audits inspect current runtime entrypoints instead of stale legacy page files", async () => {
  // Assert audits understand defineMiniApp/main.ts and PlayArea-based runtime.
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: FAIL because audits still anchor on `src/pages/index/index.vue`.

**Step 3: Write minimal implementation**

Update audits to:
- treat `src/main.ts` + `src/PlayArea.vue` as the canonical runtime path when present
- keep legacy `src/pages/index/index.vue` support only as fallback
- detect direct shared-composable usage in current entrypoints

**Step 4: Run test to verify it passes**

Run: `node --test test/layering/define-miniapp-runtime.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add test/layering/define-miniapp-runtime.test.mjs deploy/scripts/audit_platform_unified_layers.js deploy/scripts/verify_miniapp_layout_consistency.js
git commit -m "test: align platform audits with defineMiniApp runtime"
```
