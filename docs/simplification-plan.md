# Simplification Plan — behavior-preserving cleanup after the framework-evolution campaign

Source of truth: the three lane censuses in
`scratchpad/simplify/{dead-code,duplication,over-eng}.md` (each grep-verified whole-repo).
This plan classifies every candidate as **SAFE-TO-EXECUTE** (proven zero-ref deletion or
byte-identical/type-only consolidation → true no-behavior-change) or **RISKY/DEFERRED**
(behavior-equivalence not certain, protected area, or large cross-app migration), and states
explicit **NON-GOALS**.

Oracle: framework 438/438 (34 files), apps/shared 4344+/395 files, contracts 440/440, edge
169/169 must stay green. Removing a surface legitimately removes ITS OWN tests + updates the
runtime-shape snapshot — that is allowed and noted per item.

**Status legend:** ✅ EXECUTED + verified · ⏸ SAFE but deferred (large migration, not run this
pass) · ⚠️ RISKY/report-only.

---

## 1. SAFE-TO-EXECUTE

### Batch A — framework dead surfaces  ✅ EXECUTED

**A1 · `app.chain.enumerate` + private `runChunked` helper** (Lane-1 S1) — `@deprecated`, 0 consumers.
- Files: `framework/chain-surface.ts` (import :27, `runChunked` helper :41-53, `enumerate`
  method + JSDoc :427-476), `framework/types.ts` (`FrameworkEnumerateSpec` :146-164, iface
  member `MiniAppFrameworkChain.enumerate` :925), own test `framework/test/chain-extensions.test.ts`
  (`describe("S7 chain.enumerate …")` :243-311), shape snapshot `framework/test/framework-shape.test.ts`
  (drop `"enumerate"` from the chain member list), stale comment mentions `framework/events.ts:57`
  + `framework/mode.ts:40`, deprecation-table row `docs/sdk-guide.md`.
- Proof of zero refs: `rg "\.enumerate\b" / "FrameworkEnumerateSpec" / "runChunked"` whole-repo →
  only the def, its own test, and doc/comment mentions. `FrameworkEnumerateSpec` is **not**
  re-exported from `apps/shared/react/index.ts` (verified). Zero app/platform/contract consumers.
- Removed: ~90 non-test + ~70 test lines. Behavior-preserving (0 app consumers).

### Batch B — over-engineering removals  ✅ EXECUTED (B1) · ⚠️ report-only (B2–B4)

