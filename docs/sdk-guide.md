# MiniApp SDK Guide — the app-author reference

This is the guide for writing a miniapp against the platform framework
(`framework/`, delivered to your app as `ctx.framework`). It covers the
quickstart, every framework surface with a worked example, the standard
recipes (error handling, wallet changes, typed reads, TEE reward games,
guest/gamefi modes, credits, permissions), the deprecated surfaces and their
successors, and a "which surface do I use?" decision table.

Deeper references:

- `framework/types.ts` — the explicit `MiniAppFramework` interface. Every
  member is JSDoc'd; hover docs in your editor are authoritative.
- `claudedocs/framework-evolution-rfc.md` — why each surface exists and the
  back-compat law (additive only; nothing is ever removed, only deprecated).
- `claudedocs/guest-mode-adoption.md` — the two-mode (guest/gamefi) contract.
- `claudedocs/credit-system-design.md` — the platform credits architecture.

Trust model, unchanged: miniapps never construct or sign Neo transactions
directly. All sensitive actions flow through the host SDK and framework:

`MiniApp → ctx.framework → Host services → Edge (auth/limits) → TEE (attested) → Neo N3`

---

## 1. Quickstart

Every miniapp is a single `defineMiniApp()` call. The platform renders the
shell (header, tabs, wallet, status strip); you provide one PlayArea component
and a `setup(ctx)` function that wires state and actions through
`ctx.framework`.

```ts
import { defineMiniApp, createObservable } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

defineMiniApp({
  appId: "miniapp-example",
  playArea: PlayArea,
  manifest,
  messages, // i18n map — en + zh required for user-facing copy

  setup(ctx) {
    const app = ctx.framework;

    // Observable state — persisted survives reloads (app.storage.local).
    const counter = app.state.persisted("counter", 0);
    const banner = createObservable("");

    // Actions are the ONLY way the PlayArea triggers behavior.
    app.actions.register(
      "increment",
      async () => {
        counter.set(counter.get() + 1);
      },
      { successKey: "saved" },
    );

    return {
      state: { counter, banner }, // PlayArea reads these via useObservable
      loadData: async () => {
        // initial reads — runs on mount and on host-driven reloads
      },
      cleanup: () => {
        // unsubscribe anything you subscribed
      },
    };
  },
});
```

### The setup context (`ctx`)

