# RFC: framework/ SDK Evolution — Simpler Apps, Standardized Behavior

- **Date:** 2026-07-12
- **Status:** IMPLEMENTED — P0-1..P0-7 + P1-2/P1-3/P1-7 landed (see §4 Status
  column), plus the Lane 3 TEE fetcher-lane S11 gate (§7). Framework vitest
  438/438 (34 files — 354 baseline + 84 new), tsc
  clean, apps/shared quick regression (mode-surface / defineMiniApp-services /
  game-guest-mode-adoption) 214/214 + miniapp-framework(-adoption) 12/12.
  App migrations: all 6 per-batch migration sweeps landed. The index.ts body
  split is complete (`chain-surface.ts` / `funds.ts` / `oracle-surface.ts` /
  `game-facade.ts`, plus the residual `platform-surface.ts` / `app-state.ts` /
  `actions-surface.ts` / `stats-surface.ts` — see the P0-1 row; index.ts is now
  643 lines of composition root + re-export barrel, no inline surface logic).
  Remaining follow-ups: ~~extract the small inline index.ts members~~ (LANDED),
  ~~wire `ctx.setError` in defineMiniApp~~ (LANDED — see P0-4 row).
- **Inputs:** `fw-evolution/census.md` (fleet usage census, 76 apps / 77 entries),
  `fw-evolution/internal-audit.md` (framework architecture audit),
  `fw-evolution/external-lessons.md` (WeChat / Telegram / CrazyGames SDK patterns)
- **Baselines that stay green:** framework vitest 354/354 (26 files), apps/shared vitest 4313+/4314
  (392 files), contracts dotnet 440/440, edge deno 169/169.
- **Law:** back-compat. Every change below is additive or byte-identical-behavior refactoring.
  No existing app-facing signature changes, no removals — only deprecation JSDoc.

## 0. Selection discipline

Every P-item below is justified by census data with **≥3 apps affected** (most are 11–61 apps).
Ranking = (apps affected × lines killed × standardization risk removed), gated by "implementable in
one campaign". External-lesson patterns were adopted only where they map onto a measured pain
(e.g. L7 guest saves ↔ B2/B9; L11 conventions ↔ §3 inconsistencies); the rest are non-goals (§7).

Quantified target: **≈9,000+ app lines deleted** across ~65 apps, plus index.ts shrinking from
2,589 to <400 lines, plus one written convention doc that stops new drift.

---

## 1. Prioritized change list

### P0 — must land (foundation + highest reach)

---

#### P0-1. Decompose `framework/index.ts` into Wave-1-style surface factories + publish an explicit `MiniAppFramework` interface

**What it kills:** the 2,589-line monolith (index.ts) where 8 surfaces live inside one 1,660-line
closure — un-testable in isolation, un-reviewable API (`MiniAppFramework = ReturnType<typeof
createMiniAppFramework>` at index.ts:2460 means no per-member JSDoc, no diffable contract).
This is the prerequisite for every other P-item: new surfaces (fmt, runner, pending) need a home
that is not the monolith.

**Exact API (types only — the app-facing surface is unchanged, now explicit):**

```ts
// framework/types.ts (moved verbatim from index.ts:65–533, re-exported from index.ts)
// framework/index.ts (after):
export interface MiniAppFramework {
  chain: MiniAppFrameworkChainSurface;
  funds: MiniAppFrameworkFundsSurface;
  wallet: MiniAppFrameworkWalletSurface;
  mode: FrameworkModeSurface;
  game: MiniAppFrameworkGameSurface;
  actions: MiniAppFrameworkActionsSurface;
  operations: MiniAppFrameworkOperationsSurface;
  notify: MiniAppFrameworkNotify;
  storage: MiniAppFrameworkStorageSurface;
  state: MiniAppFrameworkStateSurface;
  oracle: MiniAppFrameworkOracleSurface;
  platform: MiniAppFrameworkPlatformSurface;
  amount: MiniAppFrameworkAmountSurface;
  events: MiniAppFrameworkEventsSurface;
  // … every existing member, spelled out with JSDoc + @deprecated where applicable
}
export function createMiniAppFramework(options: MiniAppFrameworkOptions): MiniAppFramework;
```

New module files (each a `create*Surface(deps)` factory in the proven credits.ts style — see §2
for the full split plan): `chain-surface.ts`, `funds.ts`, `oracle-surface.ts`, `mode.ts`,
`notify-surface.ts`, `storage-surface.ts`, `game-facade.ts`, `amounts-surface.ts`, `types.ts`.

**Boilerplate killed (quantified):** framework-internal; 0 app lines directly, but unblocks
P0-2..P0-7 and turns accidental breaking changes into compile errors for the whole campaign.

**Back-compat strategy:** returned object stays structurally identical (the 354 existing framework
tests are the harness); every extracted symbol is re-exported from `framework/index.ts` so **zero
import breaks** fleet-wide; `MiniAppFramework` keeps its exported name — apps that type
`app: MiniAppFramework` (86 sites) see the same shape, now with hover docs. `assertNotGuest` /
`getPermissions` thread as injected deps exactly as credits.ts already receives them.

**Migration recipe:** none for apps (framework-only). Internal order: (1) land the missing test
suites first as the safety net — `achievements`, `db.collection`, `stats.increment`,
`state.persisted`, `storage.hybrid`, `platform.host` (internal-audit §9 verified gaps); (2) extract
one surface per PR-sized change, `npx vitest run` after each; (3) declare the factory
`: MiniAppFramework` last, fixing any inference drift the interface exposes.

---

#### P0-2. Write-lane guard middleware + `singleFlight` utility (guard ordering true by construction)