**B1 · `gamefi/microgame-archetypes.ts`** (Lane-3 #1) — 438-line design catalog, 0 runtime consumers.  ✅ EXECUTED
- Files: delete `framework/gamefi/microgame-archetypes.ts` (438) + `framework/test/microgame-archetypes.test.ts`
  (~64) + remove the `export * from "./microgame-archetypes"` line in `framework/gamefi/index.ts`.
- Proof: the ONLY importer repo-wide is its own test (`rg "microgame-archetypes|MICROGAME_ARCHETYPES|
  microgameArchetypeById|…"` → def + own test only). Design content survives in
  `gamefi/MICROGAME_BACKLOG.md` (kept). `framework-shape.test.ts` does not reference it (no snapshot churn).
- Removed: ~530 lines; public `@framework/gamefi` barrel shrinks by 8 exports. Behavior-preserving.

**B2 · `FrameworkWritePolicy.guestGuard?` dead config knob** (Lane-3 #4) — framework-internal.  ✅ EXECUTED
- Files: `framework/internal/guards.ts` (drop `guestGuard?` field :33; `guardedWrite` guard becomes
  the unconditional `deps.assertNotGuest()` at :89), test `framework/test/guards-single-flight.test.ts:88`
  (drop the `guestGuard:false` half; keep the `permission:null` exemption assertion).
- Proof: none of the four defined policies (`WRITE_PRIMARY`/`ORACLE_REQUEST`/`GUEST_GUARD_ONLY`/
  `AA_WRITE`) ever sets `guestGuard`; the only `guestGuard:false` in the repo was the one test
  assertion. Not exported from `index.ts` → zero app impact. Module doc itself calls a guard-skipping
  lane "a review rejection", i.e. the knob encodes a forbidden capability.
- Removed: ~5 non-test lines (+ a test reworded to the now-unconditional guard). Behavior-preserving
  (every real lane already guarded).

**B3 · `gamefi/reward-runner.ts` flagship runner** (Lane-3 #2) — 850+ lines (impl+test), 0 adopters.  ⚠️ REPORT-ONLY
- Do NOT delete. It is a deliberately just-built migration target from this very campaign; the fix is
  **adoption** (migrate the 11 reward-game mains onto `app.game.reward().runner`), not removal. Deleting it
  would destroy intended future value and require a `game.reward()` shape update.

**B4 · `lucide-react` full dep for 2 icons** (Lane-3 #3) — hard dep of the business SDK.  ⚠️ REPORT-ONLY
- Real over-build (icon lib in every SDK consumer's closure for `Volume2`/`VolumeX` in
  `phaser/PhaserGameComponent.tsx:34`), but touches **protected** phaser code, changes a rendered
  component's bytes, and rewrites the dep-pinning test (`phaser-framework.test.ts:138-139`). Defer to a
  focused phaser change (inline 2 SVGs, or demote to peerDependency) with a full phaser test run.

**B5 · `singleFlight` public barrel re-export** (Lane-3 #5) — 0 external consumers.  ⚠️ REPORT-ONLY (reverted)
- Was trialed and **reverted**: it is a deliberately-exposed public RFC-P0-2 utility (barrel export by
  design), and the campaign forbids trimming public app-facing framework surface even at 0 consumers.
  Keeping it is the safe call.

### Batch C — dead-surface CONSOLIDATE bundle (Lane-1 C1/C2/C3)  ⚠️ REPORT-ONLY

The remaining `@deprecated` 0-app-consumer framework surfaces. All proven zero app/platform/contract
consumers, but each removal is multi-file and requires **editing** (not deleting) a shared test
(`apps/shared/test/miniapp-framework.test.ts`) that mixes them with the **live** `stats.leaderboard`
surface — so they are coordinated as one careful PR, not run in this pass.
- **C2** coupled trio `stats.increment → app.db(db.collection) → storage.hybrid`: `stats.increment` is
  the only caller of `db.collection`, which is the only caller of `storage.hybrid` → removes as one
  bundle; `stats.leaderboard` + `storage.local/remote` survive. ~40-60 src + ~40 test lines.
- **C3** `app.achievements` (`awardOnce`/`list`): uses `badge`+`local`, independent of C2. ~18 src lines.
- **C1** `app.chain.read(spec)` typed-spec form: 1 incidental consumer
  `apps/shared/test/mode-surface.test.ts:145` → repoint to `chain.query`/`readRaw` (behavior-identical),
  do NOT delete the test. ~8 src lines.
- Clears `FrameworkReadSpec`/`FrameworkDbSurface`/`FrameworkHybridStorageSurface`/
  `FrameworkAchievementsSurface`/`AchievementDefinition` from `types.ts` + index wiring. ~180 src + ~180
  test lines, behavior-preserving. Report-only pending a dedicated PR.

### Batch D — duplication consolidation  ⏸ SAFE but DEFERRED (cross-app migrations)

Each row is SAFE-classified (byte-identical body or zero-runtime type dedup) but touches 6–28 apps and
needs the full 900s apps/shared suite as oracle. Listed as the recommended next execution wave; not run
in this framework-scoped pass because each is a fleet migration, not a self-contained delete.

| # | Cluster | Sites | Canonical home | ∆ src | Class |
|---|---|---|---|---|---|
| D1 | `useNowMs` clock/tick hook (`useState(Date.now())`+`setInterval`) | 28 apps (~22 in scope) | NEW `@shared/react/hooks/useNowMs(stepMs)` | ~220 | SAFE iff `stepMs` stays a per-call param and NO visibility-pause added (intervals 250ms–30s) |
| D2 | `interface Obs<T>` redeclared in guest-engines | 18 identical / 20 | `Observable<T>` from `@framework/reactive` | ~72 | SAFE (type-only, zero runtime) |
| D3 | `interface GuestLeaderboardApi` redeclared | 17 apps | `FrameworkGuestLeaderboard` (`framework/types.ts:449`) | ~50 | SAFE (type-only) |
| D4 | `clampDifficulty` (all clamp 0..2, byte-identical) | 13 defs / 11 apps | NEW `clampInt(v,lo,hi)` | ~50 | SAFE (identical body) |
| D5 | `gasDisplay(fixed8) => formatGas(fixed8,8)` wrapper | 11 game-rules.ts | `app.fmt.gas` / `formatGas` | ~22 | SAFE (identical thin wrapper) |
| D6 | `SETTLEMENT_GRACE_MS = 600_000` const | 6 apps | NEW shared game const | ~6 | SAFE (identical literal) |
| D7 | `makeObs<T>` test wrapper (createObservable passthrough) | 11 test files | import `createObservable` directly | ~30 | SAFE (trivial) |
| D8 | `utils/explorer.ts` Dora tx-URL — **event-ticket-pass only** | 1 of 3 files | `app.platform.explorer.tx()` (ships) | ~27 | SAFE (byte-identical); the other 2 are RISKY (see §2) |

Recommended order: D2+D3 (pure type dedup, land together) → D4+D5+D6+D7 (small identical-body collapses)
→ D1 (biggest, new hook) → D8 (event-ticket-pass). Each behind its own full-suite run.

**SAFE-consolidation total (D1–D8): ~477 src lines, zero behavior change** — deferred to a fleet pass.

---

## 2. RISKY / DEFERRED (behavior-equivalence NOT certain — do NOT bulk-collapse)

From Lane-2/Lane-3, real duplication whose consolidation **changes rendered output or semantics**:
- **`shortAddr/shortHash/shortTxid/truncateMiddle`** (27 defs/21 apps): divergent separator glyph
  (`…` U+2026 vs `...`), head/tail (8/4 vs 10/6 vs 6/4), thresholds. Folding onto `app.fmt.address`
  flips the rendered string. Migrate only exact-match sites; never bulk.
- **`formatGas`-family local defs** (19 defs/17 apps): diverge on decimals (4/8/`maximumFractionDigits`),
  suffix (`" GAS"` vs none), placeholder (`—` vs ``). Case-by-case only.
- **inline `formatClock`** in color-clash/merge-kingdom/pet-potion: `Math.ceil`+unpadded (`1:02`) vs
  framework `Math.floor`+padded (`01:01`). Folding is **display-CHANGING** — leave.
- **framework-internal parser families** (Lane-2 C1–C3 / internal-audit §5): gas→fixed8 ×4,
  address→hash160 ×3, `normalizeTxid` ×2 (opposite 0x forms). Only the inner math is shared; the
  wrappers carry deliberately divergent return/throw/zero-policy that is load-bearing. Extract the core
  ONLY under the framework 438-suite as oracle; wrapper semantics verbatim. Not this pass.
- **explorer.ts** for gas-lucky-pool + timestamp-proof: network resolved from a different source
  (OneGate ctx / custom normalizer) than `platform.explorer` — verify segment match before folding.
- **error `instanceof Error ? .message` idiom** (137 sites), guest-engine kit (~1400), game-rules
  factory (~1000), poll/retry (~300), launch param wrappers (~350): these are **additive helper
  migrations**, NOT dedups — out of scope for a behavior-preserving mandate.

**DEBUNKED (census "0 consumers" that are actually live — do NOT delete):** `app.chain.events` (20+
apps), `app.bus` (event-ticket-pass), `app.share`/`app.resources` (maintainer-kept standalone
surfaces w/ barrel re-exports), the apps/shared legacy composable shims (`useAllEvents`,
`useWalletBalanceReader`, `useAbstractAccount`, `useContractAddress`, `useStatusMessage`,
`useContractInteraction` — all wired transitively), and `mapField`/`normalizedHash`/`to0xHash`. Every
per-app `shortAddr`/`formatGas`/etc. local def has ≥2 in-file refs → duplication, not dead code.

---

## 3. NON-GOALS (explicit)

- **Do NOT touch protected paths:** `apps/{automation-copilot,flappy-dash,forever-album,graveyard,
  neo-message,zhuada-e}`, `platform/host-app/**`, `deploy/**`, `.github/**`, `.env*`,
  `contracts/MiniAppTarotVrf*`, `contracts/TarotOracleMockFixture*`,
  `platform/edge/functions/_shared/cors.ts`. (`phaser/` is protected-adjacent — see B4.)
- **Do NOT change public app-facing framework surface even at a single/zero consumer** — e.g.
  `singleFlight` (B5), `app.share`, `app.resources`, `combineBusy`. Trimming public API ≠ dead-code removal.
- **Do NOT merge things that only look similar** — divergent formatters/clocks/parsers (§2) change
  output; keep per-site head/tail/decimals/glyph.
- **Do NOT weaken or delete a test to make a removal pass.** Removing a surface removes its OWN tests +
  updates the shape snapshot (allowed); everything else stays green.
- **Do NOT do additive-refactor migrations** (guest kit, rules factory, errors sweep, launch/poll
  wrappers) under this behavior-preserving pass — they are new-helper adoptions, not dedups.
- **No new dependencies. No git commit/stash/checkout/restore.**

---

## 4. Totals

- **Executed this pass (framework-scoped, verified):** Batch A1 + B1 + B2 → **~625 src + ~135 test lines
  removed**, 1 file deleted, 1 barrel export + 7 tests removed. Framework **431/431** green (was 438;
  −7 = 4 enumerate + 3 microgame tests, their own), `tsc --noEmit` clean, eslint 0 new errors,
  apps/shared framework-coupled tests (`miniapp-framework`, `mode-surface`) 18/18 green.
- **Deferred SAFE (Batch C + D):** ~180 src + ~180 test (C) + ~477 src (D) ≈ **~657 more src lines**
  available behind dedicated, full-suite-gated PRs.
- **RISKY/report-only:** left in place by design.
