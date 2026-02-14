# Txid Flow Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce transaction-flow duplication by removing redundant txid extraction patterns while preserving all existing behavior in miniapp payment and event-confirmation flows.

**Architecture:** Keep all existing miniapp business behavior intact and only simplify mechanical transaction-id handling. Reuse shared helpers (`extractTxid`, `pollForTxEvent`, `usePaymentFlow`) and remove unnecessary local wrapper variables/casts. Validate with repo miniapp validation plus targeted typecheck/build filters.

**Tech Stack:** Vue 3, TypeScript, pnpm/turbo, shared miniapp composables/utilities.

### Task 1: Finalize pending txid direct-access cleanup for payment-flow invoke responses

**Files:**
- Modify: `miniapps/daily-checkin/src/composables/useCheckinContract.ts`
- Modify: `miniapps/ex-files/src/pages/index/composables/useExFiles.ts`
- Modify: `miniapps/graveyard/src/composables/useGraveyardActions.ts`
- Modify: `miniapps/million-piece-map/src/composables/useMapInteractions.ts`
- Modify: `miniapps/on-chain-tarot/src/pages/index/index.vue`

**Step 1: Verify pending mechanical diff is limited to txid extraction simplification**

Run: `git diff -- miniapps/daily-checkin/src/composables/useCheckinContract.ts miniapps/ex-files/src/pages/index/composables/useExFiles.ts miniapps/graveyard/src/composables/useGraveyardActions.ts miniapps/million-piece-map/src/composables/useMapInteractions.ts miniapps/on-chain-tarot/src/pages/index/index.vue`
Expected: only `extractTxid(tx)` replacements with `tx.txid` and import cleanup.

**Step 2: Verify this slice still passes targeted checks**

Run: `node scripts/validate-miniapps.mjs`
Expected: validation passes.

Run: `pnpm turbo typecheck --filter=miniapp-dailycheckin --filter=miniapp-millionpiecemap --filter=miniapp-exfiles --filter=miniapp-graveyard --filter=miniapp-onchaintarot`
Expected: all selected typechecks pass.

### Task 2: Remove redundant tx-result wrapper variables around `extractTxid`

**Files:**
- Modify: `miniapps/neo-gacha/src/composables/useGachaPublish.ts`
- Modify: `miniapps/neo-gacha/src/composables/useGachaPlay.ts`
- Modify: `miniapps/coin-flip/src/pages/index/composables/useCoinFlipGame.ts`

**Step 1: Write the failing test/check target**

Use a static check target: no temporary `Record<string, unknown> | undefined` tx wrapper variables used only for `extractTxid` in these files.

**Step 2: Run check to confirm baseline has the redundant wrappers**

Run: `rg "as unknown as Record<string, unknown> \| undefined" miniapps/neo-gacha/src/composables/useGachaPublish.ts miniapps/neo-gacha/src/composables/useGachaPlay.ts miniapps/coin-flip/src/pages/index/composables/useCoinFlipGame.ts`
Expected: existing matches found.

**Step 3: Write minimal implementation**

Inline transaction extraction directly:

```ts
const txid = extractTxid(tx);
```

and remove temporary wrapper variables.

**Step 4: Run check to verify cleanup**

Run: `rg "as unknown as Record<string, unknown> \| undefined" miniapps/neo-gacha/src/composables/useGachaPublish.ts miniapps/neo-gacha/src/composables/useGachaPlay.ts miniapps/coin-flip/src/pages/index/composables/useCoinFlipGame.ts`
Expected: no matches.

### Task 3: Verify end-to-end and commit

**Files:**
- Modify: all files from Task 1 + Task 2

**Step 1: Run verification commands**

Run: `node scripts/validate-miniapps.mjs`
Expected: pass.

Run: `pnpm turbo typecheck --filter=miniapp-dailycheckin --filter=miniapp-millionpiecemap --filter=miniapp-exfiles --filter=miniapp-graveyard --filter=miniapp-onchaintarot --filter=miniapp-neo-gacha --filter=miniapp-coinflip`
Expected: pass.

Run: `pnpm turbo run build:h5 --filter=miniapp-dailycheckin --filter=miniapp-millionpiecemap --filter=miniapp-exfiles --filter=miniapp-graveyard --filter=miniapp-onchaintarot --filter=miniapp-neo-gacha --filter=miniapp-coinflip`
Expected: pass.

**Step 2: Commit**

Run:

```bash
git add miniapps/daily-checkin/src/composables/useCheckinContract.ts \
  miniapps/ex-files/src/pages/index/composables/useExFiles.ts \
  miniapps/graveyard/src/composables/useGraveyardActions.ts \
  miniapps/million-piece-map/src/composables/useMapInteractions.ts \
  miniapps/on-chain-tarot/src/pages/index/index.vue \
  miniapps/neo-gacha/src/composables/useGachaPublish.ts \
  miniapps/neo-gacha/src/composables/useGachaPlay.ts \
  miniapps/coin-flip/src/pages/index/composables/useCoinFlipGame.ts

git commit -m "refactor: simplify txid extraction flow across miniapps"
```

Expected: one commit containing only mechanical txid-flow simplification changes.
