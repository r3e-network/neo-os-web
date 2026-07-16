# MiniApp Credits — Platform Ledger (v2, DB-first spends)

Status: implemented (contract + edge + migration); **not yet deployed/validated
against a live network**. The TxProxy `Array` parameter path in the settler
needs one live testnet settlement to be considered proven.

## Architecture

Credit flow is **inverted** relative to a naive on-chain ledger:

| Path | Where | Cost to user | Trust anchor |
|------|-------|--------------|--------------|
| Buy | on-chain (`MiniAppCredits.onNEP17Payment`) | GAS tx fee | chain |
| Spend | DB (`credits-ledger` edge function) | zero — instant, feeless | DB (until settled) |
| Settlement | on-chain (`postSettlement`, operator-signed batch) | platform pays | chain checkpoint |
| Exit | on-chain (`exit`) | GAS tx fee | chain |

- **BUY**: the user sends GAS to the MiniAppCredits contract with transfer data
  (memo) `"miniapp-credits:buy"`. The contract mints
  `floor(gas / 0.02 GAS)` credits into its settled balance and emits
  `CreditsPurchased(user, gasAmount, credits)`. The `credits-indexer` edge
  function polls application logs and credits the DB balance on confirmation.
- **SPEND**: the app calls `credits-ledger` → atomic conditional DB debit
  (`balance >= amount`), an append-only `credit_events` row, and idempotency-key
  dedupe. No transaction, no fee, no wallet popup.
