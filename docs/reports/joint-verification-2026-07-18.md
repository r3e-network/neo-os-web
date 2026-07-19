# Joint Verification Report — Platform Contract Library v2 on N3 Testnet

**Date:** 2026-07-18 (rolling — final section updated as the remaining milestones land)
**Repos:** neo-miniapps-platform (platform), neo-morpheus-oracle (kernel), neo-abstract-account (AA)
**Signer (all testnet writes):** `NLtL2v28d7TyMEaXcPqtekunkFRksJ7wxu` (`0x13ef519c362973f9a34648a9eac5b71250b2a80a`)
**Design authority:** `docs/platform-contract-library-v2.md`
**Audit companion:** `docs/reports/joint-audit-2026-07.md` (41 findings, dispositions)

---

## 1. Deployed estate (N3 testnet, magic 894710606)

| Contract | Hash | Admin | State |
| --- | --- | --- | --- |
| PlatformRegistry | `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b` | signer | deployed 2026-07-17; 77/77 apps registered (lite); artifact + engine timelocks execute 2026-07-18 18:48–18:49 CST; 24h self-update scheduled (tx `0x59982226…`, matures 2026-07-19 ~16:00 CST) |
| PlatformGame v2 (RewardGame, gameType 5) | `0xc75b181b4561462903bb27d8d9e0b32b637bec12` | signer | deployed 2026-07-17, **updated uc0→uc1 2026-07-18** (tx `0x09dfbcda…`) to the joint-audit-fixed build (timelocked update/oracle lanes, callback binding, GAS-only intake) |
| MorpheusOracle kernel (**private instance**, current source) | `0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35` | signer (admin=updater=verifier) | deployed 2026-07-17, **updated uc0→uc1 2026-07-18** to the multi-tenant callback-sharing build |
| Shared kernel (reference only) | `0xf54d8584ef82315c1800373272ab08ae0db2d5ef` | legacy operator key (not held here) | uc1 build — lacks rich dispatch + callback-sharing; its upgrade path is the morpheus repo's own runbook |
| Legacy v1 oracle (retired) | `0x4b882e94ed766807c4fd728768f972e13008ad52` | legacy | retired; all platform pointers migrated away |

Bindings: PlatformGame `oracle()` = private kernel ✓ (post-update read-back); PlatformGame `registry()` = PlatformRegistry ✓; kernel `game.session` module registered (`/session/finalize`, schema `morpheus.module.game.session.v1`); **11 clone appIds registered + granted on the kernel, all sharing callbackContract = PlatformGame** (see §4).

## 2. Verification evidence matrix

| Lane | Evidence | Result |
| --- | --- | --- |
| Contract suite (platform) | `npm run test:contracts` | **576/576 green** (xunit, incl. RewardGame behavioral/source-pin/model-invariant + RealKernel integration) |
| Real-kernel integration | `PlatformGameRealKernelIntegrationTests` (real MorpheusOracle NEF + PlatformGame in one TestEngine) | **4/4 green** — full settle through real kernel gates (register → module grant → fee credit → finalize → signed fulfill → rich 8-arg dispatch → settle) + negative matrix (non-callback submit, bad signature, ungranted module) |
| On-chain settle loop (testnet) | `deploy/scripts/live_validate_rewardgame_settle.mjs` | **ALL CHECKS PASSED**, twice: gameId 5 (pre-update build) and gameId 6 (uc1 build) — fund → start → finalize → kernel fulfill (real ECDSA over the byte-exact digest) → winner credit 0.1 GAS, liability identity `heldForApp == pool + Σcredits` exact, withdraw paid out |
| First on-chain fulfill | `deploy_private_kernel.go` fulfill action, request 4 | tx `0xe9afcd21…d85c`, kernel status Succeeded |
| Cohort-0 directory | `register_apps_on_platform_registry.go` | **77/77 appIds registered lite on-chain** (getApp rows verified; ~123 GAS worst-case budget confirmed; transient RPC failures recovered by idempotent re-runs) |
| Framework | `cd framework && npx vitest run` | **553/553 green** — new surfaces: `app.registry`, `app.platformGame` (appId auto-threaded), `chain.pending` (P1-4), guest-kit (P1-1); ContractBinding `mode:"shared"` resolver wired |
| apps/shared | `cd apps/shared && npx vitest run` | **4424/4424 green** |
| Deploy scripts | `npm run test:deploy-scripts` | **209/209 green** (7 new live-chain harnesses incl. timestamp-proof, neo-treasury, neo-multisig — all executed live) |
| UI/a11y | `scripts/audit-miniapp-a11y.mjs` (axe-core WCAG A+AA, built dists) | **77/77 apps, 0 critical/serious violations** |
| AA repo | `dotnet test` + `node --test` (frontend, sdk) | 180/180 + 415/415 + 78/78 green (after byte-order single-sourcing) |
| Morpheus repo | `dotnet test contracts/__tests__` | **61/61 green** (incl. 3 new callback-sharing tests) |

