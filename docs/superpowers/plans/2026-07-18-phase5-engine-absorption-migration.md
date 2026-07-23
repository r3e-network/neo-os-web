# Phase 5: Engine Absorption Migration (Clone Family → platform-game) — Runbook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 11 TEE skill-game clone contracts (8,907 LOC, 96.8% identical) onto the shared `platform-game` engine + private kernel, verify each with a live on-chain settle, and decommission the per-app contracts — the v2 estate's first real absorption cohort.

**Preconditions already satisfied (verified 2026-07-18):**
- Private kernel live at `0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35` (OR-D-03-fixed source, 70-method ABI); game.session module registered.
- PlatformGame `0xc75b181b…` oracle repointed to the private kernel; RewardGame settle loop proven on-chain ×3 (`live_validate_rewardgame_settle.mjs`).
- Absorption descriptor manifest: `deploy/config/rewardgame-absorption-manifest.json` (per-app limitMs/minSolveMs/targetScore; entry/reward/dailyCap/undoPenalty/settleGrace all == engine defaults).
- Framework surfaces ready: `framework/platform-game-surface.ts` (27 tests), `framework/registry-surface.ts` (11 tests), `PLATFORM_SHARED_CONTRACTS` in `apps/shared/constants/rpc.ts`.
- 6/12 game-logic engines single-sourced into the worker with parity goldens (sudoku/snake/game2048/merge/jump/arrow).
- Operator WIF = registry admin = engine admin = kernel admin/updater/verifier; funded (73k NEO / 112k GAS).

**Blocking precondition (external time):** PlatformRegistry engine row for `platform-game` becomes live only after the pending timelocks execute (mature 2026-07-18T10:48:51Z; scheduled execution task `01KXRR8JRV4DP24MX27VSRXVQ7` fires 19:05 CST and also runs wire-engine + full-loop + cohort-0 lite registration of all 77 apps).

**Tech stack:** Go deploy scripts (`-tags=scripts`), live_rpc.mjs harness pattern, morpheus nitro-worker (session service), esbuild engine sync pipeline.

---

## Task 1: Point the TEE session service at the private kernel (ops config)

**Files:**
- Modify: morpheus worker deployment env (nitro compose/systemd — operator lane), NOT code
- Reference: `workers/nitro-worker/src/platform/allowlist.js:157` (kernel hash from `CONTRACT_MORPHEUS_ORACLE_HASH` env)

- [ ] **Step 1:** For the testnet session worker, set `CONTRACT_MORPHEUS_ORACLE_HASH=0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35` (testnet profile) + `MORPHEUS_RELAYER_ENCLAVE_FULFILL=1` (required so `random.generate`/session fulfill uses the enclave lane under the new fail-closed guard). Restart worker; confirm `/session/start|step|finalize` respond.
- [ ] **Step 2:** Register + grant each migrating appId on the private kernel (callbackContract=PlatformGame) — re-run `PRIVATE_KERNEL_ACTION=wire PRIVATE_KERNEL_APP_IDS=<csv>` (idempotent; add all 11: aim-master, color-clash, curve-arrow, flappy-dash, game-2048, jump-rush, merge-kingdom, pet-potion, sheep-solitaire, snake-bounty, sudoku).
- [ ] **Step 3:** Verify with `PRIVATE_KERNEL_ACTION=verify` — module row + each app row granted.

## Task 2: Attach the pilot app (snake-bounty) to the engine

**Files:**
- Uses: `deploy/scripts/deploy_platform_registry.go` (or a small attach script modeled on it)
- Uses: `deploy/config/rewardgame-absorption-manifest.json` (descriptor sets)

- [ ] **Step 1:** After the engine row is live (cron output confirms `registerEngine` executed + `setRegistry` wired), full-register `snake-bounty` on the registry with engineId `platform-game` (registerAppByPlatform or upgrade the cohort-0 lite row) with the manifest's descriptor set for snake: `limitMs0..2=180000/300000/600000, minSolveMs0..2=20000/40000/60000, targetScore0..2=10/20/35` (keys `platform-game:<param>` pushed via activateApp).
- [ ] **Step 2:** Read back: registry `getApp(snake-bounty)` shows engineId + descriptor copy; engine `getGameType(snake-bounty)==5`; economics row matches the manifest (limitMs/targetScore via a read harness).
- [ ] **Step 3:** Kernel settle verification for snake-bounty: clone `live_validate_rewardgame_settle.mjs` with `APP="snake-bounty"` (engine ABI is appId-first clone-verbatim; the private kernel maps appId→snake logic via the session service). Run the full loop to a winning settle; assert `Solved` event + credit + pool math.

## Task 3: Batch-attach the remaining 10 kernel-lane clones

Same shape as Task 2, driven by the absorption manifest (one attach script looping over the manifest's `apps` map, skipping jump-rush and sheep-solitaire which need Task 4 first): color-clash, curve-arrow, flappy-dash, game-2048, merge-kingdom, pet-potion, sudoku, aim-master.

- [ ] **Step 1:** Batch attach + descriptor push; read-back per app.
- [ ] **Step 2:** Per-app settle verification (clone settle harness per appId; flappy/aim settle with CURRENT rules — see Task 4 decision).
- [ ] **Step 3:** Frontend migration per app: `neo-manifest.json` contracts.testnet → moduleId `platform-game` mode `shared` (delete the per-app hash), production-safety pins updated (e.g. `color-clash.production-safety.test.ts` pins the old oracle/contract), rebuild, a11y spot re-audit, `test:miniapps` per app.

## Task 4: TEE-direct generation (jump-rush, sheep-solitaire) + rule-drift decision

- [ ] **Step 1 (decision — product):** flappy/aim/sheep run FROZEN OLD RULES in the enclave while their TS clients evolved (audit §5). Options: (a) absorb upstream NEW rules (re-deal + re-capture goldens; changes settlement behavior — recommended with migration), (b) freeze rules and roll back clients. Record the decision here before touching these three.
- [ ] **Step 2:** jump-rush/sheep-solitaire settle semantics are completion-based (targetScore=[1,1,1]); their TEE session logic must move onto the kernel game.session lane (they currently use BindPuzzle + on-chain ECDSA — the pre-kernel generation). Port their session wrappers (nitro-worker) to the kernel lane with parity goldens.
- [ ] **Step 3:** Attach + settle-verify both; then frontend migration as in Task 3 Step 3.

## Task 5: Decommission the clone contracts

- [ ] **Step 1:** After all 11 apps settle-verify on the engine and their frontends run shared-mode: delete `contracts/MiniApp{AimMaster,ColorClash,CurveArrow,FlappyDash,Game2048,JumpRush,MergeKingdom,PetPotion,SheepSolitaire,SnakeBounty,Sudoku}/` (~8,907 LOC) + their build artifacts + references (build.sh roster, test files that pin per-app NEFs — move behavioral coverage to the engine suites).
- [ ] **Step 2:** Full gates: `test:contracts` (576+), `test:shared`, `test:framework`, `test:miniapps`, verify:repo.
- [ ] **Step 3:** Update the census doc (`docs/archive/claudedocs/contract-estate-census-*.md`) marking the clone family absorbed; record the decommission in the audit report.

## Global constraints

- All chain writes: dry-run first, then `CONFIRM_*=I_UNDERSTAND_THIS_WRITES_CHAIN`; operator WIF via env only.
- Node-lag discipline: after every confirm, poll reads or extract from confirmation events (the multisig harness race).
- Every descriptor value from `deploy/config/rewardgame-absorption-manifest.json` — no hand-typed economics.
- No git mutations without explicit user approval.