- **SETTLEMENT**: `credits-settler` (cron) aggregates per-user net spend deltas
  over the contiguous `credit_events` window since the last epoch and posts ONE
  operator-signed `postSettlement(epoch, users[], deltas[])` batch (parallel
  arrays; the repo's TxProxy signs with the settler key). The contract requires
  `epoch == currentEpoch + 1` and clamps each per-user debit at the settled
  balance.
- **EXIT**: any user can call `exit(user)` on the contract at any time (not
  pause-gated) and receive GAS for their **last settled** credit balance.

**Rate (fixed in contract)**: `1 GAS = 50 credits`; `1 credit = 2_000_000` GAS
base units. Credits are integers; GAS dust below 1 credit is rejected at buy.

## Custody trade-off (read this honestly)

Between settlements **the DB is authoritative** for spendable balance. This is
a real custody concession, not a technicality:

- A platform DB compromise or operator misbehavior could mint or erase
  *unsettled* credits. The chain will not notice until the next settlement.
- The mitigation is the contract-side **exit path**: at any moment a user can
  burn their last *settled* balance for GAS without platform cooperation. What
  is at risk is bounded by the settlement cadence: credits purchased since the
  last confirmed epoch (not yet reflected in a checkpoint they can exit
  against) plus/minus unsettled spends.
- Corollary of exit-against-checkpoint: a user who spends off-chain after the
  last settlement and then exits gets paid for the settled balance, which still
  includes those unsettled spends. The platform absorbs that float; the next
  settlement posts the spend deltas and the contract clamps them at the (now
  zero) balance, so the books converge. Keep settlement cadence short to keep
  this float small.
- Chain = purchase proof + periodic audit checkpoints. DB = interactive truth.

## Reconciliation rule

```
current truth = settled chain state + unsettled DB spend deltas
```

On divergence:

- **Purchases replay from chain**: `credits-indexer` is replay-safe from
  `credit_indexer_state.last_processed_block`; every notification is deduped on
  `(network, tx_hash, event_index)`. Rescanning any block range is a no-op.
- **Spends replay from the event log**: `credit_events` is append-only; spends
  dedupe on `(network, wallet, idempotency_key)`. Balances can be rebuilt by
  folding the log.
- **Settlements**: each epoch records its exact window
  `(from_event_id, through_event_id]`. A FAULTed or never-landed settlement is
  marked `failed`, which releases its window for re-aggregation; a settlement
  whose log cannot be fetched but whose epoch number was consumed on-chain
  (`currentEpoch >= epoch`) is marked `confirmed` — only the settler/owner can
  consume epoch numbers. Because the contract clamps per-user debits at the
  settled balance, re-posting a window can never drive a chain balance below
  zero.
- **Exits mirror into the DB** (`credits_apply_exit`) with the debit clamped at
  the DB balance, so an exit can never strand a negative interactive balance.

## Components

| Piece | Path |
|-------|------|
| Contract | `contracts/MiniAppCredits/` (built: `contracts/build/MiniAppCredits.nef/.manifest.json`) |
| Migration | `deploy/migrations/078_miniapp_credits.sql` |
| Ledger API | `platform/edge/functions/credits-ledger/` |
| Purchase indexer | `platform/edge/functions/credits-indexer/` |
| Settlement batcher | `platform/edge/functions/credits-settler/` |
| Shared helpers | `platform/edge/functions/_shared/credits.ts` |

### DB schema (migration 078)

- `credit_balances(network, wallet_address) → balance, total_purchased, total_spent, total_exited`
- `credit_events` — append-only log (`purchase | spend | exit`), signed `amount`,
  `balance_after`, spend metadata (`app_id`, `action`, `idempotency_key`),
  chain anchors (`tx_hash`, `event_index`, `gas_amount`, `chain_credits`)
- `credit_epochs(network, epoch)` — settlement window + status
  (`pending → submitted → confirmed | failed`), `request_id`, `tx_hash`
- `credit_indexer_state(network)` — `last_processed_block` cursor

RPCs (SECURITY DEFINER, service-role only): `credits_spend`,
`credits_credit_purchase`, `credits_apply_exit`, `credits_prepare_epoch`.
All were exercised against a real Postgres 16 (spend/dedupe/insufficient,
purchase replay, exit clamp, window aggregation, 500-user batch cap,
failed-epoch window release, submitted-epoch re-prepare rejection).

## Endpoints

All responses use the platform envelope; errors are
`{ error: { code, message } }`.

### `credits-ledger`

Auth (repo idiom): Supabase session JWT (`Authorization: Bearer`) or API key
(`X-API-Key`), resolved to the caller's **signature-verified primary wallet
binding** (`user_wallets.is_primary AND verified`, established by
`wallet-bind`/`auth-wallet`). A `wallet` body field, when present, must match
the bound wallet (`403 ADDRESS_MISMATCH`). Guest mode has no session → buy and
spend are unreachable, by design. Spends are off-chain, so the S11 `payments`
manifest permission is NOT enforced here — it gates on-chain buys only.

- `GET ?network=testnet|mainnet[&limit=1..100]`
  → `{ wallet, network, balance, total_purchased, total_spent, total_exited,
  updated_at, events: [{ id, event_type, amount, balance_after, app_id, action,
  idempotency_key, tx_hash, gas_amount, created_at }] }`
- `POST { network, app_id, action?, amount, idempotency_key [, wallet] }`
  - `amount`: positive integer credits (cap: `CREDITS_MAX_SPEND_PER_CALL`,
    default 1,000,000)
  - `idempotency_key`: `[-_a-zA-Z0-9:.]{8,128}`; retries return the original
    outcome with `deduped: true`
  - → `201 { wallet, network, app_id, action, spent, balance, event_id,
    deduped:false }` (or `200` with `deduped:true`)
  - typed failure: `402 { error: { code: "INSUFFICIENT_CREDITS" } }`

### `credits-indexer` (cron)

- Auth: `X-Cron-Secret` must match `CREDITS_CRON_SECRET` (constant-time
  compare; `503 NOT_CONFIGURED` when unset — fails closed).
- `POST { network [, max_blocks] }` — scans blocks
  `last_processed_block+1 .. min(+max_blocks, head)`, extracts
  `CreditsPurchased`/`CreditsExited` from HALT executions of the configured
  contract, applies them via the dedupe RPCs, then advances the cursor.
  Partial failures return `502 { partial: true, ... }` with the cursor advanced
  only through the last fully-processed block.

### `credits-settler` (cron)

- Auth: same `X-Cron-Secret` scheme.
- `POST { network [, dry_run] [, max_users<=500] }` — pipeline per run:
  1. reconcile any `submitted` epoch (application log → confirmed/failed;
     `currentEpoch` progression proves landing when the log is unavailable;
     confirm-timeout `CREDITS_SETTLER_CONFIRM_TIMEOUT_MINUTES`, default 30);
     returns `waiting_confirmation` while undecided,
  2. `credits_prepare_epoch(network, currentEpoch+1, max_users)`
     (`nothing_to_settle` when the window is empty),
  3. submit `postSettlement` via TxProxy (`intent: "credits-settlement"`,
     params `[Integer epoch, Array<Hash160> users, Array<Integer> deltas]`),
     record `request_id`/`tx_hash`, mark `submitted`.
  - `dry_run: true` returns the batch (users + deltas) without posting.

## Environment

| Var | Used by | Meaning |
|-----|---------|---------|
| `CONTRACT_MINIAPP_CREDITS_HASH[_TESTNET/_MAINNET]` | indexer, settler | MiniAppCredits contract hash (lazy-read per call) |
| `CREDITS_CRON_SECRET` | indexer, settler | operator secret for cron endpoints (min 32 chars in production) |
| `CREDITS_INDEXER_START_BLOCK` | indexer | first-run cursor override (e.g. deploy block); defaults to chain head |
| `CREDITS_INDEXER_MAX_BLOCKS` | indexer | per-run block budget (default 100, cap 500) |
| `CREDITS_SETTLER_CONFIRM_TIMEOUT_MINUTES` | settler | how long a submitted settlement may stay unconfirmed before its window is released (default 30) |
| `CREDITS_MAX_SPEND_PER_CALL` | ledger | per-call spend cap in credits (default 1,000,000) |
| `NEO_RPC_URL`, `TXPROXY_SERVICE_URL` | all | standard k8s-config service wiring |

## Operational notes

- Run `credits-indexer` every ~15–60s and `credits-settler` on a coarser
  cadence (e.g. hourly, or when unsettled spend volume crosses a threshold).
  Shorter settler cadence = smaller custody float (see trade-off above).
- The settler requires the TxProxy `/invoke` endpoint to accept nested
  `{type:"Array", value:[...]}` contract parameters (standard Neo RPC
  ContractParameter JSON). This is asserted, not yet live-verified.
- The contract's `setSettler` must point at the TxProxy signing account (or the
  owner account posts settlements).
- Pausing the contract blocks buys and settlements but never reads or exits.
