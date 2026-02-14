# Tx Event List Polling Deduplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove remaining duplicated `extractTxid + pollForTxEvent` patterns by using one shared transaction utility while preserving miniapp behavior.

**Architecture:** Extend shared transaction utilities with a `waitForListedEventByTransaction` helper that composes existing `extractTxid` and `pollForTxEvent`. Migrate miniapps that still do local txid extraction for event list polling to this helper. Keep app-specific event query parameters and error semantics unchanged.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, pnpm/turbo workspace builds.

### Task 1: Add shared transaction helper for list-based event polling

**Files:**
- Modify: `miniapps/shared/utils/transaction.ts`
- Test: Typecheck via `pnpm turbo typecheck --filter=@miniapps/shared`

**Step 1: Write the failing test**

Use type-level verification by introducing new helper signatures and usages in consumers (next tasks) that require the helper to exist and be typed.

**Step 2: Run test to verify it fails**

Run: `pnpm turbo typecheck --filter=miniapp-heritage-trust --filter=miniapp-red-envelope`
Expected: FAIL until helper and migrations are implemented.

**Step 3: Write minimal implementation**

Add to `miniapps/shared/utils/transaction.ts`:
- `WaitForListedEventByTransactionParams<T>` interface
- `waitForListedEventByTransaction<T>(tx, params)` function that:
  - extracts txid via `extractTxid(tx)`
  - returns `null` if missing txid
  - delegates to `pollForTxEvent({ ...params, txid })`

**Step 4: Run test to verify it passes**

Run: `pnpm turbo typecheck --filter=@miniapps/shared`
Expected: PASS.

**Step 5: Commit**

```bash
git add miniapps/shared/utils/transaction.ts
git commit -m "refactor: share tx-list event wait helper"
```

### Task 2: Migrate heritage-trust create flow to shared helper

**Files:**
- Modify: `miniapps/heritage-trust/src/pages/index/index.vue`
- Test: `pnpm turbo typecheck --filter=miniapp-heritage-trust` and `pnpm turbo run build:h5 --filter=miniapp-heritage-trust`

**Step 1: Write the failing test**

Introduce import/usage of `waitForListedEventByTransaction` and remove direct local txid handling.

**Step 2: Run test to verify it fails**

Run: `pnpm turbo typecheck --filter=miniapp-heritage-trust`
Expected: FAIL until imports and helper usage compile.

**Step 3: Write minimal implementation**

In `handleCreate`, replace:
- local `extractTxid(tx)` guard
- direct `pollForTxEvent({ txid, ... })`
with:
- `waitForListedEventByTransaction(tx, { listEvents, timeoutMs, pollIntervalMs, errorMessage })`

Preserve:
- timeout sentinel message
- event parsing logic
- status/error behavior.

**Step 4: Run test to verify it passes**

Run:
- `pnpm turbo typecheck --filter=miniapp-heritage-trust`
- `pnpm turbo run build:h5 --filter=miniapp-heritage-trust`
Expected: PASS.

**Step 5: Commit**

```bash
git add miniapps/heritage-trust/src/pages/index/index.vue
git commit -m "refactor: reuse shared tx-list event wait in heritage trust"
```

### Task 3: Migrate red-envelope envelope action waits to shared helper

**Files:**
- Modify: `miniapps/red-envelope/src/pages/index/composables/useEnvelopeActions.ts`
- Test: `pnpm turbo typecheck --filter=miniapp-red-envelope` and `pnpm turbo run build:h5 --filter=miniapp-red-envelope`

**Step 1: Write the failing test**

Replace direct txid extraction + `pollForTxEvent` dependency with helper usage.

**Step 2: Run test to verify it fails**

Run: `pnpm turbo typecheck --filter=miniapp-red-envelope`
Expected: FAIL until helper integration is complete.

**Step 3: Write minimal implementation**

Update `waitForEnvelopeEvent` to call `waitForListedEventByTransaction(tx, params)` and remove direct `extractTxid`/`pollForTxEvent` imports.

Preserve:
- event-specific `limit`
- timeout and pending-message behavior
- existing callers and control flow.

**Step 4: Run test to verify it passes**

Run:
- `pnpm turbo typecheck --filter=miniapp-red-envelope`
- `pnpm turbo run build:h5 --filter=miniapp-red-envelope`
Expected: PASS.

**Step 5: Commit**

```bash
git add miniapps/red-envelope/src/pages/index/composables/useEnvelopeActions.ts
git commit -m "refactor: reuse shared tx-list event wait in red-envelope"
```

### Task 4: Cross-miniapp safety verification

**Files:**
- Verify only.

**Step 1: Write the failing test**

N/A (verification task).

**Step 2: Run test to verify it fails**

N/A.

**Step 3: Write minimal implementation**

N/A.

**Step 4: Run test to verify it passes**

Run:
- `pnpm turbo typecheck --filter=miniapp-heritage-trust --filter=miniapp-red-envelope --filter=miniapp-on-chain-tarot --filter=miniapp-lottery`
- `pnpm turbo run build:h5 --filter=miniapp-heritage-trust --filter=miniapp-red-envelope`
- `node scripts/validate-miniapps.mjs`
Expected: PASS (warnings allowed if pre-existing and non-fatal).

**Step 5: Commit**

No new commit required; this is a gate before pushing.