**What it kills:** 31 hand-inlined `assertNotGuest()` sites + 22 `require("invoke:primary"|…)`
sites where the guest→permission→notify→reload ordering is maintained by convention only; plus the
two divergent single-flight implementations (`actions.run` drop-mode with silent-undefined on
typo'd keys — a live DX trap; `credits.spend` join-mode).

**Exact API (framework-internal, not app-facing):**

```ts
// framework/internal/guards.ts
export interface FrameworkWritePolicy {
  /** S11 permission required, or null for the deliberate ungated lanes. */
  permission: string | null;
  /** Guest-mode guard (default true). Named false only for documented exemptions. */
  guestGuard?: boolean;
}
export function guardedWrite<A extends unknown[], R>(
  deps: { assertNotGuest(): void; requirePermission(name: string): void },
  policy: FrameworkWritePolicy,
  run: (...args: A) => Promise<R>,
): (...args: A) => Promise<R>;

// framework/utils/async-utils.ts
export function singleFlight<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
  options: { mode: "join" },
): (...args: A) => Promise<R>;
export function singleFlight<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
  options: { mode: "drop"; onDrop?: (key: string) => void },
): (...args: A) => Promise<R | undefined>;
```

Deliberate exemptions become named policies (verbatim behavior preserved): `credits.spend`
(guestGuard, no payments permission), `oracle.seal.store` (guestGuard, no oracle:request),
guest-leaderboard submit routing (no throw — routes to namespace). The one standardization gap
found — `app.aa` write lanes (relay / sponsorship.request / sessionKey.create) carry **no** S11
permission — is resolved as `permission: "aa"` registered **default-allow** (back-compat: no app
behavior change; the gate now exists and is documentable).

**Boilerplate killed:** framework-internal (~53 stanza sites collapse); apps gain a dev-visible
`console.warn` (dev only) when `actions.run` drops a call or hits an unknown key — default return
values unchanged.

**Back-compat strategy:** pure refactor; mode-guard + reward-permission-gate tests plus the full
354 must stay green. `actions.run` still returns `undefined` on drop/unknown — only a dev warning
is added.

**Migration recipe:** none for apps.

---

#### P0-3. Blessed `app.fmt` display helpers

**What it kills (census B5):** 25+ local `shortAddr/shortHash/shortTxid/truncateMiddle` defs across
~20 apps (color-clash has two: PlayArea.tsx:82 + PhaserPlayArea.tsx:51), 15 local `formatGas`-family
defs (red-envelope has three), 235 raw `1e8`/`100000000` conversion lines across 42 apps, 18
`formatClock` defs — all while `framework/utils/format.ts` already ships the implementations but
apps don't discover them from `ctx.framework`. **≈700 lines across ~45 apps + visual consistency.**

**Exact API:**

```ts
export interface FrameworkFmt {
  /** NEO address → "NUVx…9fKq". Delegates to utils/format.formatAddress. */
  address(value?: string, opts?: { head?: number; tail?: number }): string;
  /** Tx/contract hash → "0x1a2b…9f0e". Delegates to formatHash. */
  hash(value?: string, opts?: { head?: number; tail?: number }): string;
  /** GAS fixed8 base units → decimal display string. Delegates to formatGas. */
  gas(amountFixed8: bigint | number | string, opts?: { decimals?: number }): string;
  /** Generic fixed8 → decimal display. Delegates to formatFixed8. */
  fixed8(value: bigint | number | string, opts?: { decimals?: number }): string;
  /** Seconds-until-target → "1h 02m 03s" countdown. Delegates to formatCountdown. */
  countdown(targetSeconds: number): string;
  /** Elapsed/remaining ms → "mm:ss" clock (the 18-def formatClock consolidation). */
  clock(ms: number): string;
  number(value: number | string, decimals?: number): string;
  compact(value: number): string; // 12_400 → "12.4K"
}
// New member on MiniAppFramework:
readonly fmt: FrameworkFmt;
```

**Back-compat strategy:** purely additive member; every function delegates to the existing
`utils/format.ts` implementations (single source of truth — no new formatting logic, so output is
byte-identical to what shared-format-importing apps already render). `clock` is the only new
implementation; its behavior is specified by the majority signature of the 18 fleet copies
(mm:ss, zero-padded).

**Migration recipe (mechanical, per app):** delete local `shortAddr`/`formatGas`/`formatClock`
defs → replace call sites with `app.fmt.address(...)` / `app.fmt.gas(...)` / `app.fmt.clock(...)`;
replace `x / 1e8` display math with `app.fmt.gas(x)` where it feeds UI (leave protocol math on
`app.amount`). Verify with `npm --prefix apps/<slug> run build` + visual spot-check; design-token
tests unaffected.

---

#### P0-4. Error-to-message one-liner: `app.errors.messageOf` + `ctx.setError`

**What it kills (census B6):** `error instanceof Error ? error.message : …` — **232 occurrences
across 61 apps**, nearly all feeding `ctx.setStatus(…, "error")` (612 sites / 44 apps). The
framework already centralizes `errorMessage()`/chain-error mapping internally but exports no
one-liner for the setStatus lane. **≈460 lines + consistent chain-error copy fleet-wide.**

**Exact API:**

```ts
// framework/utils/errors.ts (exported; already the home of formatErrorMessage/isMiniAppError)
export function errorMessage(error: unknown, fallback?: string): string;

// New member on MiniAppFramework:
readonly errors: {
  /** One-liner: MiniAppError userMessage > mapped chain-error copy > Error.message > fallback. */
  messageOf(error: unknown, fallback?: string): string;
  /** Typed code check across all Framework*Error classes. */
  is(error: unknown, code: string): boolean;
};

// Addition to MiniAppFrameworkContext (defineMiniApp ctx):
/** Sugar for ctx.setStatus(app.errors.messageOf(error, t(fallbackKey)), "error"). */
setError(error: unknown, fallbackKey?: string): void;
```

**Back-compat strategy:** additive export + additive ctx member. `messageOf` routes through the
existing internal chain-error mapping so messages match what `notify.error` already shows — the
two feedback lanes converge on identical copy. i18n: `fallbackKey` resolves through the app's
existing translator (en+zh), matching current setStatus usage.

**Migration recipe:** regex-assisted per app: `ctx.setStatus(error instanceof Error ?
error.message : <fallback>, "error")` → `ctx.setError(error, <fallbackKey>)`; bare ternaries not
feeding setStatus → `app.errors.messageOf(error, fallback)`. 232 sites, ~30 seconds each.

---

#### P0-5. `wallet.onAccountChanged` — identity-diff account-change hook

**What it kills (census B8):** 35 apps wiring `chain.address.subscribe` / `wallet.observe().subscribe`
(43 sites) with the same 10–15-line "diff identity → reload or reset" block (three fleet variants;
exemplar color-clash/src/main.tsx:141). **≈420 lines across 35 apps** + eliminates the
subtle-bug class where apps forget the identity diff and reload on every emission.

**Exact API:**

```ts
export interface FrameworkAccountChange {
  previous: string | null;
  current: string | null;
}
// New method on the wallet surface:
onAccountChanged(
  handler: (change: FrameworkAccountChange) => void | Promise<void>,
  options?: {
    /** Fire once immediately with { previous: null, current } (default false). */
    immediate?: boolean;
  },
): () => void; // unsubscribe
```

Semantics: fires **only** when the normalized address actually differs (identity diff built in),
never for balance-only emissions; handler errors are caught and logged, never thrown into the
subscription. Session-reset flows (the reward-game "wallet changed mid-run" case) are consumed by
the P0-7 runner, which wires this internally.

**Back-compat strategy:** additive method on `wallet.ts` (a Wave-1 module — natural home); existing
`observe()`/`chain.address.subscribe` untouched.

**Migration recipe:** replace each subscribe-block with
`app.wallet.onAccountChanged(({ current }) => { reset(); if (current) void reloadAll(); })`.
43 sites; delete the local `lastIdentity` bookkeeping variable each carries.

---

#### P0-6. Ergonomic typed read lane: `chain.query(...)` chainable result

**What it kills (census B3):** 342 `chain.readRaw` call-sites across 45 apps followed by **99
hand-rolled `parse*` functions in 39 apps** + 65 adjacent coercion lines (exemplar
aa-permissions-lab/src/composables/useAAPermissionsLab.ts:239-242 — four parallel readRaw + manual
parse). The existing typed `chain.read(spec)` has ~0 adopters and `chain.enumerate` has 0 — the
spec-object shape is the ergonomic failure, not the idea. **≈1,200 lines + type safety, 39+ apps.**

**Exact API:**

```ts
export interface FrameworkReadOptions {
  scriptHash?: string;
  cache?: boolean;
  cacheTtlMs?: number;
}
export interface FrameworkQueryResult {
  /** The untyped escape hatch (≡ readRaw). */
  raw(): Promise<unknown>;
  asInt(fallback?: number): Promise<number>;
  asBigInt(fallback?: bigint): Promise<bigint>;
  asString(fallback?: string): Promise<string>;
  asBool(fallback?: boolean): Promise<boolean>;
  /** Hash160 stack item → NEO address string. */
  asAddress(fallback?: string): Promise<string>;
  asArray(): Promise<unknown[]>;
  /** Typed struct/map decode: field-name → coercer. Missing fields hit the coercer with undefined. */
  asMap<T>(shape: { [K in keyof T]: (raw: unknown) => T[K] }): Promise<T>;
  /** Custom parser (the FrameworkReadSpec.parse lane, chainable). */
  as<T>(parse: (raw: unknown) => T): Promise<T>;
}
// New method on the chain surface (readRaw/read(spec) unchanged, spec form deprecated):
query(operation: string, args?: FrameworkContractArg[], options?: FrameworkReadOptions): FrameworkQueryResult;
```

Coercers reuse `utils/parsers.ts` (`parseBigInt`, `parseBool`) and the neo stack-item decoding that
`readArray`/enumerate already contain — no new parsing logic, one canonical decode.

**Back-compat strategy:** additive method; `readRaw` stays forever (it IS `query(...).raw()`);
`chain.read(spec)` and `chain.enumerate` get `@deprecated` JSDoc pointing at `query` (0 and 0
consumers — deprecation is free). The `options?: unknown` holes on read/readRaw get the real
`FrameworkReadOptions` type (widening `unknown` → concrete is safe).

**Migration recipe (mechanical, highest-volume item):** per app, each
`parse*(await app.chain.readRaw(op, args))` → `await app.chain.query(op, args).asInt()` /
`.asMap<T>({...})`; then delete the now-unused local `parse*` function. Start with the 6 hotspot
apps (gasbox, aa-permissions-lab, gas-sponsor, gas-lucky-pool, neo-multisig, neo-ns), validate
byte-identical rendering, then sweep the remaining 33.

---

#### P0-7. Reward-game lifecycle runner: `game.reward(config).runner(hooks)`

**What it kills (census B1 — the #1 item):** each of the 11 TEE reward games hand-wires the same
lifecycle state machine in main.tsx (mains 562–1292 lines): openSession wrapper (~50 lines × 9
mains, color-clash/src/main.tsx:492-537), resumeSession + replayOps (~40 × 11, sudoku/src/main.tsx:323),
settlement apply + finalize-confirm snapshot verify (color-clash:578-625), wallet-change session
reset (color-clash:141-157 + 4 siblings), the refreshBalances/refreshStats/loadLeaderboard trio
(13/11/11 mains), and the standard four actions re-registered in 11 mains each
(aim-master/src/main.tsx:747). **≈300 lines × 11 games ≈ 3,300 lines.**

**Exact API:**

```ts
export type FrameworkRewardPhase =
  | "idle" | "dealing" | "deal-pending" | "playing" | "finalizing"
  | "settlement-pending" | "settled" | "expired" | "error";

export interface FrameworkRewardRunnerHooks<Op extends TeeSessionOp, View> {
  /** Build the fresh deterministic game view for a newly opened session. */
  createView(session: RewardGameSession): View;
  /** Apply one op — used identically for live play and resume-replay. */
  applyOp(view: View, op: Op): View;
  /** Finalize-confirm verification: does the local view match the snapshot? (default: accept) */
  verifyView?(view: View, snapshot: RewardGameSnapshot): boolean;
  /** Optional phase-transition tap (drive ctx.setStatus / scene changes). */
  onPhase?(phase: FrameworkRewardPhase, detail?: { error?: unknown }): void;
}

export interface FrameworkRewardRunner<Op extends TeeSessionOp, View> {
  readonly phase: Observable<FrameworkRewardPhase>;
  readonly view: Observable<View | null>;
  readonly session: Observable<RewardGameSession | null>;
  readonly balances: Observable<RewardGameBalances | null>;
  readonly stats: Observable<unknown | null>;
  readonly leaderboard: Observable<Array<{ user: string; score: string }>>;
  /** openSession: dealing gate → identity/commitment verify → observable fan-out → "deal-pending". */
  start(options?: { modeKey?: string }): Promise<void>;
  /** recoverActive + storage.load + replayOps + phase reconstruction. True if a run was resumed. */
  resume(): Promise<boolean>;
  record(op: Op): Promise<void>;
  /** finalize + settlement observe + snapshot verify → "settled" | "error". */
  finalize(): Promise<void>;
  withdraw(): Promise<void>;
  expire(): Promise<void>;
  /** refreshBalances + refreshStats + loadLeaderboard, single-flighted. */
  refresh(): Promise<void>;
  /** Registers withdrawWinnings / refreshLeaderboard / expireGame / retryDeal with standard bodies. */
  registerStandardActions(actions: MiniAppFramework["actions"]): void;
  dispose(): void;
}

// New method on the object returned by game.reward(config):
runner<Op extends TeeSessionOp, View>(
  hooks: FrameworkRewardRunnerHooks<Op, View>,
): FrameworkRewardRunner<Op, View>;
```

Wallet-change reset is wired internally via P0-5 (`onAccountChanged` → session=null →
"settlement-pending" when a settlement was in flight — the exact color-clash semantics). Storage
uses the existing `createLocalStorageRewardGameStorage`. Runner lives in a new
`gamefi/reward-runner.ts` composing the existing SDK primitives — the primitives stay exported
(back-compat + escape hatch).

**Back-compat strategy:** additive method; `game.reward()`'s existing primitives
(start/openSession/recordOp/replayOps/finalize/recoverActive/expire/withdrawCredit/snapshot/
observeSettlement) are unchanged and remain the runner's implementation substrate.

**Migration recipe (per game, the campaign's flagship migration):** (1) extract the game's
deterministic step logic into `applyOp`/`createView` (it already exists as pure functions in every
game's logic/ dir); (2) replace the main.tsx openSession/resume/settle/withdraw/refresh blocks with
runner calls; (3) replace the four hand-registered actions with `registerStandardActions`; (4) keep
game-specific actions untouched. Pilot on color-clash (the census exemplar), diff observable
behavior against the pre-migration main, then roll to the other 10. Expected: mains shrink ~250–400
lines each.

---

### P1 — should land (high value, after P0 foundation)

---

#### P1-1. Guest-engine kit: `framework/game/guest-kit.ts`

**Kills (census B2):** the scaffold portion of 20 duplicated `src/logic/guest-engine.ts` files
(235–578 lines each): structural `interface Obs<T>` redeclared 19×, `GuestLeaderboardApi` 17×,
Web-Crypto RNG (27 apps), `guestLeaderboard.get(50)` mapping (8+), `clampDifficulty` (13 defs).
**≈70 × 20 ≈ 1,400 lines.** Game rules stay local — only the scaffold moves.

```ts
// framework/game/guest-kit.ts
export type { Obs } from "../reactive"; // the structural observable shape apps redeclare
export interface GuestRng {
  random(): number;                 // Web-Crypto uniform [0,1)
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}
export function createGuestRng(): GuestRng;
export function clampDifficulty(value: unknown, min?: number, max?: number): number;
export interface GuestLeaderboardEntry { user: string; score: string; rank: number; }
export function createGuestLeaderboardAdapter(
  mode: FrameworkModeSurface,
  options?: { limit?: number }, // default 50
): { refresh(): Promise<GuestLeaderboardEntry[]>; submit(score: number | string): Promise<void> };
export function createGuestPersistence<TState>(
  storage: { get<T>(key: string): T | null; set(key: string, value: unknown): void; remove(key: string): void },
  key: string,
  version: number,
): { load(): TState | null; save(state: TState): void; clear(): void };
```

**Back-compat:** new module, additive. **Migration:** per game, delete the scaffold sections of
guest-engine.ts and import from the kit; game logic diff must be empty (guest-engine tests per
app are the harness — they exist in all 20 games).

#### P1-2. `game.rules(config)` factory

**Kills (census B4):** 13 near-identical `src/logic/game-rules.ts` (~80–130 lines) with
exact-signature `ruleOf/formatClock/statusOf/gasDisplay/rewardPctAfterUndos/payoutFixed8/
SETTLEMENT_GRACE_MS` duplicates. **≈1,000 lines.**

```ts
export interface FrameworkGameRuleConfig {
  difficulties: Record<string, { stakeFixed8: bigint; label?: string; meta?: Record<string, unknown> }>;
  payout: { basePct: number; undoPenaltyPct?: number; maxUndos?: number };
  settlementGraceMs?: number; // default: fleet-standard constant
}
export interface FrameworkGameRules {
  ruleOf(difficulty: string): { stakeFixed8: bigint; label: string; meta: Record<string, unknown> };
  statusOf(raw: unknown): RewardGameStatus;         // delegates to rewardGameStatusOf
  gasDisplay(fixed8: bigint | string): string;      // delegates to app.fmt.gas
  formatClock(ms: number): string;                  // delegates to app.fmt.clock
  rewardPctAfterUndos(undos: number): number;
  payoutFixed8(stakeFixed8: bigint, pct: number): bigint;
  canReleaseExpiredGame(state: { finishedAt: number }, nowMs: number): boolean;
  readonly settlementGraceMs: number;
}
// New method on the game surface:
rules(config: FrameworkGameRuleConfig): FrameworkGameRules;
```

**Back-compat:** additive. **Migration:** per game, replace game-rules.ts body with
`export const rules = app.game.rules({ ...constants })` re-exports; constants (the actual per-game
diff) stay in the app. Existing game-rules tests keep passing against the re-exports.

#### P1-3. Guest-guard action option (kills the 188 hand-guards)

**Kills (census B1/B8, opportunity #6):** 188 hand-written `if (app.mode.isGuest()) { …return }`
early-return guards inside action handlers in 18 apps + the 26 re-registered `connectWallet`
bodies. **≈600 lines.**

```ts
// Additive fields on FrameworkActionOptions:
export interface FrameworkActionOptions<TResult = unknown> {
  // …existing…
  /** Block in guest mode with the standard status copy (or a custom key). */
  guestBlocked?: boolean | { statusKey: string };
}
// New convenience on the actions surface:
registerConnectWallet(options?: {
  refresh?: Array<() => Promise<void>>;
  successKey?: string;
}): void; // standard body: isConnecting single-flight → ensureWallet → refresh fan-out → status
```

**Back-compat:** additive option + additive method. **Migration:** delete the guard block, add
`guestBlocked: true`; replace local connectWallet registration with `registerConnectWallet({...})`.

#### P1-4. Pending-tx durability lane: `chain.pending`

**Kills (census B9):** 17 apps hand-rolling `PENDING_STORAGE_KEY` persist→poll→restore (~65-line
`restorePendingBets`-style blocks, dice-game/src/main.tsx:782). Generalizes the proven
`wallet.pendingOperation` (dev-tipping family only today). **≈680 lines.**

```ts
export interface FrameworkPendingTx<TMeta = unknown> {
  txid: string;
  meta: TMeta;
  createdAt: number;
}
export interface FrameworkPendingHandlers<TMeta> {
  /** Poll predicate — true once the tx's effect is observable (event/state). */
  isSettled(entry: FrameworkPendingTx<TMeta>): Promise<boolean>;
  onSettled(entry: FrameworkPendingTx<TMeta>): void | Promise<void>;
  onExpired?(entry: FrameworkPendingTx<TMeta>): void | Promise<void>;
}
// New sub-surface on chain:
readonly pending: {
  /** Persist + start polling (survives reload via storage.local under a framework-owned key). */
  track<TMeta>(lane: string, entry: { txid: string; meta: TMeta },
               handlers: FrameworkPendingHandlers<TMeta>,
               options?: { pollMs?: number; ttlMs?: number }): void;
  /** Re-arm persisted entries after reload; returns the number restored. */
  restore<TMeta>(lane: string, handlers: FrameworkPendingHandlers<TMeta>,
                 options?: { pollMs?: number; ttlMs?: number }): Promise<number>;
  list(lane: string): FrameworkPendingTx[];
  clear(lane: string, txid?: string): void;
};
```

**Back-compat:** additive; `wallet.pendingOperation` untouched (deprecation JSDoc pointing here
once the dev-tipping family migrates). **Migration:** per app, replace the local key + restore
loop with `track`/`restore`; the app keeps only `isSettled`/`onSettled` bodies.

#### P1-5. Write-path consolidation (bless `chain.write`, document the payment decision rule)

**Kills (census §3 + opportunity #11):** the 4-idiom write split — 43 apps hand-wrap raw
`chain.invoke` in try/catch+setStatus while `chain.write` (the S2 notify-policy lane) has exactly
1 consumer; payment split between `invokeWithPayment` (13 apps) and `funds.*` (10 apps, 5 using
both) with no decision rule.

No new API. Deliverables: (a) `@deprecated`-free but *"prefer `chain.write`"* JSDoc on
`chain.invoke` + an `@example` showing the write-spec equivalent; (b) a decision table in
SURFACES.md (§P2-4): *app-contract call carrying payment with memo/receipt semantics → `funds.payAndCall`
/ `prepayAndCall` / `receiptPay`; plain transfer bundled with a call → `chain.invokeWithPayment`;
no payment → `chain.write`; raw `invoke` = escape hatch only*; (c) migration of the 43 try/catch
sites to `chain.write({ operation, args, successKey, errorKey, reload })`.

**Back-compat:** zero API change; invoke stays. **Migration:** mechanical spec-object rewrite per
site; toast copy must match the app's existing catch-block copy (use `notify: "errors"` where apps
only toasted failures).

#### P1-6. Operations aggregate + adoption push

**Kills (census B7):** 130 status/error/loading observable trios + 345 `createObservable(false)`
busy flags across 35 composable-heavy apps vs 11 adopters of `operations.create`. **≈600 lines
across ~25 apps.**

```ts
// New method on the operations surface:
combine(ops: Array<{ state: Observable<FrameworkOperationState> }>): Observable<{
  busy: boolean;
  running: string[];       // keys of running ops
  lastError: string;       // most recent failure message, "" if none
}>;
```

**Back-compat:** additive. **Migration:** per composable, replace each
`const xBusy/xError/xStatus` trio with one `operations.create(key)` + read
`op.state`; aggregate spinners move to `operations.combine`. Migrate the top-5 heaviest
composable apps (gasbox first — ~25 cells) as exemplars; rest opportunistic.

#### P1-7. Platform helpers: typed params, network, explorer links

**Kills (census B10 + §5):** raw `ctx.launchContext` in 33 apps / 156 sites, 6 duplicated 48-line
`src/launch.ts` schema wrappers, 4 identical 22-line `utils/explorer.ts`, 5 apps inline-building
`/tx/` links, 8 console apps sharing an appConfig preamble. **≈500 lines.**

```ts
// New members on the platform surface:
params<T>(schema: { [K in keyof T]: (raw: string | undefined) => T[K] }): T;
network(): { name: string; isMainnet: boolean };
readonly explorer: {
  tx(txid: string): string;
  address(address: string): string;
  contract(scriptHash: string): string;
};
```

**Back-compat:** additive; `platform.param` and raw launchContext untouched. **Migration:**
delete launch.ts/explorer.ts, replace with `platform.params({...})` (coercers from utils/parsers)
and `platform.explorer.tx(...)`.

#### P1-8. Error-taxonomy + conversion-core consolidation (framework-only correctness)

**Kills (internal-audit §5/§7):** 4 gas→fixed8 parsers with 3 error semantics (2 byte-duplicate
bodies), 3 address→Hash160 converters, 2 `normalizeTxid` with **opposite** normal forms (a latent
cross-module comparison bug); `RewardGameError extends Error` invisible to `isMiniAppError()`;
uncoded plain-`Error` validation throws in arg builders/amount parsers/oracle.http.

```ts
// framework/utils/amounts.ts — single cores, thin wrappers keep exact per-site semantics:
export function parseGasFixed8Core(value: bigint | number | string, allowZero: boolean):
  { ok: true; fixed8: bigint } | { ok: false; reason: string };
// framework/utils/transaction.ts:
export function normalizeTxid(value: string, form: "0x" | "bare"): string;
// framework/errors.ts — canonical home; existing modules re-export the SAME class objects:
export type FrameworkErrorCode = /* closed union of every code string in the SDK */;
// gamefi/reward-game-sdk.ts:
export class RewardGameError extends MiniAppError { /* code/message preserved */ }
```

**Back-compat:** byte-identical behavior mandate — wrappers preserve each call site's exact
throw-type/return-type/message (the "0n-on-invalid" lane in utils/amounts keeps its name and
semantics); `RewardGameError` still `instanceof Error` with `.code`; re-exports keep import paths
AND class identity. **Migration:** none for apps.

---

### P2 — stretch (small wins, docs, deprecation hygiene)

#### P2-1. `useNowMs` clock hook + framework clock observable

**Kills (census B11):** 17 apps hand-rolling `useState(Date.now())` + `setInterval` tickers in
PlayAreas with intervals drifting 250ms–30s and no visibility pause. **≈140 lines + correctness.**

```ts
// framework/react/use-now-ms.ts (react already a framework dep via PhaserGameComponent)
export function useNowMs(stepMs?: number /* default 1000 */,
                         options?: { pauseWhenHidden?: boolean /* default true */ }): number;
// non-react consumers (Phaser scenes):
// new on MiniAppFramework: clock: { now(stepMs?: number): Observable<number> }
```

**Migration:** replace local ticker effects; verify countdown displays unchanged.

#### P2-2. `waitForState` v2

**Kills (census B12):** 14 apps hand-rolling attempt/deadline poll loops vs 9 adopters. **≈300 lines.**

```ts
// Additive fields on FrameworkWaitForStateOptions:
export interface FrameworkWaitForStateOptions {
  // …existing…
  signal?: AbortSignal;
  backoff?: "fixed" | "exponential";  // default "fixed" (current behavior)
  maxIntervalMs?: number;             // exponential cap
}
```

**Migration:** rewrite each hand-rolled loop as `chain.waitForState(read, until, opts)`.

#### P2-3. Dead-surface deprecation pass

**Kills (census §4, opportunity #15):** the API surface devs must learn. `@deprecated` JSDoc (no
removals — removals need a major) on: `db.collection` (0 consumers), top-level `stats.increment/
dispatch` (0), `achievements` (0–1), `resources` (0), `share` (0), `storage.hybrid` (0),
`chain.enumerate` (0), `chain.read(spec)` typed form (0 — superseded by P0-6 `query`),
`chain.events()` (alias of `app.events.list`), plus the legacy apps/shared shims
`useAllEvents`/`useWalletBalanceReader`/`useAbstractAccount` (0 consumers each). Each tag names
the replacement. **Framework-only; zero behavior change.**

#### P2-4. Documentation completion: SURFACES.md + README refresh + legacy JSDoc

**Kills (internal-audit §8):** the undocumented-semantics class of bug. Deliverables: JSDoc +
`@example` for `state`/`storage`/`db`/`actions` (drop-mode!)/`operations`/`stats` (document the
non-atomic RMW)/`achievements`; a `framework/SURFACES.md` matrix — surface × guest-guard × S11
permission × degradation × config requirement; a "which of the three leaderboards" decision table
(stats.leaderboard / game.leaderboard / mode.guestLeaderboard); README refresh past its pre-Wave-1
snapshot (mode/guest, credits, permissions, aa, clipboard, events, lifecycle.poll).

---

## 2. Module split plan for index.ts (additive re-export, zero import breaks)

Current: index.ts = 2,589 lines — 30+ exported types (65–533), error translation (550–633),
private helpers (668–792), then a 1,660-line factory closure (794–2458) defining 8 surfaces inline,
then `MiniAppFramework = ReturnType<…>` (2460) and re-export barrels (2470+).

| Step | New file | Moves (index.ts lines) | Injected deps |
|---|---|---|---|
| 0 | *(tests first)* | new suites: achievements, db.collection, stats.increment, state.persisted, storage.hybrid, platform.host | — safety net (internal-audit §9 gaps) |
| 1 | `types.ts` | all exported types 65–533 | none |
| 2 | `internal/guards.ts` + `utils/async-utils.ts` additions | guardedWrite, singleFlight (P0-2) | assertNotGuest, permissions |
| 3 | `notify-surface.ts` | appNotify, runWithNotify, toastSuccess, resolveSuccessParams (668–673, 902–1028) | host notify, i18n |
| 4 | `mode.ts` | mode surface + guest leaderboard + `createGuestGuard()` factory (1430–1497) | os.leaderboard |
| 5 | `storage-surface.ts` | local/remote/hybrid + db.collection + state atoms (821–900, 1527–1572) | host storage, parseJson |
| 6 | `chain-surface.ts` | arg builders (1201), read/readRaw/**query (P0-6)**/readArray/invoke/write/invokeMultiple/signMessage/waitForState/enumerate/**pending (P1-4)** (1608–1857) | raw chain, guards, notify |
| 7 | `funds.ts` | pay lanes + FrameworkPrepaidActionError + prepayViaDepositLane (550–633, 1313–1369, 1917–2041) | chain, guards, notify |
| 8 | `oracle-surface.ts` | envelope builders + dispatch + seal hybrid (1185–1199, 2097–2188) | guards, oracle-ext |
| 9 | `amounts-surface.ts` | amount object + gasFixed8Amount/neoWholeAmount (726–792, 1251–1311) | utils/amounts cores (P1-8) |
| 10 | `game-facade.ts` | app.game.* incl. rewardChain adapter (1382–2454) + **fmt (P0-3)** home in `fmt-surface.ts` | chain, mode, wallet |
| 11 | `index.ts` finale | declare factory `: MiniAppFramework` (explicit interface, P0-1) | — |

Rules for every step:
- **Factory style:** `export function createXSurface(deps: XSurfaceDeps): XSurface` — structural
  dep injection, exactly the credits.ts / Wave-1 pattern. `assertNotGuest`/`getPermissions` thread
  as deps (proven: credits.ts already receives them).
- **Re-export everything** moved from `framework/index.ts` (values AND types) so every existing
  import path — `from "../framework"` or deep — keeps resolving. Class identities preserved by
  re-exporting the same objects (MiniAppError single-identity discipline already documents this).
- **Gate per step:** `cd framework && npx vitest run` (354/354) after each extraction; a returned-
  object shape snapshot test (`Object.keys` deep walk, added in step 0) guards structural identity.
- **No behavior edits ride along.** Behavior changes (P0-2 warnings, P1-8 error classes) land as
  separate changes after the mechanical move of the code they touch.

Result: index.ts <400 lines = imports + `createMiniAppFramework` composition (the existing
`lazyModule` wiring extends to the new factories) + barrel.

## 3. Framework style guide (naming / error / async conventions for all future surfaces)

To be committed as `framework/CONVENTIONS.md`; enforced in review and by the explicit interface.

**Naming**
- Factories for stateful objects: `create*` (`createGuestRng`, `createXSurface`). Surface members
  are nouns; methods are verbs.
- Subscriptions: `on*(handler) => unsubscribe` — every subscribe returns its own unsubscribe
  (no separate `off*` needed, but never a subscription without a returned disposer). Value-
  delivering callbacks (`onChange(mode => …)`, `onAccountChanged(change => …)`) are the standard;
  the bare `Observable.subscribe(() => void)` stays for back-compat but new APIs deliver values.
- Waiting vs observing: `waitFor*` = bounded, promise-resolving `value | null`;
  `observe*` = returns an Observable/handle. Never mix.
- Accessors: observable state = property of type `Observable<T>` (e.g. `mode.current`); sync
  snapshot = noun function (`wallet.address()`, `mode.get()`); remote read = async verb
  (`credits.balance()`). New surfaces must not add a fourth idiom.
- Trust naming: any unverified convenience parse of a signed payload carries the `Unsafe` suffix.
- One concept, one home: no cross-surface duplicates (`chain.events()` vs `events.list()` is the
  cautionary tale — deprecate the older name with a pointing alias).

**Options objects & evolution**
- Any function that could ever grow a third parameter takes a single options object; evolution is
  additive optional fields only. Positional params are capped at two (subject, args).
- New optional capabilities follow the config-injection pattern (credits/oracle-ext): absent
  config → surface exists, methods throw `FrameworkCapabilityError` with a stable code.
- Deprecation: `@deprecated Use x.y — <one-line reason>` JSDoc; the deprecated symbol delegates to
  the replacement (aliases stay consistent forever; removals only in a major).

**Errors**
- All framework-thrown errors extend `MiniAppError` (message, `code`, optional userMessage,
  i18n translator). No plain `throw new Error(...)` in surface code — validation failures are
  coded `ValidationError`s.
- Codes are stable, closed, and registered in the `FrameworkErrorCode` union (P1-8); apps branch
  on `code`, never on message text. `retryable` semantics documented per code.
- User-facing copy resolves through the i18n translator (en+zh); `Error.message` stays technical.

**Async**
- Promise-only (no callback forms). Long-running polls accept `signal?: AbortSignal`.
- Concurrency: reuse `singleFlight(keyOf, fn, { mode })` — `"join"` when callers need the result
  (payments, spends), `"drop"` when re-entry is a user double-click (actions). Drop mode must emit
  a dev-visible warning.
- Write lanes are composed, never hand-ordered: guest guard → permission gate → notify wrap →
  reload-on-success, via `guardedWrite`/`runWithNotify` (P0-2). A new write lane that skips the
  composer is a review rejection.
- Fire-and-forget handlers (subscription callbacks) must be error-isolated: catch, log, never
  propagate into the notifier.

## 4. Framework-only vs app-migration matrix

| Change | Framework-only | App migration | Apps touched | Status |
|---|---|---|---|---|
| P0-1 index.ts split + interface | ✅ | — | 0 | **LANDED (split complete)** — `types.ts` + explicit `MiniAppFramework` interface (factory annotated, excess-property-checked); step-0 safety net landed (shape-snapshot walk + achievements/db/stats/state.persisted/storage.hybrid/platform.host suites); all eight §2 surface factories extracted verbatim in the credits.ts deps-injection style: `mode.ts`, `notify-surface.ts`, `storage-surface.ts`, `amounts-surface.ts`, `chain-surface.ts` (incl. arg builders + query wiring; named write policies moved to `internal/guards.ts`), `funds.ts` (incl. `FrameworkPrepaidActionError` / `revertKeyOf`, identity preserved via re-export), `oracle-surface.ts`, `game-facade.ts` (incl. the guarded reward-chain adapter + runner wiring). Residual follow-up landed too: the remaining small inline members moved verbatim into four more deps-injected factories — `platform-surface.ts` (platform incl. params/network/explorer), `app-state.ts` (state atoms + db.collection), `actions-surface.ts` (actions incl. registerConnectWallet + drop-mode single-flight and dev-warn helpers, operations.create incl. state-machine helpers), `stats-surface.ts` (stats/leaderboard glue + achievements badge lane) — all re-exported from index.ts. index.ts 2,588 → 912 → **643** = 51-line import/type header + ~390-line composition root (pure deps wiring: lazy-module accessors, guardDeps threading, the aa guard wrapper, credits/wallet adapters — the share/bus/resources lazy wirings are one factory call each and stay as composition) + ~198-line back-compat re-export barrel. The RFC's <400 remains unreachable without evicting the barrel or the composition JSDoc — both deliberate residue; no extractable logic remains. Gates: framework vitest 438/438 + tsc clean after each extraction; apps/shared quick regression (mode-surface / defineMiniApp-services / defineMiniApp-setError / game-guest-mode-adoption / miniapp-framework(-adoption)) 236/236; full apps/shared suite 4344/4345 — the 1 failure (graveyard.playarea static-scss pin, `$moss-deep`) is a pre-existing working-tree artifact of concurrent uncommitted apps/graveyard scss edits, no framework import involved. |
| P0-2 guard middleware + singleFlight | ✅ | — | 0 | **LANDED** — `internal/guards.ts` `guardedWrite` adopted on chain/funds/oracle/aa async write lanes (ordering by construction, named exemption policies); `singleFlight` in utils/async-utils; `actions.run` drop-mode via singleFlight + dev-only warnings (drop + unknown key); `"aa"` S11 permission registered DEFAULT-ALLOW (explicit `{ aa: false }` opt-out). game.reward's sync-throwing guards kept inline (sync-throw semantics preserved). credits.spend kept its local join map (byte-identical; refactor optional). |
| P0-3 `app.fmt` | surface | mechanical sweep | ~45 | **LANDED** (`fmt-surface.ts`, delegates to utils/format; new fleet-standard `clock`). App sweep landed with the migration batches. |
| P0-4 `errors.messageOf` / `ctx.setError` | surface | regex-assisted sweep | 61 (232 sites) | **LANDED** (`errors-surface.ts` + `utils/errors.errorMessage` export; copy-convergence with notify.error locked by test). App sweep landed with the migration batches. `ctx.setError` wiring **LANDED**: defineMiniApp/MiniAppRoot publishes `setError(error, fallbackKey?)` on the setup ctx + `MiniAppContextValue` and hands it to the framework ctx (`MiniAppFrameworkContext.setError`); routes through `framework.errors.messageOf` → `setStatus(…, "error")` (fireworks-wrapped lane), with a pre-init raw-message fallback via `utils/errors.errorMessage` (never crashes before framework construction). Pinned by `apps/shared/test/defineMiniApp-setError.test.tsx` (copy-convergence with notify.error, plain Error/string/fallbackKey paths, pre-init safety). Reference recipe migrated in 3 exemplars: color-clash, snake-bounty, merge-kingdom (`ctx.setStatus(app.errors.messageOf(e, ctx.t(k)), "error")` → `ctx.setError(e, k)`; non-"error"-type messageOf sites intentionally kept). |
| P0-5 `wallet.onAccountChanged` | surface | per-site rewrite | 35 (43 sites) | **LANDED** (wallet.ts; identity diff, error-isolated handlers, `immediate` option). App sweep landed with the migration batches. |
| P0-6 `chain.query` typed reads | surface | mechanical, hotspots first | 39–45 (342 sites) | **LANDED** (`chain-query.ts`; lazy single read, value-safe fallback lanes, `asAddress` via new `utils/neo.scriptHashToAddress`; `chain.read(spec)`/`enumerate` @deprecated; readRaw/readArray options typed `FrameworkReadOptions`). App sweep landed with the migration batches (hotspot-first; `raw()` escape hatch remains valid). |
| P0-7 reward runner | surface | flagship migration, pilot color-clash | 11 | **LANDED** (`gamefi/reward-runner.ts` + `game.reward(config).runner(hooks)`; wallet-change reset via P0-5; standard actions; single-flighted start/resume/finalize/refresh). Pilot (color-clash) + game migration landed with the migration batches. |
| P1-1 guest kit | module | scaffold swap | 20 | Proposed |
| P1-2 `game.rules` factory | surface | re-export swap | 13 | **LANDED** (`game-rules.ts` → `app.game.rules(config)`; statusOf/gasDisplay/formatClock delegate to the SDK + fmt implementations; bigint-exact payout math; DEFAULT_SETTLEMENT_GRACE_MS = 600000). App re-export swap landed with the migration batches. |
| P1-3 guestBlocked + registerConnectWallet | surface | delete guards | 18–26 | **LANDED** (`guestBlocked` option on FrameworkActionOptions — early-return + `guestModeBlocked` warn copy; `actions.registerConnectWallet` standard body with error-isolated refresh fan-out; re-entry via the run-lane drop single-flight). App guard-deletion sweep landed with the migration batches. |
| P1-4 `chain.pending` | surface | replace local lanes | 17 | Proposed |
| P1-5 write-path consolidation | docs/JSDoc | try/catch → write-spec | 43 | Proposed |
| P1-6 operations.combine | surface | top-5 composable apps + opportunistic | ~25 | Proposed |
| P1-7 platform params/network/explorer | surface | delete launch.ts/explorer.ts | 33 | **LANDED** (`platform.params(schema)` typed decode, sync `platform.network()`, `platform.explorer.tx/address/contract` on the canonical Dora URLs). App launch.ts/explorer.ts deletion sweep landed with the migration batches. |
| P1-8 error/conversion consolidation | ✅ | — | 0 | Proposed (partial: gas/neo parse cores now single-sourced in `amounts-surface.ts`) |
| P2-1 useNowMs/clock | hook | ticker swap | 17 | Proposed |
| P2-2 waitForState v2 | options | loop rewrite | 14 | Proposed |
| P2-3 deprecation pass | ✅ (JSDoc only) | — | 0 | Partial — `@deprecated` landed on `chain.read(spec)`, `chain.enumerate`, `chain.events`, `storage.hybrid`, `db.collection`, `stats.increment`, `achievements` (via the explicit interface). apps/shared shims pending. |
| P2-4 SURFACES.md + docs | ✅ | — | 0 | Proposed |

Migration sequencing: framework-only items land first (P0-1/2, P1-8, P2-3/4 can proceed anytime);
app sweeps go wide-and-shallow (P0-3/4) before deep-and-narrow (P0-7). Every app edit re-runs its
build + the apps/shared suite; i18n (en+zh) and design-token governance apply to any copy/UI touched.

## 5. Explicit non-goals (this campaign)

1. **No breaking removals.** Dead surfaces get `@deprecated` JSDoc only (P2-3); deletion waits for
   a major version. `readRaw`, `chain.invoke`, `invokeWithPayment`, `Observable.subscribe` all stay.
2. **No host-shell UI chrome API** (external L4 — Telegram-style MainButton). It requires
   `platform/host-app/components/playarea/**`, which is owned by another agent and protected.
   Backlog, not this campaign.
3. **No theme-as-data surface for Phaser canvases** (L5) — same protected-surface dependency plus
   design-governance coordination; backlog.
4. **No new backend rails** (L8 `backend.call`, L12 credits sandbox/`spendWithPrompt` buy-prompt
   scaffold): edge functions and `deploy/**` are out of scope/protected. Credits v2 client surface
   is untouched.
5. **No gameplay/loading lifecycle beacons or interruption pause/mute contract** (L9/L10) — they
   change host behavior, not just the SDK; need host-side consumers first. Backlog with the
   GameBridge auto-emit design noted.
6. **No haptics / celebration / invite-params surfaces** (external honorable mentions) — zero
   census demand; fails the ≥3-apps rule.
7. **No rewrite of per-game logic.** Guest-engine kit (P1-1) and rules factory (P1-2) extract
   *scaffold only*; game rules, tuning constants, and scenes stay in each app.
8. **No storage.hybrid/db revival or replacement design** — deprecate (0 consumers), don't rebuild.
9. **No `state.atom` adoption push** — 12 apps/19 sites is marginal and `createObservable` direct
   use is not harmful; operations adoption (P1-6) is the reactive-state investment instead.
10. **No changes to protected paths:** contracts/MiniAppTarotVrf*, TarotOracleMockFixture*,
    deploy/**, apps/zhuada-e/**, apps/forever-album/**, playarea components, .github/**, .env*,
    edge cors.ts. No test weakening anywhere.

## 6. Campaign risk notes

- **Biggest risk:** P0-7 runner semantics drifting from any of the 11 mains' bespoke edge handling.
  Mitigation: pilot on color-clash (the census exemplar for every block), keep SDK primitives
  exported as the escape hatch, migrate one game at a time with its own vitest + build gate.
- **Volume risk:** P0-6's 342 sites. Mitigation: hotspot-first order, `raw()` escape hatch means
  partial migration is always a valid resting state.
- **Refactor risk:** index.ts split. Mitigation: step-0 test suites for the exact gaps the audit
  verified (achievements/db/stats/state/hybrid/platform.host) + shape-snapshot test + one-surface-
  per-change discipline.

## 7. TEE fetcher lane gating — S11 "oracle:request" on the reward session lanes (Lane 3) — **LANDED**

**Problem.** The reward TEE session lanes (`app.game.reward(...).openSession / recordOp /
replayOps`, threading `rewardOptions.fetcher`) hit the Morpheus oracle session host with NO
manifest permission gate — they bypass `app.oracle`'s "oracle:request" gate; only the guest guard
covered them. Every other side-effect lane on the reward surface (start / finalize / expire /
withdrawCredit) already carries the S11 "invoke:primary" gate.

### 7.1 Call-site enumeration (post-split — the factory files are authoritative)

| Facade lane (`framework/game-facade.ts`) | SDK primitive (`gamefi/reward-game-sdk.ts`) | TEE client call (`logic/tee-session.ts`) | Network traffic | Guards before this change |
|---|---|---|---|---|
| `openSession` | `openRewardGameSession` | `teeSessionStart` | POST `/api/morpheus/session/start` | guest guard only |
| `recordOp` | `recordRewardGameOp` | `teeSessionStep` (+ recovery replay retry) | POST `/api/morpheus/session/step` | guest guard only |
| `replayOps` | `replayRewardGameOps` | `teeSessionStep` per op | POST `/api/morpheus/session/step` | guest guard only |
| `finalize` | `finalizeRewardGame` | `teeSessionSealOpLog` | GET `/api/morpheus/oracle/public-key` + LOCAL encrypt (no session traffic), then the gated broadcast | guest guard + "invoke:primary" pre-gate |
| `runner(hooks)` | delegates to the facade lanes above via its handle | — | — | covered transitively |
| — | — | `teeSessionFinalizePreview` | POST `/api/morpheus/session/finalize` | ZERO framework/app callers (exported, unused) |

The SDK primitives stay exported guard-free (the documented RFC escape hatch, same as
start/expire); no app imports `logic/tee-session` or the primitives directly — all 9 TEE-session
apps go through the facade, so the facade is the correct (and sufficient) gate point.

### 7.2 Permission decision: reuse "oracle:request" (enforced, NOT default-allow)

Weighed "TEE sessions are oracle traffic" (reuse) against "free / no-broadcast — a distinct trust
lane" (new `tee:session`). Reuse wins:

- **Same trust authority.** The session lanes are direct requests to the SAME Morpheus oracle
  host as the `app.oracle` request/dispatch lanes; "may this app request oracle work?" is one
  decision, and `permissions.ts` already documents "oracle:request" as the oracle-lane gate.
- **Negligible over-grant.** Granting "oracle:request" additionally unlocks only the local
  envelope builders (no side effects); `oracle.dispatch` still independently requires
  "invoke:primary" through the `chain.write` lane.
- **No new manifest vocabulary.** A `tee:session` permission would ship with zero live grantees
  and force hosts/console/checklists to learn a fourth permission for what is functionally the
  existing oracle lane.
- **NOT default-allow (unlike "aa").** Fail-closed under a present declaration is the desired
  shape here — see the back-compat table: the only manifests it denies are the pinned-empty
  guest-only releases, whose entire gamefi lifecycle is ALREADY denied at start/finalize/expire/
  withdrawCredit by "invoke:primary". The gate closes the residual ungated path
  (`recoverActive` → `openSession`/`recordOp` reaches the enclave with no broadcast and hence no
  invoke:primary check).

### 7.3 Back-compat table

| Fleet cohort | Facts (verified against the repo) | Effect of the gate |
|---|---|---|
| Hosts delivering NO permission declaration | every current launch lane; `require()` is a no-op | **Unchanged** (default-allow; pinned by test) |
| The 9 pinned-empty TEE session games (aim-master, color-clash, curve-arrow, flappy-dash, game-2048, merge-kingdom, pet-potion, snake-bounty, sudoku) | `neo-manifest.json` `permissions: []` + `platform.transactions: false`; in-app manifest `gamePage.modes: { guest: true, gamefi: false }` → MiniAppRoot forces `mode.set("guest")` at mount, so the guest guard already blocks all three lanes in every real launch | **Deny — desired fail-closed**, unreachable in production (guest guard fires first); only bites a hypothetical gamefi flip that skips the manifest update, which "invoke:primary" already denies at start |
| game.reward consumers WITHOUT the TEE session lanes (red-envelope, gas-lucky-pool — `['invoke:primary','read:blockchain']`, gamefi enabled for red-envelope) | never call openSession/recordOp/replayOps/runner | **Unaffected** |
| Future re-enabled gamefi TEE games | must grant `"oracle:request"` alongside `"invoke:primary"` | **One line in the re-enable checklist** — consistent with how the S11 gates already work |

### 7.4 Implementation + verification

- `game-facade.ts`: `requireOracleRequest()` inline after `assertNotGuest()` on
  openSession/recordOp/replayOps — standard guest→permission→call ordering, kept as INLINE
  SYNC-THROW guards (the P0-2 documented game.reward exemption; `guardedWrite` would convert the
  denial into a rejection and change un-awaited-call semantics). `finalize` deliberately does NOT
  add the gate: its fetcher use is the oracle public-key READ (same endpoint as the ungated
  `app.oracle.seal.publicKey` client) + local encryption; the broadcast stays the
  "invoke:primary"-gated side effect (comment in code).
- Docs: `permissions.ts` header, index.ts `app.permissions` JSDoc, and the
  `FrameworkRewardGameSurface` method JSDoc now name the session-lane gate.
- Tests (`framework/test/reward-permission-gate.test.ts`, +5): pinned-empty denial with ZERO
  fetcher/wallet/read traffic on all three lanes; `['invoke:primary']`-only denial (the
  re-enable-checklist gap); default-allow round-trip through the REAL tee-session client against
  a mock session host; `["oracle:request"]`-alone grant works (free lane needs no
  invoke:primary); guest guard fires before the permission gate on all three lanes.
- Gates: framework vitest 438/438 (34 files) + tsc clean; apps/shared
  `game-guest-mode-adoption` 205/205 + reward-game-sdk / mode-surface /
  miniapp-framework(-adoption) spot-run 37/37.
