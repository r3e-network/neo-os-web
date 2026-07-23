# Neo MiniApp Framework

The root-level `framework/` module is the business SDK every miniapp receives
as `ctx.framework` inside `defineMiniApp`. It runs in the Neo MiniApp
Platform, OneGate, and standalone embeds, and standardizes the work no app
should reimplement: chain reads/writes, payments, wallet identity, guest/
gamefi modes, TEE reward games, credits, oracle envelopes, permissions,
formatting, error copy, storage, actions, and lifecycle.

**The app-author guide is [`docs/sdk-guide.md`](../docs/sdk-guide.md)** —
quickstart, per-surface reference with worked examples, standard recipes,
deprecations, and the "which surface do I use?" decision table. The
authoritative API contract is the explicit `MiniAppFramework` interface in
[`types.ts`](./types.ts) (every member JSDoc'd — hover docs are exact).

## Basic setup

```ts
import { defineMiniApp } from "@shared/react";

defineMiniApp({
  appId: "miniapp-example",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const app = ctx.framework;
    const counter = app.state.persisted("counter", 0);
    app.actions.register("increment", async () => {
      counter.set(counter.get() + 1);
    }, { successKey: "saved" });
    return { state: { counter } };
  },
});
```

`createMiniAppFramework(ctx, options)` remains exported for tests and custom
embeds; app entrypoints use the runtime-provided `ctx.framework`.

## Surfaces at a glance

| Surface | One-liner |
|---|---|
| `app.chain` | Reads (`query` typed lane), writes (`write` fire-and-notify lane), arg builders, signing, multi-invoke, `waitForState` |
| `app.funds` | Payment-carrying lanes: `payAndCall` / `prepayAndCall` / `receiptPay` + prepaid-credit recovery |
| `app.amount` | Protocol math on bigint base units (throwing + null-on-invalid parsers) |
| `app.fmt` | Blessed display formatters (`address`, `gas`, `clock`, `compact`, …) |
| `app.errors` | `messageOf(error, fallback?)` + typed `is(error, code)` — one error-copy lane |
| `app.notify` | The single toast surface + `guard`/`guardResult` wrappers |
| `app.actions` | Registered actions, drop-mode single-flight, `guestBlocked`, `registerConnectWallet` |
| `app.operations` | Keyed busy/txid/error state machines for buttons and panels |
| `app.state` / `app.storage` | Observable atoms (optionally persisted); local/remote keyed storage |
| `app.wallet` | Identity, balances, `onAccountChanged` identity-diff hook |
| `app.events` / `app.bus` | Chain event queries / in-app pub/sub |
| `app.lifecycle` | Mount/unmount, loaders, visibility-aware `poll` |
| `app.platform` | Host detection, typed `params(schema)`, `network()`, Dora `explorer` links |
| `app.registry` | Complete tenant Registry surface: directory, self-registration, shared-AA materialization, descriptors, credits, app governance and role-bound treasury exits |
| `app.platformGame` | Shared PlatformGame lifecycle with appId auto-threading and guarded writes |
| `app.platformSocial` | Shared envelope, range-pool, trust, vault and Notary primitives plus tenant-scoped GAS/NEO credit prepayment and recovery |
| `app.platformAnchor` | Shared staking, reward, credit and AA-agent operations with appId auto-threading |
| `app.platformDeFi` | Shared capsule, lending, flash-loan, liquidity and fee operations with guarded writes |
| `app.platformFactory` | Governed template reads and allowlisted deployment calls across network-specific Factory hashes |
| `app.mode` | Guest/gamefi two-mode surface, guest guard, guest leaderboard |
| `app.game` | Reward-game SDK (`reward(config)` + lifecycle `runner(hooks)`), `rules(config)`, player/stats/leaderboard/session helpers |
| `app.oracle` | HTTP/VRF/compute/seal envelopes + `dispatch`, dataFeed reader, seal client |
| `app.credits` | Platform credits: on-chain buys, instant feeless spends, stale-flagged fallback reads |
| `app.permissions` | S11 manifest gating with distinct `invoke:platform-*` grants per shared module |
| `app.aa` | Sponsorship / relay / session keys (typed capability errors when absent) |
| `app.clipboard` / `app.share` / `app.resources` | Copy with toasts, share sheet, host-base asset resolution |
| `app.stats` / `app.achievements` / `app.db` | Legacy OS lanes — partially deprecated, see the guide |

## Conventions that hold everywhere

- **Back-compat law:** every change is additive; deprecated members keep
  working and their JSDoc names the successor. Everything is re-exported from
  `framework/index.ts`, so existing import paths never break.
- **Write-lane ordering by construction:** guest guard → S11 permission gate
  → invoke → reload-on-success, with toasts per the `notify` policy
  (`"all" | "errors" | "silent"`).
- **Errors:** framework errors extend `MiniAppError` with stable `code`s —
  branch with `app.errors.is(error, code)`, never on message text.
- **Subscriptions:** every `on*`/`observe*`/`subscribe` returns its own
  unsubscribe function; handler errors are isolated, never propagated.
- **Amounts:** `app.amount` returns bigint base units for protocol math;
  `app.fmt` returns strings for display. Do not mix.

## Development

```sh
cd framework && npx vitest run   # unit suite (all surfaces)
npx tsc --noEmit                 # type check
```

Design and rationale docs: `docs/framework-evolution-rfc.md` (surface
evolution + census), `docs/archive/claudedocs/guest-mode-adoption.md` (two-mode contract),
`docs/credit-system-design.md` (credits architecture).
