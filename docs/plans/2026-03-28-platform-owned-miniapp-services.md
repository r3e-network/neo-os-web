# Platform-Owned MiniApp Services Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move platform service ownership out of individual miniapps and into the shared `defineMiniApp` runtime so miniapps focus on business logic and shared platform audits enforce that contract.

**Architecture:** `MiniAppRoot` should instantiate the real `PlatformServices` once, provide it through the miniapp context, own lifecycle cleanup, and watch wallet connectivity centrally. Miniapp `main.ts` entrypoints should consume `ctx.services` instead of recreating platform services, and the layout/unified-layer audits should recognize and enforce the new platform-owned pattern.

**Tech Stack:** Vue 3, TypeScript, Node audit scripts, shared service layer in `apps/shared`

### Task 1: Lock the runtime contract with failing tests

**Files:**
- Modify: `apps/shared/test/utils.ts`
- Modify: `apps/shared/services/PlatformServices.ts`
- Create: `apps/shared/test/defineMiniApp-services.test.ts`

**Step 1: Write the failing test**
Add tests that mount a minimal miniapp via `defineMiniApp()` and assert:
- `ctx.services` exposes real service objects, not stubs
- the play area receives the same real services instance
- `services.destroy()` is called on unmount

**Step 2: Run test to verify it fails**
Run: `npm --prefix apps/shared exec vitest run test/defineMiniApp-services.test.ts`
Expected: FAIL because `defineMiniApp` currently injects stub services and does not own teardown.

**Step 3: Write minimal implementation**
Move service creation into `MiniAppRoot`, provide the real typed services through the context and play area props, and call `destroy()` on unmount.

**Step 4: Run test to verify it passes**
Run: `npm --prefix apps/shared exec vitest run test/defineMiniApp-services.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/shared/test/defineMiniApp-services.test.ts apps/shared/components/MiniAppRoot.vue apps/shared/utils/defineMiniApp.ts apps/shared/types/miniapp-context.ts
 git commit -m "refactor: make defineMiniApp own platform services"
```

### Task 2: Remove per-miniapp platform bootstrapping

**Files:**
- Modify: `apps/*/src/main.ts` for miniapps still calling `PlatformServices.create(...)`

**Step 1: Write the failing test**
Add or extend an audit test/script assertion that fails when miniapp entrypoints instantiate `PlatformServices.create(...)` directly.

**Step 2: Run test to verify it fails**
Run: `node deploy/scripts/audit_platform_unified_layers.js`
Expected: FAIL or WARN for apps still bootstrapping platform services themselves.

**Step 3: Write minimal implementation**
Replace local service creation with `const services = ctx.services;` and keep only business-specific cleanup logic in each app.

**Step 4: Run test to verify it passes**
Run: `node deploy/scripts/audit_platform_unified_layers.js`
Expected: clean summary with no per-app service bootstrap violations.

**Step 5: Commit**
```bash
git add apps/*/src/main.ts deploy/scripts/audit_platform_unified_layers.js
 git commit -m "refactor: remove miniapp-owned platform service bootstrapping"
```

### Task 3: Fix the platform layout audit to match the current runtime standard

**Files:**
- Modify: `deploy/scripts/verify_miniapp_layout_consistency.js`

**Step 1: Write the failing test**
Capture the current false positives for the Flamingo launcher apps under the defineMiniApp pattern.

**Step 2: Run test to verify it fails**
Run: `node deploy/scripts/verify_miniapp_layout_consistency.js`
Expected: FAIL listing the Flamingo apps.

**Step 3: Write minimal implementation**
Teach the audit to treat `defineMiniApp` entrypoints plus shared launcher/play-area components as valid platform-owned layout composition, not only legacy `index.vue` markers.

**Step 4: Run test to verify it passes**
Run: `node deploy/scripts/verify_miniapp_layout_consistency.js`
Expected: PASS with zero false positives.

**Step 5: Commit**
```bash
git add deploy/scripts/verify_miniapp_layout_consistency.js
 git commit -m "chore: align layout audit with defineMiniApp runtime"
```
