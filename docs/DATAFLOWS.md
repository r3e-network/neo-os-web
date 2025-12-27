# Dataflow Reference

This document describes how data moves through the platform, including
event ingestion, service dispatch, and audit persistence.

## Components

- **MiniApp Contract**: emits `ServiceRequested`, receives callbacks.
- **ServiceLayerGateway**: on-chain request router + callback dispatcher.
- **NeoRequests**: on-chain event listener + service dispatcher.
- **TEE Services**: neovrf, neooracle, neocompute (and others).
- **TxProxy**: allowlisted transaction signer + broadcaster.
- **Indexer/Aggregator**: chain syncer + analytics rollups + notifications.
- **Supabase**: Auth, RLS, and audit tables.
- **Edge Functions**: gateway API surface for the SDK/host.

## Dataflow: On-Chain Request + Callback

```
MiniApp Contract
  └─ RequestService(...) ──▶ ServiceLayerGateway
      └─ ServiceRequested event ──▶ NeoRequests
          ├─ contract_events (Supabase)
          ├─ processed_events (idempotency)
          ├─ service_requests (status + payload)
          └─ call TEE service (neovrf/neooracle/neocompute)
                 └─ result payload
          └─ TxProxy.FulfillRequest ──▶ ServiceLayerGateway
              └─ ServiceFulfilled event
              └─ callback to MiniApp Contract
              └─ chain_txs (Supabase)
```

`ServiceRequested` and `ServiceFulfilled` are the **authoritative notifications**
for MiniApp service lifecycles. NeoRequests is the only component that consumes
`ServiceRequested` and produces `FulfillRequest` callback transactions.
Payload formats are defined in `docs/service-request-payloads.md`.

## Dataflow: MiniApp Registration (AppRegistry)

```
Developer ──▶ Edge app-register (manifest validation + hash)
  └─ Supabase miniapps upsert (canonical manifest)
  └─ AppRegistry.registerApp intent (wallet signed)
Wallet ──▶ Neo N3 chain (AppRegistry.registerApp)
Admin ──▶ Neo N3 chain (AppRegistry.setStatus Approved/Disabled)
```

Supabase remains the runtime cache for quick lookups; AppRegistry is the
immutable on-chain anchor for audits and governance.
NeoRequests also listens for AppRegistry `AppRegistered`/`AppUpdated`/`StatusChanged`
to keep Supabase `miniapps` status/entry_url/manifest_hash/metadata aligned with chain state
(pending/approved/disabled).

## Dataflow: Platform Indexer + Analytics + Notifications

```
Neo N3 blocks
  └─ Indexer (chain syncer)
      ├─ parse AppRegistry + MiniApp events
      ├─ processed_events (idempotency)
      ├─ miniapp_notifications (Platform_Notification)
      ├─ miniapp_tx_events (tx hash + sender for analytics)
      ├─ miniapp_stats_daily (daily tx + active users)
      └─ miniapp_stats (rollups)
          └─ Supabase Realtime (push notifications)
```

### Event Standards

- `Platform_Notification(app_id, title, content, notification_type, priority)` drives news/notification feeds.
- `Platform_Metric(app_id, metric_name, value)` drives custom KPIs.
- In strict mode, event ingestion and tx tracking require `manifest.contract_hash` to match the emitting contract.
- `news_integration=false` in the manifest can disable notification ingestion for that app.
- `miniapp_tx_events` stores tx hashes + sender addresses (from System.Contract.Call scans, with
  event-based fallback) and drives tx_count/active_users rollups.

## Dataflow: MiniApp Payment + Game Logic

This is the **primary dataflow** for MiniApps involving payments (gaming, DeFi).

```
User (Wallet)
  └─ SDK.payGAS(appId, amount, memo) ──▶ GAS.transfer ──▶ PaymentHub (OnNEP17Payment)
      └─ Payment recorded with appId
      └─ PaymentReceived event ──▶ Platform Services
          ├─ Invoke MiniApp Contract (game logic)
          │   └─ MiniAppLottery.recordTickets(...)
          │   └─ MiniAppCoinFlip.recordBet(...)
          │   └─ etc.
          ├─ Request VRF randomness (if needed)
          │   └─ neovrf service
          ├─ Determine outcome
          └─ PayoutToUser(appId, winner, amount, memo)
              └─ Winner receives GAS
              └─ Payout recorded for audit
```

### Key Points

- **Users only interact with PaymentHub** via SDK `payGAS`
- **MiniApp contracts store app-specific state** (bets, tickets, votes)
- **Platform orchestrates** payment → logic → payout flow
- **All payouts flow through platform** for audit trail

## Dataflow: Edge-Gated Payments / Governance

```
SDK ──▶ Edge Function (pay-gas / vote-neo)
  ├─ validate permissions + limits + assets (GAS/NEO only)
  └─ return contract invocation for wallet signing
Wallet ──▶ Neo N3 chain (PaymentHub / Governance)
```

## Dataflow: Datafeed Updates

```
External exchanges ──▶ neofeeds
  └─ median + threshold
  └─ txproxy submit PriceFeed update
  └─ PriceFeed emits events (on-chain audit)
```

## Dataflow: GasBank Deposits (Optional)

```
User ──▶ Edge gasbank-* functions
  └─ deposit_requests (Supabase)
      └─ neogasbank verifies on-chain deposits
          └─ gasbank_accounts / gasbank_transactions (Supabase)
          └─ optional fee deductions for services
```

## Supabase Tables (Audit + Idempotency)

- `contract_events`: raw on-chain events captured by NeoRequests.
- `processed_events`: idempotency guard for event processing.
- `service_requests`: normalized request/response state for MiniApp callbacks.
- `chain_txs`: callback transaction auditing (status, errors, gas).

## Supabase Tables (Analytics + Notifications)

- `miniapp_stats`: aggregate totals and activity.
- `miniapp_stats_daily`: daily snapshots for trending.
- `miniapp_usage`: per-user daily usage (source for rollups and cap enforcement).
- `miniapp_notifications`: news/alerts emitted by MiniApps.
  - Mapping note: design docs may use `apps`, `app_stats`, `app_news` for these.

## Supabase Tables (Account Pool Persistence)

- `pool_accounts`: account metadata + lock state used by AccountPool.
- `pool_account_balances`: per-token balances for each pool account.

These tables must remain persistent across restarts to preserve account
allocation history and lock ownership.

## Configuration Sources

Runtime values are sourced from:

- `.env` / `.env.local` for local dev.
- `config/development.env`, `config/testing.env`, `config/production.env` for
  deployment defaults.
- `deploy/config/testnet_contracts.json` for testnet contract hashes.

All service and gateway deployments should read contract hashes and URLs from
these sources to avoid hardcoding.