| Member | What it is |
|---|---|
| `ctx.framework` | The `MiniAppFramework` object (`app` below) — everything in §2. |
| `ctx.t(key, params?)` | App translator (en + zh). |
| `ctx.setStatus(msg, type)` | Status strip: `"success" \| "error" \| "warning" \| "info"`. |
| `ctx.setError(error, fallbackKey?)` | One-liner error feedback — see [Recipe: error handling](#recipe-error-handling). `fallbackKey` is an i18n KEY. |
| `ctx.clearStatus()` | Clear the status strip. |
| `ctx.services` / `ctx.os` | Raw platform services / OS proxies — prefer the framework surfaces. |
| `ctx.launchContext` | Raw launch params — prefer `app.platform.params(schema)`. |
| `ctx.registerAction(key, handler)` | Low-level action registration — prefer `app.actions.register`. |

`defineMiniApp` options beyond the basics: `storagePrefix` (legacy
localStorage namespace migration), `oracle` (dataFeed/seal config for
`app.oracle.dataFeed`), `credits` (ledger URL + contract hash for
`app.credits`), `mountTo` (default `"#app"`).

---

## 2. Surface-by-surface reference

`app = ctx.framework` exposes 26 members. Each entry below: what it is, the
key methods, one real example.

### `app.chain` — reads, writes, args, events, signing

The contract lane. Argument builders under `app.chain.arg`
(`string` / `integer` / `boolean` / `hash160` / `hash160Raw` / `publicKey` /
`hash256` / `byteArray` / `array`).

**Typed reads — `chain.query` (preferred):** one RPC read, chainable decode.

```ts
const total = await app.chain.query("totalGames").asInt();
const paused = await app.chain.query("isPaused").asBool(false);
// From color-clash: decode an id with bigint semantics
const active = String(
  await app.chain.query("activeGameOf", [app.chain.arg.hash160(playerHash)]).asBigInt(),
);
```

Decoders: `asInt` / `asBigInt` / `asString` / `asBool` / `asAddress` /
`asArray` / `asMap<T>(shape)` / `as(parse)` / `raw()`. The value-safe lanes
(`asInt`…`asAddress`) never throw on a malformed value — they return the
`fallback` (or the zero value); a failing READ returns the fallback when one
was given, otherwise rethrows. `raw()` / `asArray()` / `asMap()` / `as()`
propagate read errors — the "own your error handling" lanes.
`readRaw(op, args?, options?)` ≡ `query(...).raw()`; `readArray` for list
stack items. Read options: `{ scriptHash?, cache?, cacheTtlMs? }`.

**Writes — `chain.write` (the fire-and-notify lane, preferred):**

```ts
await app.chain.write({
  operation: "claim",
  args: [app.chain.arg.integer(1)],
  waitForEvent: "Claimed",
  successKey: "claimSuccess",
  reload: loadAll, // re-runs your loader on success
});
```

Order of execution is fixed by construction: guest guard → S11 permission
gate → invoke → `reload()` on success, with toasts per the `notify` policy
(`"all"` default \| `"errors"` \| `"silent"`). Real silent-lane example from
neo-treasury:

```ts
const result = await app.chain.write({
  operation: "transfer",
  args: intent.args,
  scriptHash: intent.scriptHash,
  notify: "silent", // composable owns its own multi-step messaging
  onTransactionSent: rememberBroadcast,
});
```

`chain.invoke` / `chain.invokeWithPayment` are the raw escape hatches with NO
notify/reload wrapping. Also on the surface: `ensureWallet()`,
`detectNetwork()`, `signMessage(message)` (normalized
`FrameworkSignedMessage`), `invokeMultiple(calls, options?)` (multi-script
single transaction), `waitForState(read, until, options?)` (post-broadcast
confirmation poll), `eventValue(ev, index)` (positional event-slot decode),
`contractReady` (observable: contract configured — NOT wallet connected),
`address` / `contractAddress` observables.

### `app.funds` — payment-carrying invoke lanes

Decision rule: an app-contract call carrying a payment with memo/receipt
semantics → `funds.*`; a plain transfer bundled with a call →
`chain.invokeWithPayment`; no payment → `chain.write`.

```ts
await app.funds.payAndCall({
  amountGas: "0.02",
  memo: "miniapp-example:entry",
  operation: "startGame",
  args: [],
  waitForEvent: "GameStarted",
});
```

- `payAndCall(spec)` — pay-and-call in one step.
- `prepayAndCall(spec)` — deposit → wait for credit confirmation → consuming
  call (set `waitForCredit: false` to bundle atomically; `deposit` lane for
  NEP-17 asset deposits).
- `receiptPay(spec)` — mainnet receipt-id lane (`receiptId` appended as the
  trailing Integer arg).
- `creditOf(playerHash?)` / `withdrawCredit()` — prepaid-credit recovery. A
  failure *after* a settled deposit surfaces as `FrameworkPrepaidActionError`:
  the credit is withdrawable, not lost.

### `app.amount` — protocol math (bigint base units)

Throwing parsers for trusted inputs, null-on-invalid parsers for user input:

```ts
const fixed8 = app.amount.gasToFixed8("0.02");        // 2000000n — THROWS on invalid
const units = app.amount.parseGasToFixed8(userInput);  // string | null — NEVER throws
if (units === null) return ctx.setStatus(ctx.t("invalidAmount"), "error");
```

Also `neoToUnits` / `parseNeoToUnits` (NEO is indivisible — fractions reject),
`assetToUnits` / `parseAssetToUnits("GAS" | "NEO", value)`, and
`fixed8ToGas(value, maxDecimals?)`. Display formatting belongs to `app.fmt`.

### `app.fmt` — blessed display formatters

Strings for UI; do not re-implement `shortAddr` / `formatGas` / `formatClock`.

```ts
app.fmt.address("NUVxNjZi2wxShJnTh9SyCJHBUCd5PJ9fKq"); // "NUVxNj...J9fKq"
app.fmt.hash(txid);          // "0x1a2b...9f0e"
app.fmt.gas(150_000_000n);   // "1.5"       (fixed8 → display, default 4 decimals)
app.fmt.clock(83_000);       // "01:23"     (ms → mm:ss)
app.fmt.compact(12_400);     // "12.4K"
```

Also `fixed8(value, { decimals? })`, `countdown(targetSeconds)`,
`number(value, decimals?)`. Options: `address`/`hash` take
`{ head?, tail? }` (defaults 6/4); `gas`/`fixed8` take `{ decimals? }`.

### `app.errors` — error → message + typed code checks

```ts
try {
  await app.chain.invoke("mint", args);
} catch (error) {
  ctx.setStatus(app.errors.messageOf(error, ctx.t("mintFailed")), "error");
  // …or, when the type is "error", just: ctx.setError(error, "mintFailed")
}
if (app.errors.is(error, "GUEST_MODE_BLOCKED")) showUpsell();
```

`messageOf(error, fallback?)` — priority: `MiniAppError` user message >
mapped chain-error family copy (identical to what `app.notify.error` shows) >
`Error.message` > string errors verbatim > `fallback` > `t("error")`. Note
`fallback` is an already-translated STRING (pass `ctx.t("key")`), while
`ctx.setError`'s second argument is the KEY itself.

### `app.notify` — the single toast surface

`success(key, params?)` / `info` / `warn` / `error(error, fallbackKey?)`, plus
two async wrappers:

```ts
// From neo-swap — toast on success, mapped error copy on failure:
app.actions.register("executeSwap", async () => {
  await app.notify.guard(() => swap.executeSwap(), { successKey: "swapSuccess" });
});

// guardResult gives you an explicit discriminator instead:
const result = await app.notify.guardResult(() => riskyOp());
if (result.ok) proceed(result.value);
```

### `app.actions` — registered actions with toast wrapping

The PlayArea dispatches action NAMES; setup registers the bodies. `run` is
drop-mode single-flight per key: a call while the same key is in flight
resolves `undefined` without running (double clicks collapse; dev-only
console warning).

```ts
app.actions.register("withdraw", withdraw, {
  successKey: "withdrawn",
  successParams: (result) => ({ amount: app.fmt.gas(result.amountFixed8) }),
  errorKey: "withdrawFailed",
  guestBlocked: true, // standard guest-mode early return (see §3 modes recipe)
});

// The standard connect-wallet body (ensureWallet → refresh fan-out → toast):
app.actions.registerConnectWallet({ refresh: [reloadBalances, reloadHistory] });
```

Options: `successKey`, `successParams` (record or `(result) => params`),
`errorKey`, `rethrow`, `guestBlocked` (`true` uses the `"guestModeBlocked"`
copy; `{ statusKey }` for app-specific copy — blocked runs resolve
`undefined`, they do NOT throw).

### `app.operations` — keyed operation state machines

One observable cell per user-facing operation (status/txid/error/timestamps)
instead of hand-rolled busy/error flag trios.

```ts
const withdrawOp = app.operations.create("withdrawWinnings");
app.actions.register("withdrawWinnings", async () => {
  await withdrawOp.run(async () => {
    /* … the actual work … */
  }, { successKey: "creditWithdrawn" });
});
// PlayArea binds withdrawOp.state: { key, status, txid, error, value, startedAt, finishedAt, runId }
```

### `app.state` — observable atoms

`atom(key, initial)`, `persisted(key, initial)` (backed by
`app.storage.local` under `state/<key>`), `snapshot(values)`.

### `app.storage` — keyed storage lanes

- `storage.local` — synchronous, namespaced localStorage
  (`get<T>(key, fallback?)` / `set` / `delete` / `list(prefix)`). Keys are
  prefixed `neo:<appId>:` (override with the `storagePrefix` option when
  migrating legacy keys — they must stay byte-identical).
- `storage.remote` — async OS-storage lane; no-ops without an OS host.
- `storage.hybrid` — **deprecated** (0 consumers); choose local or remote
  explicitly.

### `app.wallet` — identity + balances

`address()` / `scriptHash()` / `isConnected()` / `ensure()` (sync snapshot
functions), `observe()` (address observable), `balance(asset, address?)` /
`gas()` / `neo()` / `raw(asset, address?)` (bigint) / `all(address?, extra?)`,
`observeBalance(asset)` (auto-refreshing handle with `cleanup()`).

The account-change hook is the important one — see
[Recipe: wallet-change reset](#recipe-wallet-change-reset).

### `app.events` — chain event queries

`list(eventName, { limit?, offset? })`, `listAll(eventName, { cap? })`
(default cap 500), `listParsed(eventName, decode, { limit? })` (decode +
null-filter in one pass), `waitFor(txid, eventName, timeoutMs?)` (null on
timeout — never throws), `value(ev, index)` (positional slot decode),
`record(ev, slots)` (positional slots → named record).

```ts
const rows = await app.events.listParsed("Solved", (ev) => {
  const payout = parseBigInt(app.events.value(ev, 5));
  return payout > 0n ? { payout } : null; // null rows are dropped
});
```

### `app.bus` — in-app pub/sub

`on(event, handler)` (returns unsubscribe; auto-released on unmount),
`once`, `emit(event, payload?)`, `off(event, handler?)`. For app-internal
signals — chain events belong to `app.events`.

### `app.lifecycle` — mount/unmount, loaders, polling

`onMount` / `onUnmount` / `onDataLoad` / `reloadData` / `cleanup(fn)`, and the
poller that retires hand-rolled `setInterval` loops:

```ts
const stop = app.lifecycle.poll(() => refreshBoard(), 15_000);
// Defaults: runs immediately, pauses while the tab is hidden (catch-up run on
// return), swallows per-tick errors, auto-disposes on unmount. stop() to end early.
```

Options: `{ immediate?, pauseWhenHidden? }` (both default true).

### `app.platform` — host detection + launch params

```ts
const { tab, round } = app.platform.params({
  tab: (raw) => raw ?? "overview",
  round: (raw) => Number(raw ?? 0),
});
const net = app.platform.network();      // { name, isMainnet } — sync, launch-context based
const link = app.platform.explorer.tx(txid); // canonical Dora URL (also .address / .contract)
```

Also `appId`, `launch` (raw context), `host`
(`"onegate" | "miniapp-platform" | "standalone"`), `isOneGate` /
`isMiniAppPlatform`, `param(key, fallback?)`. For the wallet-verified network
use the async `app.chain.detectNetwork()`.

### `app.mode` — guest/gamefi two-mode surface

`current` (observable, default `"gamefi"`), `set(mode)` (the launcher calls
this before the play area mounts), `get()`, `isGuest()`, `isGameFi()`,
`onChange(cb)` (returns unsubscribe), `guestLeaderboard`
(`submit(score)` / `get(limit?)` — off-chain, app-scoped guest namespace,
never mixes with on-chain boards). Full recipe in
[§3 guest/gamefi](#recipe-guest--gamefi-two-mode-games).

### `app.game` — reward-game SDK + game helpers

- `game.reward<Op>(config, options?)` — the TEE reward-game handle (see
  [§3 reward runner](#recipe-tee-reward-games-the-reward-runner)).
- `game.rules(config)` — the standard game-rules helpers from your constants:

  ```ts
  // apps/<game>/src/logic/game-rules.ts
  export const rules = app.game.rules({
    difficulties: {
      easy: { stakeFixed8: 2_000_000n, label: "Easy" },
      hard: { stakeFixed8: 20_000_000n, label: "Hard" },
    },
    payout: { basePct: 100, undoPenaltyPct: 30, maxUndos: 3 },
  });
  rules.rewardPctAfterUndos(2);           // 40
  rules.payoutFixed8(10_000_000n, 40);    // 4_000_000n (bigint-exact)
  ```

  Members: `ruleOf(difficulty)` (throws `UNKNOWN_DIFFICULTY`), `statusOf(raw)`,
  `gasDisplay(fixed8)`, `formatClock(ms)`, `rewardPctAfterUndos(undos)`,
  `payoutFixed8(stake, pct)`, `canReleaseExpiredGame(state, nowMs)`,
  `settlementGraceMs` (default 600 000 ms).
- `game.player` — `scriptHash()` (`""` when disconnected) /
  `ensureScriptHash()`.
- `game.stats.load(playerHash?)` — `{ solves, totalWon }` (zeros on error).
- `game.leaderboard.load(eventName?, slots?, limit?, extraRowFields?)` —
  Solved-event board builder → `{ ranked, mine }`.
- `game.session.observables(t?)` / `game.session.applySnapshot(obs, game, statusOf)`
  — the standard session observable set + getGame snapshot apply.

### `app.oracle` — envelope builders + dispatch + dataFeed/seal

```ts
const request = await app.oracle.http({
  url: "https://api.example.com/price",
  method: "GET",
  path: "$.data.price",
});
await app.oracle.dispatch(request, {
  operation: "submitOracleRequest",
  waitForEvent: "OracleRequestSubmitted",
});
```

Builders: `http` / `vrf({ consumer, salt, rounds?, proofMode? })` /
`compute({ workflow, input, sealed? })` / `seal({ purpose, recipient?, payload })`.
Envelope digests are deterministic — equivalent JSON payloads produce the same
digest, so previews and submissions can be cross-checked. `dispatch(envelope,
spec)` appends the payload as the trailing String arg of a write (so it also
needs the `invoke:primary` write gate).

Extensions: `oracle.dataFeed` (wallet-free Morpheus price reads + freshness
math — requires the `oracle.dataFeed` config injected via `defineMiniApp`,
else a typed `FrameworkCapabilityError`), and `oracle.seal.publicKey` /
`encrypt` / `store` (confidential-seal client; `store` writes and is
guest-guarded).

### `app.credits` — platform credits (Credits v2)

On-chain GAS buys, instant feeless DB spends, stale-flagged chain fallback
reads. `available` is the render gate — no config injected ⇒ render no
credits UI at all.

```ts
if (app.credits.available) {
  const bal = await app.credits.balance();   // { source, stale, … }
  await app.credits.spend(5, "revive");      // instant; 402 ⇒ FrameworkInsufficientCreditsError
  await app.credits.buy(1);                  // 1 GAS → 50 credits (on-chain, "payments"-gated)
}
```

Members: `available`, `current` (observable), `balance()` / `refresh()`,
`buy(gasAmount)`, `spend(amount, action, meta?)` (idempotency-key deduped,
single-flight per action), `canAfford(amount)`, `history(limit?)`, `rate`
(`creditsPerGas = 50`, `gasPerCredit`, `creditsForGas`, `gasForCredits`).
Games should use the shared lane — see [§3 credits recipe](#recipe-credits-lane).

### `app.permissions` — S11 manifest gating

`list()` / `has(permission)` / `require(permission)` (throws
`FrameworkPermissionError`, code `PERMISSION_DENIED`). You rarely call these —
the framework gates its own write lanes centrally. See
[§3 permissions recipe](#recipe-permission-manifest-requirements).

### `app.aa` — account abstraction

`available`, `sponsorship.check(scope?)` / `sponsorship.request(amount, scope?)`,
`relay(payload)`, `sessionKey.create(permissions, expiresAt)`. Absent host AA
service ⇒ typed `FrameworkCapabilityError("aa")`. S11 permission `"aa"` is
registered DEFAULT-ALLOW (deniable only via an explicit `{ "aa": false }`
manifest record entry).

### `app.clipboard` / `app.share`

`clipboard.copy(text, options?)` → boolean; `clipboard.copyAddress(successKey?)`
(false without toasting when no wallet). `share.url(value, options?)` →
`"shared" | "copied" | "dismissed" | "failed"` (native share sheet with
clipboard fallback).

### `app.resources` — host-base asset resolution

`url(relPath)` / `image(relPath)` (app-base-relative resolution; absolute URLs
pass through), `tokenArt` (official GAS/NEO artwork URLs).

### `app.stats` / `app.achievements` / `app.db` — legacy lanes

`stats.leaderboard.submit(score)` / `stats.leaderboard.top(limit?)` — the
shared OS board (guest submissions auto-route to the guest namespace).
`stats.increment`, `achievements.*`, and `db.collection` are **deprecated** —
see the [table in §4](#4-deprecated-surfaces).

---

## 3. Standard recipes

### Recipe: error handling

One convention, two lanes with identical copy:

- **Status strip** (inline feedback): `ctx.setError(error, fallbackKey?)` —
  sugar for `ctx.setStatus(app.errors.messageOf(error, ctx.t(fallbackKey)), "error")`.
- **Toast**: `app.notify.error(error, fallbackKey?)`, or wrap the whole
  operation in `app.notify.guard` / register the action with an `errorKey`.

```ts
// The fleet-standard catch block (from color-clash):
try {
  const { step } = await rewardGame.recordOp(session, { type: "press", color });
  applyVerifiedPress(step.view as Record<string, unknown>, color);
} catch (error) {
  ctx.setError(error, "statusFailed"); // i18n KEY — copy resolves en+zh
}
```

Never write `error instanceof Error ? error.message : …` — `messageOf`
already handles `MiniAppError` user messages, the localized chain-error
families (wallet/VM/RPC copy), plain Errors, and string errors. Branch on
stable codes with `app.errors.is(error, code)`, never on message text.
`ctx.setError` is host-wired (defineMiniApp provides it); the framework
publishes the contract — feature-check `ctx.setError?.(…)` only in custom
embeds.

### Recipe: wallet-change reset

Use `app.wallet.onAccountChanged` — identity diff is built in (never fires for
balance-only emissions or repeated same-address emissions), handler errors are
isolated.

```ts
// From color-clash — reset the session, keep "first connect" silent:
const stopWalletSync = app.wallet.onAccountChanged(({ previous }) => {
  if (!previous || app.mode.isGuest()) return; // first connect is not a change
  session = null;
  obs.gameStatus.set("unknown");
  ctx.setStatus(ctx.t("statusWalletChanged"), "warning");
});
// return { cleanup: () => stopWalletSync() } from setup
```

The generic reload shape: `app.wallet.onAccountChanged(({ current }) => {
reset(); if (current) void reloadAll(); })`. Pass `{ immediate: true }` to
fire once at subscription time with `{ previous: null, current }`. The reward
runner wires this internally — games on the runner need no manual reset.

### Recipe: typed reads via `chain.query`

Replace `parse*(await app.chain.readRaw(op, args))` pairs with one chained
call; delete the local parser.

```ts
const pool = await app.chain.query("getPool", [], { cache: true }).asMap<{
  free: bigint;
  locked: bigint;
}>({
  free: (raw) => parseBigInt(raw),
  locked: (raw) => parseBigInt(raw),
});
```

Missing map fields hit their coercer with `undefined` so the coercer's own
default applies. Partial migration is a valid resting state — `raw()` is
`readRaw` verbatim.

### Recipe: TEE reward games (the reward runner)

`app.game.reward(config)` is the SDK handle (start / openSession / recordOp /
replayOps / finalize / recoverActive / expire / withdrawCredit / snapshot /
observeSettlement / balances / progression / mode / storage). The **runner**
composes those primitives into the standard lifecycle state machine — new
games should start here; the primitives remain the escape hatch (color-clash
composes them directly for its bespoke per-round verification).

```ts
type PressOp = { type: "press"; color: number };

const rewardGame = app.game.reward<PressOp>({
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: "miniapp-example:entry",
  modes: [
    { id: 0, key: "easy", entryFixed8: 2_000_000n, rewardFixed8: 10_000_000n },
  ],
});

const runner = rewardGame.runner({
  createView: (session) => freshBoard(session.view), // deterministic
  applyOp: (board, op) => stepBoard(board, op),      // live play AND resume-replay
  verifyView: (board, snapshot) => board.solved === (snapshot.status === "solved"), // optional
  onPhase: (phase) => scene.setPhase(phase),         // optional tap
});

runner.registerStandardActions(app.actions); // withdrawWinnings / refreshLeaderboard / expireGame / retryDeal
await runner.resume();                        // recover an interrupted run on mount
```

Runner surface: observables `phase` (`"idle" | "dealing" | "deal-pending" |
"playing" | "finalizing" | "settlement-pending" | "settled" | "expired" |
"error"`), `view`, `session`, `balances`, `stats`, `leaderboard`; methods
`start({ difficulty? | modeKey? })`, `resume()`, `record(op)`, `finalize()`,
`withdraw()`, `expire()`, `refresh()`, `dispose()`. start/resume/finalize/
refresh are single-flighted; wallet-change reset is internal (a settlement in
flight lands on `"settlement-pending"`, never lost). Op-logs persist through
`createLocalStorageRewardGameStorage` under your `storagePrefix`.

### Recipe: guest / gamefi two-mode games

Contract: `claudedocs/guest-mode-adoption.md`. GUEST is a purely local game —
the framework THROWS (`GUEST_MODE_BLOCKED`) from every write/oracle/reward
entry point as defense-in-depth; correct wiring branches BEFORE any guarded
call. Reads stay allowed.

1. Manifest opt-in: `manifest.gamePage.modes = { guest: true }` (or
   `supportsGuest: true`) — the launcher renders the two CTAs and calls
   `app.mode.set(mode)` before the play area mounts.
2. Branch every action first; gate every chain-read loader:

```ts
app.actions.register("startGame", async (...args) => {
  if (app.mode.isGuest()) { guest.startGame(Number(args[0] ?? 0)); return; }
  /* …gamefi flow… */
});
const refreshBalances = async () => {
  if (app.mode.isGuest()) return; // a mount-time gamefi read must never clobber guest state
  /* …chain reads… */
};
app.mode.onChange((mode) => { if (mode === "guest") void guest.enter(); });
```

For simple wallet-required actions skip the hand guard entirely:
`app.actions.register("withdraw", withdraw, { guestBlocked: true })`.

Guest scores: `app.mode.guestLeaderboard.submit(score)` (best-effort — wrap in
try/catch; wallet optional) and `.get(50)` — app-scoped `<appId>:guest:`
namespace, never mixed with on-chain boards.

### Recipe: credits lane

Architecture: `claudedocs/credit-system-design.md`. Games consume the shared
glue, not `app.credits` directly:

```ts
import { createGameCreditsLane } from "@shared/react/game-credits";

const credits = createGameCreditsLane({
  app: ctx.framework, t: ctx.t, setStatus: ctx.setStatus,
  reviveAction: "revive", reviveCostCredits: 5,
  reviveEnabled: manifest.supportsGameFi !== false,
  onReviveUnlocked: () => app.actions.run("startGame", myDifficulty()),
});
// spread ...credits.state into the returned state; call void credits.refresh()
// in the GameFi loadData path; render the chip/offer off the credits* observables
// (copy color-clash or flappy-dash).
```

Degradation contract: unconfigured hosts (`app.credits.available === false` —
the dev default) and guest mode render NO credits UI. Guest blocks buy AND
spend; the S11 `payments` permission gates buy only (spends are off-chain).
Add the en+zh `credits*` strings to `locale/messages.ts`.

### Recipe: permission manifest requirements

Enforcement model (S11): when the host delivers NO permission declaration
(every current launch lane), gated surfaces default-allow. A PRESENT
declaration — even an empty `permissions: []` — is enforced verbatim,
fail-closed. The framework gates centrally in this fixed order:
**guest guard → permission gate → notify wrap → reload-on-success**.

| Permission | Gates |
|---|---|
| `invoke:primary` | `chain.invoke` / `write` / `invokeWithPayment` / `invokeMultiple`, the mutating `funds.*` lanes, `oracle.dispatch` (via the write lane), and reward `start` / `finalize` / `expire` / `withdrawCredit` |
| `oracle:request` | `oracle.http` / `vrf` / `compute` / `seal(request)` / `dispatch`, **and the reward TEE session lanes** `openSession` / `recordOp` / `replayOps` (direct enclave round-trips on the same oracle host) |
| `payments` | `credits.buy` only (spends are off-chain and stay ungated) |
| `aa` | `app.aa` write lanes — DEFAULT-ALLOW; deny only with an explicit `{ "aa": false }` record entry |

Named exemptions (deliberate): `credits.spend` (guest-blocked, no payments
gate), `oracle.seal.store` (guest-guarded, no oracle:request gate),
guest-leaderboard submits (route to the guest namespace, never throw).

**GameFi re-enable checklist** (the 9 pinned-empty TEE session games ship
`permissions: []` + guest-only modes; re-opening GameFi requires ALL of):

1. `neo-manifest.json` `permissions`: grant **both** `"invoke:primary"` and
   `"oracle:request"` (the session lanes are gated separately from the
   broadcast lanes — granting only invoke:primary strands `openSession`).
   Add `"payments"` too if the game sells credits top-ups.
2. In-app manifest: flip `gamePage.modes` to `{ guest: true, gamefi: true }`
   (re-enables the "Earn GAS" CTA) and any `platform.transactions` flag.
3. Flip any app-local fail-closed flags (e.g. color-clash's
   `NEW_PAID_RUNS_ENABLED`) — a manifest edit alone must never reopen paid
   entry.

---

## 4. Deprecated surfaces

Nothing is removed (back-compat law) — these keep working but new code must
use the successor:

| Deprecated | Successor | Why |
|---|---|---|
| `chain.read(spec)` (typed spec-object form) | `chain.query(op, args).as(parse)` | spec-object shape found no adopters |
| `chain.enumerate(spec)` | `chain.query` + explicit loop, or `readArray` | 0 consumers |
| `chain.events(name, opts)` | `app.events.list(name, opts)` | one concept, one home |
| `storage.hybrid` | `storage.local` or `storage.remote` explicitly | 0 consumers |
| `app.db.collection(name)` | `app.storage.local` / `app.storage.remote` | 0 consumers |
| `app.stats.increment(key)` | contract-side counters or `app.storage` | non-atomic read-modify-write |
| `app.achievements.awardOnce` / `.list` | (OS badge lane, kept for back-compat) | 0–1 consumers |

Also superseded in practice (not formally deprecated): raw
`ctx.launchContext` reads → `app.platform.params(schema)`; hand-rolled
`chain.address.subscribe` + identity bookkeeping → `wallet.onAccountChanged`;
hand-written guest guards in handlers → `guestBlocked`; per-app
`connectWallet` bodies → `actions.registerConnectWallet`.

---

## 5. Which surface do I use?

| I need to… | Use |
|---|---|
| Read contract state, typed | `chain.query(op, args).asInt()` / `.asMap<T>()` / … |
| Read with my own parse/guard flow | `chain.readRaw` (≡ `query(...).raw()`) |
| Simple write with toasts + reload | `chain.write({ operation, args, successKey, reload })` |
| Write inside a composable that owns its messaging | `chain.write({ …, notify: "silent" })` or raw `chain.invoke` |
| App-contract call carrying payment (memo/receipt) | `funds.payAndCall` / `prepayAndCall` / `receiptPay` |
| Plain transfer bundled with a call | `chain.invokeWithPayment` |
| Poll until a broadcast is observable | `chain.waitForState(read, until)` or `events.waitFor(txid, name)` |
| Query indexed chain events | `app.events.list` / `listAll` / `listParsed` |
| In-app pub/sub between modules | `app.bus` |
| Wallet identity / balances | `app.wallet` |
| React to account switching | `wallet.onAccountChanged` |
| Toast feedback | `app.notify` (or action `successKey` / `errorKey`) |
| Status-strip feedback | `ctx.setStatus` / `ctx.setError` |
| Turn an error into user copy | `app.errors.messageOf` / `ctx.setError` |
| Format for display | `app.fmt` |
| Parse/scale amounts for a transaction | `app.amount` (`parse*` for user input) |
| Busy/txid/error state for a button | `app.operations.create(key)` |
| User-triggered behavior | `app.actions.register` + PlayArea dispatch |
| Launch params / network / explorer links | `app.platform.params` / `.network()` / `.explorer` |
| Persist app data | `app.storage.local` (sync) / `.remote` (OS-backed) |
| Guest vs GameFi branching | `app.mode` + `guestBlocked` |
| TEE reward game lifecycle | `game.reward(config).runner(hooks)` |
| Difficulty/payout rule helpers | `game.rules(config)` |
| On-chain wins leaderboard | `game.leaderboard.load` (Solved events) |
| Shared OS leaderboard | `stats.leaderboard` |
| Guest-only leaderboard | `mode.guestLeaderboard` |
| Oracle request (HTTP/VRF/compute/seal) | `app.oracle.<kind>` + `oracle.dispatch` |
| Wallet-free price reads | `oracle.dataFeed` (config-injected) |
| Feeless in-game purchases | `app.credits` via `createGameCreditsLane` |
| Sponsored/relayed execution | `app.aa` |
| Copy/share | `app.clipboard` / `app.share` |
| Resolve bundled assets | `app.resources.url` / `.image` |
| Recurring refresh | `app.lifecycle.poll` |

---

## 6. Lower-level and host lanes (non-framework)

These predate `ctx.framework` and remain supported:

- **OS service proxies (`ctx.os.*`)** — storage, payment, game pools, badges,
  check-in, leaderboard, NFT, escrow, vesting proxies over the `os-*` edge
  functions. The framework wraps the common ones (`app.storage.remote`,
  `stats.leaderboard`, `achievements`); reach for `ctx.os` directly only for
  proxies the framework does not cover (escrow, vesting, NFT, check-in).
  `EdgeClient` stamps `appId` on every request server-side — it cannot be
  forged from the browser.
- **Host-only APIs** — `platform/sdk`'s `HostSDK` (wallet binding, secrets,
  API keys, gasbank, automation) is never exposed to miniapps.
- **Platform contract events** — contracts that want platform news/analytics
  ingestion emit `Platform_Notification(notification_type, title, content)`
  and `Platform_Metric(metric_name, value)`; set `manifest.contract_hash` so
  events map back to the app.
- **Security invariants** — the host strips identity headers from miniapps;
  rate limits are enforced on Edge and TEE (defense in depth); manifest
  constraints (assets/permissions/limits) are enforced at runtime.
