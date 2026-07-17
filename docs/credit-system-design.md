# Platform Credit System v2 — Design & Runbook

Status: contract + edge functions + framework surface + reference game
integration implemented and tested. **Not yet deployed to a live network** —
see [Open items](#open-items). Canonical operational spec:
`docs/MINIAPP_CREDITS_LEDGER.md`. This document is the architecture-level
view plus the app recipe and deployment runbook.

Fixed rate, enforced in the contract: **1 GAS = 50 credits**
(1 credit = 2,000,000 GAS base units = 0.02 GAS). Credits are integers;
GAS dust below one credit is rejected at buy time.

## Architecture (inverted: spends are DB-first)

The naive design puts every spend on-chain and dies on fees and latency.
v2 inverts it: **purchases are on-chain, spends are instant feeless DB
debits, and the chain is checkpointed in operator-signed batches.**

```
             BUY (on-chain, user pays GAS tx fee)
  ┌────────┐  GAS transfer, memo "miniapp-credits:buy"   ┌─────────────────────┐
  │  User  │ ───────────────────────────────────────────▶│  MiniAppCredits      │
  │ wallet │                                             │  contract            │
  └───┬────┘          CreditsPurchased(user, gas, cr) ◀──│  mints floor(gas/    │
      │                              │                   │  0.02 GAS) credits   │
      │                              ▼                   └──────────▲───────────┘
      │                    ┌──────────────────┐                     │
      │                    │ credits-indexer  │ (cron, ~15–60s)     │
      │                    │ scans app logs,  │                     │
      │                    │ dedupes on       │                     │
      │                    │ (net,tx,index)   │                     │
      │                    └────────┬─────────┘                     │
      │                             ▼ credit DB balance             │
      │   SPEND (off-chain, instant, feeless)                       │
      │  POST credits-ledger        ┌──────────────────┐            │
  ┌───┴────┐  {app_id, action,      │  Platform DB      │           │
  │ MiniApp│   amount, idem-key}    │  credit_balances  │           │
  │ (app.  │ ──────────────────────▶│  credit_events    │           │
  │credits)│  atomic conditional    │  (append-only)    │           │
  └────────┘  debit + dedupe        └────────┬─────────┘            │
                                             │                      │
             SETTLEMENT (on-chain, platform pays, cron)             │
                                   ┌─────────▼─────────┐            │
                                   │ credits-settler   │  postSettlement(
                                   │ aggregates net    │   epoch,   │
                                   │ spend deltas per  │   users[], │
                                   │ user since last   │   deltas[])│
                                   │ epoch, signs ONE  │ ───────────┘
                                   │ batch via TxProxy │  epoch must be
                                   └───────────────────┘  currentEpoch+1;
                                                          per-user debit is
             EXIT (on-chain, user-unilateral, any time)   clamped at settled
  User ──── exit(user) ──▶ contract pays GAS for the      balance
            LAST SETTLED credit balance (never pause-gated)
```

| Path | Where | Cost to user | Trust anchor |
|------|-------|--------------|--------------|
| Buy | on-chain (`OnNEP17Payment`) | GAS tx fee | chain |
| Spend | DB (`credits-ledger`) | zero — instant, feeless, no wallet popup | DB (until settled) |
| Settlement | on-chain (`postSettlement`) | platform pays | chain checkpoint |
| Exit | on-chain (`exit`) | GAS tx fee | chain |

Reconciliation rule: `current truth = settled chain state + unsettled DB
spend deltas`. Purchases replay from chain (indexer cursor + per-notification
dedupe); spends replay from the append-only `credit_events` log
(idempotency-key dedupe); settlement epochs record their exact event window
and the contract clamps per-user debits, so re-posting a window can never
drive a chain balance negative.

## The custody trade-off, stated plainly

**Between settlements, the platform DB is authoritative for spendable
balance. This is a real custody concession, not a technicality.**

- A DB compromise or platform misbehavior could mint or erase *unsettled*
  credits; the chain will not notice until the next settlement lands.
- The mitigation is the contract's **exit path**: at any moment, without
  platform cooperation and even while the contract is paused, a user can burn
  their last **settled** balance for GAS. What is at risk is bounded by the
  settlement cadence: purchases since the last confirmed epoch (not yet in a
  checkpoint they can exit against) plus/minus unsettled spends.
- Corollary: a user who spends off-chain after the last settlement and then
  exits gets paid for the settled balance — which still includes those
  unsettled spends. The platform absorbs that float; the next settlement
  posts the spend deltas and the contract clamps them at the (now zero)
  balance, so the books converge. **Short settler cadence = small float.**
- The stale-read discipline is part of the honesty: when the ledger is
  unreachable, `app.credits.balance()` serves `settledBalanceOf` from the
  chain and flags it `{ source: "chain", stale: true }` — it never pretends
  the checkpoint includes activity since the last epoch, and the game UIs
  render that flag ("last settled").

Chain = purchase proof + periodic audit checkpoints. DB = interactive truth.

## Uniform protocol (every app consumes the same lane)

Apps never talk to the ledger endpoint or the contract directly. The single
surface is **`app.credits`** (`framework/credits.ts`, re-exported from
`framework/index.ts`):

| Member | Semantics |
|--------|-----------|
| `available` | host injected a valid `MiniAppFrameworkOptions.credits` config |
| `current` | observable of the last balance read (ledger, or stale chain fallback) |
| `balance()` / `refresh()` | ledger GET; falls back to `settledBalanceOf` flagged `stale` |
| `buy(gas)` | on-chain GAS transfer with the `"miniapp-credits:buy"` memo; polls the ledger for the indexed purchase (guest-blocked, S11 `payments`-gated) |
| `spend(amount, action, meta?)` | instant feeless DB debit; idempotency-key deduped; single-flight per action; 402 ⇒ typed `FrameworkInsufficientCreditsError` (guest-blocked, **no** payments gate — off-chain) |
| `canAfford(n)` / `history(limit)` | affordability check / append-only event log |
| `rate` | fixed-rate helpers (`creditsPerGas = 50`, `creditsForGas`, `gasForCredits`) |

Guard model: guest mode blocks buy **and** spend (credits are a GAS-backed
feature); the S11 `payments` manifest permission gates **buy only** (the one
on-chain user action). Absent/invalid config throws a typed
`FrameworkCapabilityError("credits")` — and `available` is the render gate
that keeps that error out of normal flows.

On top of the framework surface, games share one glue module —
`apps/shared/react/game-credits.ts` (`createGameCreditsLane`) — which
registers three uniform actions (`refreshCredits`, `retryWithCredits`,
`buyCredits`) and exposes chip/offer observables (`creditsAvailable`,
`creditsBalance`, `creditsStale`, `creditsBusy`, `creditsNeedsTopUp`,
`creditsReviveEnabled`, cost/rate constants). Spend action name used by the
games: `"revive"` at 5 credits (0.1 GAS); top-up pack: 1 GAS → 50 credits.

## Reference integration (color-clash, flappy-dash)

Three touch points, identical in both games, all GameFi-only:

1. **HUD balance chip** — pill in the stage corner; click = `refreshCredits`;
   dashed border + hint when the balance is the stale settled-chain fallback.
2. **Fail-overlay offer** — on a *settled* failed run
   (`gameStatus expired|refunded`): "Instant retry — 5 credits". One feeless
   `spend`, then and only then the game's own restart action runs.
3. **Insufficient → buy prompt** — when the balance can't cover the cost (or
   the ledger returned the typed 402): "1 GAS = 50 credits" copy plus a
   "Buy 50 credits for 1 GAS" button (`app.credits.buy(1)`).

