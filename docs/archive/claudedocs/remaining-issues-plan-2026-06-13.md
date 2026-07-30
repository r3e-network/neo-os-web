The findings line up with the live state. The duplicate exports are confirmed (line 7 local + line 41 re-export for `RESULT_ENVELOPE_VERSION`; line 91 local + line 111 re-export for `PUBLIC_RUNTIME_DISCOVERY_LINKS`), the CoinFlip template + build NEF exist, `dotnet` is present but `nccs` is not on PATH. I have enough to produce the plan without further verification (the triage was read-only and thorough).

# EXECUTION PLAN — Miniapp + Oracle Deferred-Issue Closeout

Triaged 13 findings. Net allocation: **3 FIX NOW**, **5 NEEDS USER DECISION**, **5 NOT WORTH FIXING (current honest state is correct)**.

Ruthless framing: only ONE finding (`dice-game`) is both a real defect AND fully closeable up to a clean software+testnet boundary. The other "fixes" are either trivial (oracle dup-export) or stale-premise no-ops. Everything that spends real mainnet value or reuses the leaked NR3E4D8N key on mainnet is gated. Several "degraded" items are infra/external-cred-blocked, not code-fixable here.

---

## (A) FIX NOW — no user decision, fully reversible up to the mainnet boundary

### A1. oracle-result-envelope-dup-export — **DO FIRST (trivial, zero-risk, pure type hygiene)**
Confirmed live: `packages/shared/src/index.ts` declares `RESULT_ENVELOPE_VERSION` locally (L7/L156) AND re-exports it (L41/L190); same double-declare for `PUBLIC_RUNTIME_DISCOVERY_LINKS` (L91 local + L111 re-export). Runtime is fine (`index.js` only re-exports once); the break is **type-level only** (TS2323/TS2484 for any bare-root TS/IDE consumer). Latent because the repo has no `tsc` gate.

