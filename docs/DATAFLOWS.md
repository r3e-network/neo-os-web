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
SDK ──▶ Edge Function (pay-gas / vote-bneo)
  ├─ validate permissions + limits + assets (GAS/bNEO only)
  └─ return contract invocation for wallet signing
Wallet ──▶ Neo N3 chain (PaymentHub / Governance)
```

## Dataflow: Datafeed Updates (NeoFeeds)

```
External Data Sources (Binance, Coinbase, OKX, Chainlink)
  │
  ▼
NeoFeeds Service
  ├─ Fetch prices from multiple sources (HTTP)
  ├─ Apply aggregation algorithm (median/TWAP)
  ├─ Check deviation threshold (e.g., 0.5%)
  │
  ├─ If threshold exceeded:
  │   └─ TxProxy.invoke(PriceFeed.updatePrice)
  │       └─ PriceFeed contract stores new price
  │       └─ PriceUpdated event emitted
  │       └─ chain_txs (Supabase audit)
  │
  └─ Cache current prices in memory
      └─ Serve via GET /price/{pair}, GET /prices
```

### NeoFeeds Lifecycle

1. **Startup**: Load feed configurations, initialize source clients
2. **Polling Loop**: Fetch prices every N seconds (configurable)
3. **Aggregation**: Compute median across sources, filter outliers
4. **Publishing**: Submit on-chain update if deviation > threshold
5. **Caching**: Store latest prices for API queries

## Dataflow: GasBank Deposits (NeoGasBank)

```
User ──▶ Edge gasbank-deposit (request deposit address)
  └─ deposit_requests (Supabase, status=pending)

User ──▶ GAS.transfer to deposit address (on-chain)

NeoGasBank Service (polling loop)
  ├─ Query Neo N3 for incoming GAS transfers
  ├─ Match against deposit_requests
  ├─ Verify amount and confirmations
  │
  └─ If verified:
      ├─ gasbank_accounts (credit balance)
      ├─ gasbank_transactions (audit record)
      └─ deposit_requests (status=completed)
```

### NeoGasBank Lifecycle

1. **Deposit Request**: User requests deposit address via Edge function
2. **On-Chain Transfer**: User sends GAS to assigned address
3. **Verification**: Service polls chain for incoming transfers
4. **Credit**: Balance credited after sufficient confirmations
5. **Deduction**: Services call `/deduct` to charge fees
6. **Withdrawal**: User can withdraw remaining balance

## Dataflow: VRF Randomness (NeoVRF)

```
MiniApp Contract
  └─ RequestService("rng", payload) ──▶ ServiceLayerGateway
      └─ ServiceRequested event

NeoRequests (event listener)
  └─ Dispatch to NeoVRF service
      │
      ▼
NeoVRF Service
  ├─ Parse request (seed, range, count)
  ├─ Generate VRF proof using TEE private key
  ├─ Sign output with attestation
  │
  └─ Return: { randomness, proof, signature }

NeoRequests
  └─ TxProxy.FulfillRequest(requestId, result)
      └─ ServiceLayerGateway.fulfillRequest
          └─ MiniApp.OnServiceCallback(requestId, result)
          └─ RandomnessLog.recordRandomness (optional)
```

### NeoVRF Lifecycle

1. **Request**: MiniApp requests randomness via Gateway
2. **Dispatch**: NeoRequests routes to VRF service
3. **Generation**: TEE generates verifiable random bytes
4. **Signing**: Output signed with TEE attestation key
5. **Callback**: Result delivered to MiniApp contract
6. **Logging**: Optionally recorded in RandomnessLog for audit

## Dataflow: Oracle Queries (NeoOracle)

```
MiniApp Contract
  └─ RequestService("oracle", payload) ──▶ ServiceLayerGateway
      └─ ServiceRequested event

NeoRequests (event listener)
  └─ Dispatch to NeoOracle service
      │
      ▼
NeoOracle Service
  ├─ Validate URL against whitelist
  ├─ Inject secrets into headers (if configured)
  ├─ Execute HTTP request to external API
  ├─ Parse and transform response
  │
  └─ Return: { data, status, timestamp }

NeoRequests
  └─ TxProxy.FulfillRequest(requestId, result)
      └─ MiniApp.OnServiceCallback(requestId, result)
```

### NeoOracle Lifecycle

1. **Request**: MiniApp requests external data via Gateway
2. **Validation**: URL checked against domain whitelist
3. **Secret Injection**: API keys injected from TEE secrets
4. **Fetch**: HTTP GET/POST to external endpoint
5. **Transform**: Response parsed and formatted
6. **Callback**: Result delivered to MiniApp contract

## Dataflow: Confidential Compute (NeoCompute)

```
MiniApp Contract
  └─ RequestService("compute", payload) ──▶ ServiceLayerGateway
      └─ ServiceRequested event

NeoRequests (event listener)
  └─ Dispatch to NeoCompute service
      │
      ▼