Degradation is the contract: unconfigured hosts (`available=false`, the dev
default — the ledger doesn't exist there) and guest mode render **no credits
UI at all**; games whose paid starts are fail-closed keep the chip but never
sell the retry offer (`reviveEnabled=false`), so a spend can never buy a
restart the start gate would refuse.

Files: `apps/{color-clash,flappy-dash}/src/main.tsx` (lane wiring),
`src/PhaserPlayArea.tsx` (chip + offer UI), `src/locale/messages.ts`
(en + zh strings), `src/PlayArea.scss` (styles);
config plumbing in `apps/shared/react/{defineMiniApp,MiniAppRoot}.tsx`
(`credits` option, same pattern as `oracle`). Tests:
`apps/shared/test/game-credits.test.ts` (lane vs mocked `app.credits`),
`apps/shared/test/{color-clash,flappy-dash}.credits-offer.test.tsx` (offer
UI render gates + dispatches).

## 10-line app recipe

Inside `defineMiniApp({ setup(ctx) { ... } })` of any two-mode game:

```ts
import { createGameCreditsLane } from "@shared/react/game-credits";

const credits = createGameCreditsLane({
  app: ctx.framework, t: ctx.t, setStatus: ctx.setStatus,
  reviveAction: "revive", reviveCostCredits: 5,
  reviveEnabled: manifest.supportsGameFi !== false,
  onReviveUnlocked: () => app.actions.run("startGame", myDifficulty()),
});
// then: spread `...credits.state` into the returned state, call
// `void credits.refresh()` in the GameFi loadData path, and render the
// chip/offer in the PlayArea off the credits* observables (copy either game).
```

Plus en+zh `credits*` strings in `locale/messages.ts` (copy from either
game) and, in production, the host injects
`defineMiniApp({ credits: { ledgerUrl, contractHash, network } })`.

## Deployment runbook

Order matters; each step fails closed until the next is done.

1. **Deploy `MiniAppCredits`** (`contracts/build/MiniAppCredits.nef` +
   manifest) to testnet first. Record the contract hash and deploy block.
2. **Point the settler key**: call `setSettler` with the TxProxy signing
   account (or let the owner account post settlements). Verify with the
   contract's read method before any cron goes live.
3. **Apply migration** `deploy/migrations/078_miniapp_credits.sql`
   (credit_balances / credit_events / credit_epochs / credit_indexer_state +
   SECURITY DEFINER RPCs).
4. **Deploy edge functions** `credits-ledger`, `credits-indexer`,
   `credits-settler` (`platform/edge/functions/...`) with env:
   `CONTRACT_MINIAPP_CREDITS_HASH_TESTNET` (and `_MAINNET` later),
   `CREDITS_CRON_SECRET` (≥32 chars), `CREDITS_INDEXER_START_BLOCK` = the
   deploy block, plus the standard `NEO_RPC_URL` / `TXPROXY_SERVICE_URL`.
   Optional tuning: `CREDITS_INDEXER_MAX_BLOCKS`,
   `CREDITS_SETTLER_CONFIRM_TIMEOUT_MINUTES`, `CREDITS_MAX_SPEND_PER_CALL`.
5. **Cron**: `credits-indexer` every 15–60s; `credits-settler` hourly (or on
   an unsettled-volume threshold). Both authenticate with `X-Cron-Secret`.
   Shorter settler cadence ⇒ smaller custody float (see trade-off above).
6. **Prove one live settlement**: run the settler with `dry_run: true`,
   inspect the batch, then let one real epoch land and confirm
   `currentEpoch` advanced. This also proves the TxProxy nested-`Array`
   parameter path, which is asserted but not yet live-verified.
7. **Host config**: inject `credits: { ledgerUrl, contractHash, network }`
   into the miniapp framework options (per-app `defineMiniApp` option or the
   host's platform-config channel). Until this step, every app renders no
   credits UI by design.
8. **Manifest grants**: add `"payments"` to the `permissions` array of
   `apps/color-clash/neo-manifest.json` and
   `apps/flappy-dash/neo-manifest.json` (buy is the only lane that needs it;
   spends stay ungated). NOT done in this change — a concurrent manifest
   sweep owns those files; without the grant the buy button surfaces a
   localized "payments permission not granted" hint and everything else
   still works.
9. **Verify end to end**: buy 1 GAS → chip shows +50 after the indexer run;
   spend a revive → instant debit, `deduped: true` on retry with the same
   idempotency key; stop the ledger → chip flips to the stale settled
   balance; `exit` → GAS returned for the settled balance and the DB mirror
   clamps.

## Open items

- **Live settlement validation** — the TxProxy `Array` contract-parameter
  path in `credits-settler` needs one real testnet epoch (runbook step 6).
- **Manifest `payments` grants** for color-clash + flappy-dash are pending
  the concurrent manifest-permission sweep (runbook step 8).
- **Paid starts are currently fail-closed in both reference games**
  (`supportsGameFi: false` in both `src/manifest.ts`; color-clash
  additionally `NEW_PAID_RUNS_ENABLED = false` in `src/main.tsx`), so the
  retry offer is intentionally withheld (`reviveEnabled=false`) until GameFi
  reopens; the wiring needs no code change when the flags flip.
- **Host config channel**: decide whether `credits` config is injected
  per-app (defineMiniApp option, like `oracle`) or platform-wide by the
  launcher; the plumbing supports the former today.
- **Mainnet**: everything above is testnet-first; mainnet needs its own
  contract deploy, `CONTRACT_MINIAPP_CREDITS_HASH_MAINNET`, and a fresh
  indexer start block.
- **Fleet rollout**: the lane + strings are copy-ready for the other Phaser
  games once the reference pair has soaked (check the catalog before adding
  new credit sinks; the spend `action` namespace is per-app).