## 3. Joint-audit fixes landed (summary; full table in the audit doc)

- **H1** registry→engine-pool memo grammar (`appId:fund`) + cross-contract integration test — fixed, rides the registry self-update scheduled for 2026-07-19.
- **H2** PlatformGame instant update/oracle → timelocked + hash-pinned — fixed, **live on uc1**.
- **H3** edge admin-role trust of `user_metadata` → `app_metadata` — fixed, edge suite green.
- **H4** OR-D-03 callback hijack — fixed in morpheus source; **live for the platform lane via the private kernel**.
- **H5/H6** AA custody timelocks (recovery verifier, address market) — fixed in AA source, 196/196 → 208/208 green.
- Mediums: spend-threshold-raise timelock, pause-push into shims, env fail-closed, sandbox permission guard, recovery-squatting DoS, relay rate-limit/fetch-timeout/journal-key hardening, edge body-cap — all fixed with tests.
- Lows: `OnMiniAppResult` moduleId/requester binding, ExpireGame late-callback wedge, Solved-on-refund, GAS-only intake — fixed, **live on uc1**.

## 4. Multi-tenant callback sharing (the joint-refactor keystone)

**Problem:** the kernel's OR-D-03 uniqueness assert allowed one callback contract to route to exactly one miniapp — blocking any multi-tenant engine (PlatformGame serves N appIds through one contract).
**Fix (morpheus repo, `MorpheusOracle.Storage.cs`):** same-operator sharing — a second appId may share a callback contract iff the existing owner's admin equals the new app's admin; the index keeps first-wins semantics; different-operator reuse still faults `callback already registered`. Tests: same-operator coexistence, cross-operator fault, owner-update stability.
**Live proof (testnet):** 11 clone appIds (`miniapp-aim-master … miniapp-sudoku`) registered + granted on the private kernel, all with `callbackContract = 0xc75b18…` — impossible before the fix.
**Chain writes:** kernel build `dbb27e54…675b` (sha256 NEF), deployed via in-place `update` (hash preserved; fulfillment digest scriptHash binding unaffected).

## 5. Remaining milestones (scheduled / queued)

1. **2026-07-18 18:53 CST** — registry timelocks execute (`setAppAccountArtifact`, `registerEngine("platform-game")`), first per-app AppAccount mint, full-loop verification (cron `01KXT0GXCDA8DMW1T2S69ASSBV`).
2. **engine-attach** — 11 clones attach to the engine row + descriptor economics pushed (`deploy/scripts/attach_apps_to_platform_game.go`; manifest values spot-verified against clone sources; appId keys corrected to `miniapp-*`).
3. **2026-07-19 16:07 CST** — registry self-update executes (H1 memo fix + threshold-raise timelock + pause-push) (cron `01KXT3Y35ZJQB8YHKA1VGJ8ZWZ`).
4. **Cohort-1 per-app settle validation** — start→finalize→settle per clone appId through the kernel, economics compared against legacy tables; only then decommission the 11 `MiniApp<Name>` contracts (anti-graveyard law).

## 6. Honest residuals

- **Shared-kernel lane is operator-gated:** the canonical shared kernel `0xf54d85…` is administered by a legacy key not held in this program. Its `game.session` registration + rich-dispatch upgrade ship via the morpheus repo's own upgrade runbook. The platform lane is unblocked by the private kernel (same source build + the multi-tenant fix).
- **Wager quartet / MiniAppCredits:** explicitly untouched per the v2 design (healthy standalones).
- **Old per-app contracts:** the 34 legacy `MiniApp*` contracts stay live until each app's migration proves out (exits never close); their sources retire only after cohort-1/2 validation.
- **Two stuck ~97h testhost processes** from earlier sessions were killed; no other environment residue.