NeoCompute Service
  ├─ Load JavaScript code from payload
  ├─ Inject secrets into execution context
  ├─ Execute in sandboxed V8 isolate
  ├─ Capture output and logs
  │
  └─ Return: { result, logs, gasUsed }

NeoRequests
  └─ TxProxy.FulfillRequest(requestId, result)
      └─ MiniApp.OnServiceCallback(requestId, result)
```

### NeoCompute Lifecycle

1. **Request**: MiniApp submits compute job via Gateway
2. **Loading**: JavaScript code loaded into TEE
3. **Secret Injection**: Secrets available as environment vars
4. **Execution**: Code runs in isolated V8 sandbox
5. **Output**: Result captured with execution metrics
6. **Callback**: Result delivered to MiniApp contract

## Dataflow: Transaction Proxy (TxProxy)

```
TEE Service (NeoRequests, NeoFlow, NeoFeeds)
  └─ POST /invoke (mTLS authenticated)
      │
      ▼
TxProxy Service
  ├─ Validate caller identity (mTLS cert)
  ├─ Check method against allowlist
  ├─ Apply intent policy (if applicable)
  ├─ Sign transaction with TEE signer key
  ├─ Broadcast to Neo N3 network
  │
  └─ Return: { txHash, status }
      └─ chain_txs (Supabase audit)
```

### TxProxy Lifecycle

1. **Request**: Service submits invoke request via mTLS
2. **Validation**: Method checked against allowlist
3. **Policy**: Intent policies applied (rate limits, etc.)
4. **Signing**: Transaction signed with TEE key
5. **Broadcast**: Submitted to Neo N3 RPC
6. **Confirmation**: Wait for block inclusion
7. **Audit**: Record in chain_txs table

## Dataflow: Automation Triggers (NeoFlow)

```
User ──▶ Edge automation-triggers (CRUD)
  └─ automation_triggers (Supabase)

NeoFlow Service (scheduler loop)
  ├─ Load active triggers from database
  ├─ Evaluate trigger conditions:
  │   ├─ Cron: Check schedule expression
  │   ├─ Interval: Check elapsed time
  │   └─ Price: Check price threshold
  │
  └─ If condition met:
      ├─ Execute action:
      │   ├─ Webhook: POST to external URL
      │   └─ Contract: TxProxy.invoke(target, method)
      ├─ automation_executions (Supabase)
      └─ Update nextExecution timestamp
```

### NeoFlow Lifecycle

1. **Create**: User creates trigger via Edge API
2. **Store**: Trigger saved to Supabase
3. **Schedule**: Scheduler evaluates triggers periodically
4. **Evaluate**: Check if trigger condition is met
5. **Execute**: Run webhook or contract invocation
6. **Record**: Log execution result
7. **Reschedule**: Calculate next execution time

## Dataflow: Anchored Periodic Tasks (AutomationAnchor)

```
Admin ──▶ AutomationAnchor.RegisterPeriodicTask(...)
  └─ Task stored on-chain with schedule

User ──▶ GAS.transfer(AutomationAnchor, amount, taskId)
  └─ OnNEP17Payment credits task balance

NeoFlow Service (anchored task loop)
  ├─ Query AutomationAnchor for active tasks
  ├─ Check schedule and balance
  │
  └─ If ready to execute:
      ├─ TxProxy.invoke(AutomationAnchor.ExecutePeriodicTask)
      │   └─ Deduct fee from task balance
      │   └─ Call target contract method
      │   └─ PeriodicTaskExecuted event
      └─ chain_txs (Supabase audit)
```

### AutomationAnchor Lifecycle

1. **Register**: Admin registers periodic task on-chain
2. **Fund**: User deposits GAS to task balance
3. **Monitor**: NeoFlow polls for ready tasks
4. **Execute**: Task executed via TxProxy
5. **Deduct**: Fee deducted from balance
6. **Callback**: Target contract receives call
7. **Repeat**: Reschedule for next interval

## Dataflow: Transaction Simulation (NeoSimulation)

```
Test Framework / CI Pipeline
  └─ Start simulation service

NeoSimulation Service
  ├─ Initialize account pool (1000+ accounts)
  ├─ Load MiniApp contract configurations
  │
  └─ Simulation loop:
      ├─ Select random MiniApp and action
      ├─ Acquire account from pool
      ├─ Build transaction (bet, vote, trade, etc.)
      ├─ Submit via Neo N3 RPC
      ├─ Wait for confirmation
      ├─ Release account to pool
      └─ Record metrics (latency, gas, success)

Results
  └─ simulation_results (Supabase)
  └─ Performance reports
```

### NeoSimulation Lifecycle

1. **Initialize**: Load configs, prepare account pool
2. **Select**: Choose MiniApp and action type
3. **Acquire**: Get available account from pool
4. **Build**: Construct transaction payload
5. **Submit**: Send to Neo N3 network
6. **Confirm**: Wait for block inclusion
7. **Release**: Return account to pool
8. **Record**: Log metrics for analysis

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