Ordered steps:
1. In `neo-os-services/packages/shared/src/index.ts`: **delete** the local `export const RESULT_ENVELOPE_VERSION = …` declaration; keep the re-export block (`from './workflow-catalog.js'`) as the single source.
2. **Delete** the local `export const PUBLIC_RUNTIME_DISCOVERY_LINKS: {…}` + the three bodyless `build…/get…PublicRuntime…` value/function declarations; keep ONLY the re-export block (`from './public-runtime.js'` — `public-runtime.d.ts` already supplies full signatures). Leave the local `type` aliases (type-only re-exports don't collide).
3. **Remove** the stray third copy `export const RESULT_ENVELOPE_VERSION = '2026-04-tee-v1'` from `utils.d.ts` (utils.js has no such runtime export — declaration drift).
4. Add regression guards: (a) a runtime test importing `{ RESULT_ENVELOPE_VERSION }` from the **bare-root** `@neo-os-services/shared` and asserting the value; (b) one line in `scripts/verify_repo.sh`: `npx --no-install tsc --noEmit --strict --module nodenext --moduleResolution nodenext packages/shared/src/index.ts`.

Gate: the validation `tsc` must show the TS2323/TS2484 redeclaration errors **gone** (the residual TS7016 "no .d.ts for ./rate-limit.js/./workflow-catalog.js" is a separate pre-existing gap — out of scope, do not chase). `npm --prefix packages/shared test` (node --test) stays green.
Mainnet implication: none. No deploy, no on-chain, no key. Delete-only of duplicate declarations; only failure mode is deleting the re-export instead of the local — the tsc + node-test guards catch it instantly.

### A2. dice-game-standalone — **the one substantive software fix; closeable through testnet; mainnet leg deferred to (B)**
Confirmed real defect: N3 dice routes through the kernel `PlatformGame` VRF path; the oracle is **down** (`oracle.meshmini.app/v1/status` → `runtime_temporarily_degraded`), so `ConsumeDirectGasCredit` locks the stake into an unresolved `DiceBet` with **no withdraw path** → every N3 bet placed today is **permanently stranded**. EVM side settles atomically and is **left unchanged**. `MiniAppCoinFlip` is the exact proven template (verified present: `contracts/MiniAppCoinFlip/{MiniAppCoinFlip.cs,.Reads.cs}` + built `contracts/build/MiniAppCoinFlip.{nef,manifest.json}`). `dotnet` present; `nccs` NOT on PATH (install step below).

Ordered steps with gates:

**Step 0 — toolchain (no creds):** `dotnet tool restore` (or `dotnet tool install Neo.Compiler.CSharp`) in the repo to put `nccs` on PATH. Gate: `nccs --version` succeeds.

**Step 1 — NEW contract `contracts/MiniAppDiceGame/`** (copy CoinFlip + `.Reads.cs`; split partials if >300 lines to satisfy `ContractPartialFilesStayReviewable`):
- Class/DisplayName `MiniAppDiceGame`; `[InitialValue]` Owner = NR3E4D8N; `ContractPermission` GAS transfer.
- Memos: `miniapp-dice-game:fund` (house bankroll), `miniapp-dice-game:stake` (matches the frontend's existing `${appId}:stake`).
- `Roll(player, BigInteger face, amount)`: assert `face` ∈ [1,6]; `MIN_BET=5_000_000` (0.05), `MAX_BET=2_000_000_000` (20 GAS, matches DI_MAX_BET).
- Payout 5.70× (6 faces × 95%, 5% house edge) as integer `payout = amount * 57 / 10`. **Bankroll guard BEFORE accepting**: `bankroll >= amount*47/10` (the extra-from-house) so every win is fully payable. Win: `bankroll -= (payout-amount)`, transfer payout. Loss: `bankroll += amount`.
- Outcome: `rolled = (entropy + mix) % 6 + 1` from `Runtime.GetRandom` + player + `Runtime.Time` + gameId (same mix as CoinFlip); `won = rolled == face`. Modulo bias negligible over GetRandom's range.
- Keep `Withdraw(account)` credit-refund, `WithdrawBankroll(to,amount)` owner-only, `Bankroll()`, `CreditOf()`, `GetStats/GetGame/GetPlayerGames` verbatim (rename Choice→Face; event `Rolled(gameId,player,face,rolled,won,payout)`).
- **CRITICAL invariant**: `OnNEP17Payment` is **credit-only** (memo assert OK; NO transfers / business reverts — crashes the TestEngine host). All transfers + logic in direct methods.

**Step 2 — LOCAL TestEngine validation** `contracts/__tests__/MiniAppDiceGameTests.cs` (model on `MiniAppCoinFlipTests.cs`): fund bankroll, deposit credit, roll matching face (assert 5.70× payout), roll non-matching (assert bankroll grows), `AssertSolvent`, `Withdraw` refund. Gate: `DOTNET_ROOT=$HOME/.dotnet dotnet test --filter ~MiniAppDiceGame` green.

**Step 3 — DEPLOY TESTNET:** build NEF to `contracts/build/`, then `NEO_TESTNET_WIF=… node deploy/scripts/deploy_contract_neonjs.mjs contracts/build/MiniAppDiceGame.{nef,manifest.json}`. Note: hash = `Hash160(deployer+nef.checksum+name)` is **network-independent** → testnet hash == future mainnet hash for the same NEF+deployer.

**Step 4 — LIVE-VALIDATE TESTNET** `deploy/scripts/live_validate_dicegame.mjs` (model on `live_validate_coinflip.mjs`): fund bankroll, deposit, ~6 rolls on face=6, assert per-roll `Rolled` events + 5.70× payout + **exact solvency** (held GAS == bankroll, no strand). Gate: PASS, exactly solvent. **Lesson reminder**: assert via the tx's own event log (notifications, definitive at HALT), not a post-tx balance read (RPC node-lag).

**Step 5 — FRONTEND REWIRE `apps/dice-game/src/main.tsx` (N3 branch ONLY; EVM branch L358-374 untouched):**
- Replace kernel `placeDiceBet` (L375-412) with `ctx.services.chain.invokeWithPayment(amountFixed8, "miniapp-dice-game:stake", "roll", [player, face, amount])` waiting for `Rolled` — outcome is **synchronous in-tx**.
- **Delete** `resolveN3Bet`/`DiceBetResolved`/`DiceBetRefunded` polling + the `stakeSent` "recoverable credit" catch (L263-290, L437-460) **for N3 only** (keep for EVM).
- `refreshLiquidity` (L116-153): read standalone `bankroll()` instead of `GAS.balanceOf(contract)`, and `creditOf(player)` instead of `getDirectGasCredit`. Recompute `maxPayableStake` against the 47/10 cover. Keep pre-flight guard L381-390.
- **Add `withdrawCredit` action** wired to standalone `Withdraw(account)` (model `fogplay/src/main.tsx` + `useCoinFlip.ts`) — **this is the core user-facing fix**: stranded/over-deposited credit becomes genuinely refundable.
- Manifest: contract mode already `custom`; set `technologies.oracle.enabled→false`, keep `permissions.randomness=true`, drop "Morpheus VRF" copy → "atomic on-chain roll"; set `neo-manifest contracts.neo-n3-{testnet,mainnet}` to the new hash; **remove the `runtime.modules` platform-game binding** (becomes self-contained like red-envelope).
- Sync `apps/shared/constants/rpc.ts` MINIAPP_CONTRACTS fallback + `LIVE_CHAIN_FLOWS` harness map.

**Step 6 — BUILD+TEST GATE:** build 60/60 (vite) + full `npm test` green. Also realign `deploy/scripts/lib/miniapp_runtime_entrypoints.test.mjs` if it asserts the old `ctx.os.game` wiring (per burn-league migration precedent).

**Mainnet leg of A2 → see B1.** Steps 0-6 are 100% feasible now with zero real-value exposure (testnet only; the leaked key already controls testnet).

### A3. custom-anchor-agent-provisioning — **FIX 1 (software) NOW; FIX 2 testnet-backfill NOW; mainnet backfill → (B)**
Confirmed partial defect: `RegisterAgents` (batch, ≤21) is already deployed on testnet+mainnet and gated by `ValidateAppAuthority` (platform Admin = NR3E4D8N OR per-app appAdmin). The host detail page provisions 21 agents in one tx; the **standalone app does not** — `registerAction('register')` only calls `registerCustomAnchorApp` → anchors born with `agentCount=0` (VoteAgent reverts → genuinely zero yield). Flagship trust/profit anchors are already 21/21; only **user-created** custom anchors are born inert. No contract change needed.

Ordered steps:

**FIX 1 — standalone provisions 21 agents at registration (primary, pure software):**
1. Extract the pure `deriveAnchorAgentAccounts` + `parseAnchorCandidateKeys` helpers out of `platform/host-app/lib/custom-anchor.ts` into `apps/shared` (zero host deps — only `@noble/hashes`).
2. `apps/custom-anchor/src/PlayArea.tsx` registerInput panel (~L486-527): add a `candidates` field (21 compressed pubkeys, one per line) + locale keys; validate exactly 21 unique `/^(02|03)[0-9a-fA-F]{64}$/`. Offer a sensible default candidate set for Profit mode (mirror the deploy script's `defaultCandidate`) to cut UX friction.
3. `apps/custom-anchor/src/main.tsx` registerAction('register') (L342): after `registerCustomAnchorApp`, submit `registerAccounts` (aaCore) + `registerAgents(appId, 21 accounts, 21 candidates, 21 scriptHashes)`. Standalone `ctx.services.chain` has no `invokeMultiple` → submit as **3 sequential txs** with `waitForDepositConfirmation` between (acceptable — register is already multi-step). Source aaCore hash via `EXTERNAL_INTEGRATIONS[network].contracts.aaCore`.
4. Update manifest register op + the 0/21 callout/gate → becomes a fallback for externally-created anchors, not the normal path.
5. Add/extend `apps/shared/test/custom-anchor.playarea.test.tsx`.
Gate: build 60/60 + `npm test` green. No redeploy.

**FIX 2 — TESTNET backfill (on-chain op, no decision — free testnet value):**
1. Enumerate `AnchorAppRegistered` events on testnet `0xab079b4f…`, find appIds with `getAgentCount==0`.
2. For each, call `registerAgents(appId, 21 accounts, 21 candidates, 21 scriptHashes)` as platform Admin (NR3E4D8N) reusing `deploy_anchor_testnet.go`'s `ensureAgentSet` or a small neon-js script reusing the agent-derivation helper. Agent registration costs **GAS only, not NEO**.
3. Local TestEngine validate first (deployer has limited testnet NEO; agent reg needs none).
Gate: re-read `getAgentCount==21` for each backfilled appId.

**Mainnet backfill → see B4** (owner-gated, GAS-only, additive — flagged for explicit go-ahead per the leaked-key-on-mainnet gate).
Note for honest copy: provisioning makes staking **votable** but ongoing yield still requires the operator to call `VoteAgent` + `HarvestRewards/FundRewards` — already partially documented in `rewardModelBody`; keep that copy.

---

## (B) NEEDS USER DECISION — spends real mainnet value, reuses the leaked NR3E4D8N key on mainnet, or needs external creds

> **Cross-cutting recommendation (applies to B1/B2/B4 and all existing mainnet pools):** rotate the contract owner from the **known-leaked NR3E4D8N** (WIF is in `.env` + transcripts; anyone holding it can `WithdrawBankroll`/`withdrawReserve`/drain) to a **dedicated cold or multisig owner** before or alongside any new mainnet bankroll. The 10 existing mainnet contracts already sit under this key (user previously accepted). Recommended option: rotate now while the new dice/anchor mainnet legs are deployed, so the surface doesn't grow.

### B1. dice-game MAINNET deploy (tail of A2)
**Decision:** Deploy `MiniAppDiceGame` to mainnet (same NEF → same hash) and seed a real-GAS house bankroll?
- **Recommended: YES, with owner rotation.** This is the only path that stops permanent strands for mainnet N3 dice players. Same pattern + risk class already accepted for the 10 mainnet contracts.
- **Steps:** `deploy_contract_mainnet.mjs` (dual-gate `MAINNET_DEPLOY_CONFIRM=YES` + `DEPLOY_APPLY=1`); seed bankroll ~2-5 GAS from NR3E4D8N's ~90 GAS mainnet balance; set `neo-n3-mainnet` hash; redeploy the web app.
- **Cost:** ~10 GAS deploy + 2-5 GAS bankroll seed. **Risk:** real GAS spent; bankroll drainable by the leaked key's `WithdrawBankroll` (mitigate via rotation). The old kernel's stranded ~1.45 GAS + any pre-existing strands are **not** auto-refunded (no oracle) — small, pre-existing, accept.

### B2. neo-swap-real-settlement — **HARD-BLOCKED on NEO inventory the owner does not have**
Verified: owner NR3E4D8N holds **0 NEO on both testnet AND mainnet** (GAS 9007 testnet / 90.9 mainnet). A two-sided NEO/GAS reserve swap cannot be seeded — the NEO→GAS leg can quote but never settle. Both MorpheusDataFeed contracts **FAULT "Called Contract Does Not Exist"** on every endpoint, so pricing must be **owner-set** (SelfLoan-style), making it a fixed-price arb target. Frontend ABI also mismatches (calls Uniswap-style `swapTokenInForTokenOut(path,deadline)` vs a simple reserve model).
- **Decision:** Acquire/transfer real NEO (and faucet testnet NEO) to seed reserves, accepting the arb exposure + leaked-key custody?
- **Recommended: NO / DEFER.** Even a meaningful testnet demo needs faucet'd NEO; mainnet needs purchased NEO under a leaked key, priced by hand against a dead feed. The honest preview-only state (`contracts:{}`, `swapRouterUnavailable`) is correct and ships safely. Only pursue if the user explicitly wants a live swap desk and provisions NEO + a cold owner.
- **If pursued:** build `MiniAppSwap` (clone CoinFlip+SelfLoan dual-token, owner-set `gasPerNeo`, memo-credit-only OnNEP17Payment, `withdrawReserve`), local TestEngine validate (fund NEO from `engine.ValidatorsAddress`), **rewire `useSwapEngine.executeSwap` to `swapNeoForGas/swapGasForNeo` + read contract `getQuote` instead of the dead feed.** Blocker: NEO inventory (external value) + leaked owner.

### B3. security-followups (rotate Neo X key 0x0b8584 + CF/Vercel tokens; create wrangler DLQ queues; apply AA Supabase migration)
All three are genuine standing follow-ups, **none doable from this environment** — every one needs external creds the user controls. Runbook by ascending risk:

**B3a — AA Supabase migration (lowest risk, do first).** `neo-abstract-account/supabase/migrations/20260611_draft_metadata_hardening.sql` is complete, correct, idempotent. Targets the **AA** Supabase project (different from the platform's `dmonstzalbldzzdbbcdj`); AA project ref + service-role key are not on disk.
- **Decision/recommend:** apply it. Either `supabase link --project-ref <AA_REF> && supabase db push`, OR paste into the dashboard SQL editor. A **Supabase MCP is connected this session** — if the user authorizes it against the AA org, `list_projects` → `apply_migration` can do it (still needs their auth). Verify: `create_aa_draft` exists; `has_function_privilege('anon', 'public.assert_aa_draft_activity_allowed(text,jsonb)', 'execute')` = false. Cost ~5 min, $0, reversible.

**B3b — control-plane DLQ.** `npx wrangler whoami` = **not authenticated** (verified); no CF API token on disk; `wrangler.meshmini.toml` declares `morpheus-oracle-request-dlq` + `morpheus-feed-tick-dlq` whose consumers can't deploy until the queues exist.
- **Decision/recommend:** create them. User runs `npx wrangler login` (interactive browser OAuth — agent cannot) OR exports a scoped `CLOUDFLARE_API_TOKEN`, then `wrangler queues create morpheus-oracle-request-dlq` + `…feed-tick-dlq`, then `wrangler deploy -c wrangler.meshmini.toml`. Additive, low risk, free-tier.

**B3c — key + token rotation (HIGH risk, largely irreversible — USER-only).** Neo X key 0x0b8584 (owner+updater+verifier of all Neo X mainnet contracts: price feed `0x38DD6BCE…`, oracle `0xeCFC1C65…`, dice `0xFA795F81…` + bankroll) is a single point of compromise and is **not on disk** (transcripts + box 0600 env only).
- **Decision/recommend:** rotate — generate a fresh EVM key (split owner vs updater/verifier, or move owner to multisig); transfer ownership/roles + move dice bankroll on-chain (mainnet txs from the OLD key, real GAS); update the box 0600 env (`NEOX_FEED_PK`/`…UPDATER_PK`/`…VERIFIER_PK`) + restart `morpheus-relayer-nitro` + `morpheus-feed-pusher-neox.timer`. Revoke/recreate the CF + Vercel tokens. **Must be done carefully by the user with the live key** — a botched ownership transfer can brick admin control or strand bankroll.

### B4. custom-anchor MAINNET backfill (tail of A3)
**Decision:** backfill 21 agents on any inert mainnet custom anchors via `registerAgents` as Admin NR3E4D8N?
- **Recommended: YES if/when inert mainnet anchors exist** — it is **GAS-only (no NEO), owner-gated, additive** (no fund movement, no user balances touched), correctable via `SetAgentCandidate`. Flagged here only because it writes to mainnet with the leaked key. Cost: a few GAS per inert anchor from the ~216 GAS mainnet balance. Low blast radius (flagship anchors untouched).

### B5. degraded-apps infra fix (automation-copilot, neodid-passport, gas-sponsor) — **one shared root cause, external-cred-gated**
The three apps' frontends are **already correct** (honest degradation). The single root cause: the public edge (`edge.meshmini.app`, `oracle.meshmini.app`) is locked to the **emergency-vercel-runtime shim returning 503**, while the live Nitro box (`32.199.39.216`, nginx→`127.0.0.1:8788`) is up.
- **Decision:** re-point the edge origins off the Vercel shim to the box + add TLS `server_name`/cert on the box nginx + provision the enclave signer secret (resolves `awaiting_enclave_signer_secret`, which also unblocks neodid resolve/sign + gas-sponsor signing) + fix the harmless `db-prune` table-list bug.
- **Recommended: YES** — this single infra change unblocks all three at once. No on-chain value at stake; reversible (DNS/origin swap). **Blocked here:** needs AWS/DNS/Vercel/cert creds + box write access the user controls. The self-contained-contract pattern does NOT substitute (these need the off-chain runner/edge, which already exists on the box). `neo-treasury` and `forever-album` are NOT part of this — see C.

---

## (C) NOT WORTH FIXING — current honest state is actually correct

### C1. daily-checkin-pool-funding — **structurally unfixable on the deployed contract; honest gate already shipped**
The "operator transfers GAS to fund the pool" fix is **structurally impossible**: `onNEP17Payment` rejects every deposit except the exact 28-char memo `miniapp-dailycheckin:checkin` → a funding transfer reverts and returns the GAS. There is **no** `setRewardRate`/`fund`/`deposit` in the 48-method ABI, `update()` is doubly blocked (no source in any repo + admin is an **unknown key** NM2…/NWp…, NOT NR3E4D8N), and the economics are 1000× underwater (0.001 GAS fee vs 1 GAS milestone). The frontend already does the correct thing: Claim disabled when `pool<accrued`, honest `rewardsUnderfunded` banner, `totalRewarded=0`. **Justification:** the honest underfunded state is the correct ceiling. *Optional, separate initiative (not a fix):* a proper standalone `MiniAppDailyCheckin` with `fundPool`/`setRewardRate`/right-sized rewards under a non-leaked owner — that's net-new product, needs a user-provisioned owner key + mainnet bankroll. Recommend leaving as-is; optionally trim the manifest/`MILESTONES` copy so the UI doesn't advertise 1/2 GAS it cannot pay.

### C2. neo-swap / neo-treasury "frozen feed" (the **neo-treasury** half) — **STALE PREMISE; feed is live**
The "0x9bea75cf frozen since 2026-03-09" is the **testnet** feed; both apps default to `neo-n3-mainnet` and read the **mainnet** feed `0x03013f49…`, which is **fresh** (verified read-only: NEO recordAge ~227s, GAS/ETH/BTC all <0.3h; the `morpheus-feed-pusher` systemd timer fires every 5 min, status=0/SUCCESS, updater wallet 75.1 GAS). The 2026-03-09 date survives only in the testnet feed's source `dataTimestamp` while its on-chain `recordTimestamp` is current. **Justification:** neo-treasury is functional on its default network — the fleet-health "frozen feed" note is mis-scoped. *Optional testnet-only cosmetic (declined):* `useSwapEngine` keys its stale banner on `dataTimestamp`, so a testnet user sees a false "stale" banner — switch the freshness signal to `recordTimestamp` if ever desired. Zero impact on mainnet users. **(Update the fleet-health memory to re-classify this as a false alarm.)**

### C3. private-transfer-real-settlement — **honest seal-only ceiling is correct; "real transfer" is net-new product, not a deferred bug**
Current state moves no funds and the manifest correctly says zk is disabled. Turning it into a real confidential transfer = new custody escrow contract (highest-stakes class) + new TEE-signature-gated release lane + box env wiring + restoring the Supabase-backed confidential store (not edge-served; degrades to `inline_fallback` today) + testnet oracle is degraded. Plus a **product caveat**: on release the recipient+amount go **plaintext on-chain** (like neo-message reveal) — it's a delayed/relayed transfer, not post-settlement-confidential. **Justification:** nothing is broken or misrepresented; building it is a multi-day, multi-component initiative under a leaked key, not a fix. Leave the honest "no funds moved" framing.

### C4. aa-market-hub-seller-index — **the premise describes correct intentional behavior, not a defect**
"Sellers can't see/refund buyer pending payments" is **by design**: `RefundPendingPayment`/`GetPendingPaymentOf` are payer-witness-gated (a seller refunding buyer escrow would be a fund-seizure vector). The buy flow is **atomic** (`invokeMultiple`: GAS.transfer → record pending; `settleListing` → clear + pay seller in ONE tx) — a revert rolls back the transfer, so the app **can never strand** a pending payment. Honest copy + buyer-only refund button already shipped. **Justification:** zero-value display-only enhancement; adding an index to a **live escrow holding real GAS** carries non-zero risk (testnet has no `update()` → full redeploy + migrate 87 listings; mainnet `update()` reuses the leaked key) for a feature that can never legitimately enable seller refunds. Ship nothing.

### C5. oracle-consoles-live-read — **net-negative to wire now (CORS-blocked); honest preview is better than a broken one**
The deferred premise ("shared panel has no fetch lane") is **stale** — `ConsoleToolPanel.tsx` already has the opt-in `execute` hook + button + full toast/test coverage. The real blocker is **CORS**: the worker emits **no `access-control-allow-origin`** on tokenless GETs (verified header dump + OPTIONS preflight; `ACAO: null` even with app Origin), so a browser fetch from the app origin is blocked. `oracle-http-console` has no tokenless GET at all (`prices`/`oracle/http` both 404). **Justification:** wiring `execute` now would throw "Failed to fetch" → red error toast on every click — strictly worse than today's honest preview-only notice. *Prerequisite (out of this repo):* a worker-side CORS fix in `neo-os-services` OR a same-origin Vercel rewrite proxy; only then is a small per-app `execute` wiring (neodid-console catalog, compute-lab public-key) worth it. http-console never.

### C6. mainnet-rollout-gap (round-3 wiring) — **verified non-reproducing on mainnet**
Round-3 (commit 161931f16) added exactly five new read methods across all 60 apps — `{minBurn, maxBurn, isPaused, getRewardPerNeo, balanceOf}` — and **every one resolves on the deployed mainnet contract** (verified live: burn-league `minBurn=1e8`/`maxBurn=1e11`; gov-merc `minBid=1e8`; custom-anchor `getRewardPerNeo=0`; daily-checkin `isPaused` exists + `balanceOf` targets GAS native; flashloan `providerFeeShare` is an object-field read with `||80` fallback; dice-game added zero reads). **Justification:** the shipped state is correct; no testnet-only method leaks onto mainnet. No action.

### C7. forever-album (part of the "degraded sweep") — **deliberate local-only product ceiling, not a defect**
`useForeverAlbum.ts` documents the intentional redesign to local-only AES-GCM browser storage because a 45KB on-chain blob ≈ 45 GAS/photo and the mainnet storage kernel is an "Unknown contract". **Justification:** cross-device sync needs a NEW off-chain storage lane (IPFS/Arweave/S3) = a product decision + new infra, not a deferred-bug fix. Leave as-is.

---

## Recommended execution order
1. **A1** (oracle dup-export) — minutes, zero risk, clears a latent type break.
2. **A3 FIX 1** (custom-anchor standalone provisioning) — pure software, no chain.
3. **A2 Steps 0-6** (dice-game standalone through testnet + frontend) — the substantive defect fix; stops new strands at the testnet boundary.
4. **A3 FIX 2** (testnet agent backfill) + **A2 testnet live-validate** — free testnet on-chain ops.
5. Surface **B-block decisions** to the user as a batch, leading with the **owner-key rotation** recommendation (gates B1/B2/B4) and the **B3a Supabase migration** (lowest risk, can use the connected Supabase MCP with user auth) + **B5 infra re-point** (unblocks 3 degraded apps at once).
6. Update fleet-health memory: re-classify **C2 neo-treasury** as a false alarm.

**Files load-bearing to the fixes:** `neo-os-services/packages/shared/src/index.ts` + `utils.d.ts` (A1); `contracts/MiniAppCoinFlip/` template → new `contracts/MiniAppDiceGame/` + `contracts/__tests__/MiniAppDiceGameTests.cs` + `deploy/scripts/live_validate_dicegame.mjs` + `apps/dice-game/src/main.tsx` + `apps/dice-game/neo-manifest.json` + `apps/shared/constants/rpc.ts` (A2); `platform/host-app/lib/custom-anchor.ts` → `apps/shared` helper + `apps/custom-anchor/src/{main.tsx,PlayArea.tsx,manifest.ts}` (A3); `neo-abstract-account/supabase/migrations/20260611_draft_metadata_hardening.sql` (B3a); `neo-os-services/deploy/cloudflare/morpheus-control-plane/wrangler.meshmini.toml` (B3b).