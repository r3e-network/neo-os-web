# MiniApp Workflows

This document describes the **end-to-end workflows** for Neo N3 MiniApps,
updated to reflect the **MiniApp-OS v2** architecture shipped in March 2026.

Current workflow note:

- flagship apps now call **OS system services** (`ctx.os.*`) instead of direct
  per-app contract invocations
- OS service operations (payment, game, checkin, storage, etc.) are executed
  centrally on the external Morpheus kernel contract
  (`CONTRACT_MORPHEUS_ORACLE_HASH`); there are no in-tree per-service OS
  contracts
- the OS Binder edge layer (42 `os-*` functions) enforces auth, permissions,
  and rate limits before forwarding to the kernel
- direct Oracle / direct AA integrations remain for Oracle and AA flows

Primary rule:

- prefer OS service calls (`ctx.os.*`) for payment, storage, game, badge,
  leaderboard, checkin, escrow, NFT, and vesting workflows
- prefer direct Oracle / direct AA integrations for Oracle and AA flows

## MiniApp Lifecycle (Developer + Host)

1. **Build the MiniApp**
    - Author a manifest and host-native playarea definition.
    - Author `manifest.json` following the current host schema and existing `apps/*/neo-manifest.json` examples.
    - Use `defineMiniApp()` as the sole entry point. Call `ctx.os.*` for OS services.
2. **Register or Update Manifest**
    - Call `app-register` or `app-update-manifest` (Supabase Edge).
    - Edge canonicalizes the manifest, enforces **GAS-only / bNEO-only**, and
      returns an invocation against the env-configured external `AppRegistry`
      contract (`CONTRACT_APPREGISTRY_HASH`; source not in this repo) for the
      developer wallet to sign.
    - Manifest now declares `permissions` for OS service access (e.g. `storage`, `payment`, `game`).
3. **On-Chain Registry Approval**
    - Developer wallet signs and submits the `AppRegistry.registerApp` (or
      `updateApp`) invocation, anchoring metadata on-chain.
    - Platform admin sets the AppRegistry status to `Approved` (or `Disabled`)
      after verification.
4. **Publish**
    - Upload the bundle to CDN.
    - Host app reads AppRegistry metadata from Supabase cache + manifest policy.
5. **Runtime Access**
    - Users authenticate via Supabase Auth.
    - Users bind a Neo N3 wallet via `wallet-nonce` + `wallet-bind`.
    - MiniApps call OS services via `ctx.os.*` proxies, which route through the
      42 OS Binder edge functions to the external Morpheus kernel contract.
    - Oracle / AA flows continue to use direct Oracle / direct AA integrations.
6. **Platform Indexing**
    - Indexer tracks approved MiniApps and parses platform events.
    - Host UI reads `miniapp-stats` and `miniapp-notifications` for analytics and news.

## Direct Oracle / AA Workflow

This is the preferred runtime path.

1. **MiniApp / Host Request**
    - Browser-side MiniApps call `window.MiniAppSDK`.
    - Host-only tooling uses `createHostSDK(...)` or same-origin host proxies.
2. **Platform Gateway / Proxy**
    - Edge validates auth, rate limits, manifest permissions, and usage caps.
    - Host `/api/aa/relay` forwards relay-ready payloads to the external AA relay.
3. **External Runtime**
    - `neo-morpheus-oracle` handles:
        - allowlisted Oracle queries
        - datafeed price reads
        - VRF / randomness
        - compute script execution
        - paymaster authorization
    - `neo-abstract-account` handles:
        - relay submission
        - verifier-aware `executeUserOp`
        - paymaster-backed AA execution
4. **Result / Receipt**
    - The platform displays the direct response, relay receipt, or indexed chain result.

## Platform Indexer + Analytics Workflow

1. **Block Sync**
    - Indexer subscribes to Neo N3 blocks with a confirmation depth.
    - Reorgs trigger backfill to keep stats consistent.
2. **Event Filtering**
    - Loads AppRegistry approvals and manifest hashes.
    - Filters events to approved MiniApps only.
3. **Notification Ingestion**
    - Parses `Platform_Notification(app_id, title, content, notification_type, priority)`.
    - Requires a valid `manifest.contract_hash` when strict ingestion is enabled.
    - Writes `miniapp_notifications` rows for the host feed.
4. **Metric Ingestion**
    - Parses `Platform_Metric(app_id, metric_name, value)` and scans tx scripts for
      `System.Contract.Call` activity.
    - Writes `miniapp_tx_events` and daily snapshots to `miniapp_stats_daily`.
5. **Aggregation**
    - Aggregator rolls up into `miniapp_stats` (totals, DAU/WAU, gas).
6. **Realtime Push**
    - Supabase Realtime broadcasts new `miniapp_notifications`.

## OS Service Workflow (MiniApp-OS v2)

This is the primary runtime path for most MiniApp operations since v2.

### Call Flow

```
MiniApp Frontend
  │
  │  ctx.os.checkin.checkIn()
  │
  ▼
CheckinProxy (apps/shared/services/os/CheckinProxy.ts)
  │
  │  EdgeClient.call("os-checkin-checkin", { appId })
  │
  ▼
Edge Function: os-checkin-checkin (platform/edge/functions/os-checkin-checkin/)
  │
  │  1. validateAuth(req) — Supabase JWT check
  │  2. validatePermission(appId, "checkin") — manifest permission check
  │  3. rateLimit(userId, appId, "os-checkin-checkin")
  │  4. read kernel state (e.g. getPlatformStats) via Neo RPC
  │
  ▼
Morpheus kernel contract (external, `CONTRACT_MORPHEUS_ORACLE_HASH`)
  │
  │  Edge returns a GAS.transfer intent to the kernel with the appId
  │  encoded in the memo; the user wallet signs it and the kernel's
  │  OnNEP17Payment routes the call and updates the streak
  │
  ▼
Result returned to frontend
```

### OS Services Available

All rows route to the single external Morpheus kernel contract
(`CONTRACT_MORPHEUS_ORACLE_HASH`); there are no in-tree per-service OS
contracts. The ten `CONTRACT_*SERVICE_HASH` slots in `.env.example` are a
legacy map retained for documentation parity only.

| Proxy | Edge Functions | Typical Use |
| --- | --- | --- |
| `ctx.os.storage` | `os-storage-{get,set,delete,list,grant-access,read-shared}` | App-scoped KV data |
| `ctx.os.payment` | `os-payment-{deposit,withdraw,transfer,balance}` | Deposits, balances, prize distribution |
| `ctx.os.game` | `os-game-{create,join,bet,settle,status}` | Pool management, betting, settlement |
| `ctx.os.checkin` | `os-checkin-{checkin,streak,claim}` | Daily check-in, streaks, rewards |
| `ctx.os.badge` | `os-badge-{define,award,list,revoke,get-stat,update-stat}` | Achievement badges |
| `ctx.os.leaderboard` | `os-leaderboard-{submit,get,reset}` | Ranked scores |
| `ctx.os.nft` | `os-nft-{mint,transfer,burn,list,validate}` | Minting, soulbound, tickets |
| `ctx.os.escrow` | `os-escrow-{create,fund,get,complete,refund}` | Milestone-based escrow |
| `ctx.os.vesting` | `os-vesting-{create,claim,cancel,get,list}` | Token vesting schedules |

## MiniApp Payment Workflow (Frontend → Contract → Payout)

This is the **correct business workflow** for MiniApps that involve payments
(gaming, DeFi, social). The simulation layer follows this exact pattern.

### Workflow Diagram (OS v2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MiniApp Payment Workflow (OS v2)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  OS payment flow (preferred for new apps)                                  │
│  ctx.os.payment.deposit(appId, amount)                                     │
│    → Edge: os-payment-deposit (auth + permission + rate limit)             │
│      → GAS.transfer intent to the Morpheus kernel, appId in memo           │
│        → kernel OnNEP17Payment routes the deposit                          │
│                                                                             │
│  OS game settlement                                                        │
│  ctx.os.game.settle(appId, poolId, results)                                │
│    → kernel settles the pool and distributes prizes internally             │
│                                                                             │
│  Direct prepaid flow (still supported for existing contracts)              │
│  User wallet ──▶ GAS / asset transfer ──▶ MiniApp contract                 │
│                    └─ OnNEP17Payment records prepaid credit                │
│                    └─ user then invokes MiniApp method                     │
│                    └─ contract consumes credit and updates state           │
│                                                                             │
│  Oracle / VRF apps                                                         │
│  OS / MiniApp contract ──▶ Morpheus Oracle callback request                │
│                    └─ callback contract may need prepaid Oracle fee credit │
│                    └─ callback resolves state and emits final result       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. **USER ACTION: SDK prepares the correct transfer**
    - direct prepaid apps return a transfer intent targeting the MiniApp contract
    - the wallet signs and broadcasts the transfer

2. **USER ACTION: call the MiniApp contract**
    - direct prepaid apps call the MiniApp contract after credit is recorded

3. **CONTRACT ACTION: update app state**
    - MiniApp contracts record bets, tickets, streams, keys, envelopes, or inventory

4. **OPTIONAL ORACLE ACTION**
    - VRF / Oracle / compute flows queue Morpheus callback requests
    - callback consumer contracts may need prepaid Oracle fee credit

5. **FINAL ON-CHAIN RESULT**
    - the MiniApp contract emits the settlement / payout event
    - direct token transfers and event logs become the audit trail

### Example: Direct Prepaid Workflow

```
User clicks "Spin" in GASBOX
    │
    ▼
SDK returns GAS.transfer to the GASBOX contract
    │
    ▼
MiniApp contract receives prepaid GAS in OnNEP17Payment
    │
    ▼
User invokes initiatePlay(...)
    │
    ▼
Contract stores seed and later verifies settlePlay(...)
    │
    ▼
Contract transfers prize and emits PlayResolved
```

### Key Principles

- users sign both value transfer and MiniApp contract calls when required
- MiniApp contracts own app-specific state and settlement logic
- Oracle callback apps may require separate prepaid fee credit for the callback contract

## Off-Chain (Gateway) Workflows

### Payments (GAS only)

1. SDK calls `pay-gas` Edge function.
2. Edge validates:
    - manifest permissions (`payments`)
    - `assets_allowed == ["GAS"]`
    - per-user daily caps
3. Edge returns a GAS `transfer` invocation to the MiniApp contract.
4. Wallet signs and broadcasts the network.

### Governance (bNEO only)

1. SDK calls `vote-bneo`.
2. Edge validates:
    - manifest permissions (`governance`)
    - `governance_assets_allowed == ["bNEO"]`
3. Edge returns a `Governance.vote` invocation against the env-configured
   external governance contract (`CONTRACT_GOVERNANCE_HASH`; source not in
   this repo).
4. Wallet signs and broadcasts to the network.

### GasBank (Optional, GAS deposits + fee deduction)

1. SDK calls `gasbank-account` / `gasbank-deposit`.
2. Edge validates auth + wallet binding and writes `deposit_requests` (Supabase).
3. `neogasbank` verifies the on-chain deposit, updates `gasbank_accounts`, and
   writes `gasbank_transactions`.
4. TEE services may call `neogasbank /deduct` to charge service fees.
5. Optional: when `TOPUP_ENABLED=true`, `neogasbank` requests NeoAccounts `/fund`
   to top up pool accounts with low GAS balances.

## Testnet Payment + Governance Validation (Runbook)

Use these scripts to validate GAS payments and bNEO governance flows on testnet.

### GAS Payment

Use `pay-gas` to obtain a wallet-signed GAS transfer intent that targets the
MiniApp contract directly.

### Governance (Stake + Vote)

Use `vote-bneo` to obtain a wallet-signed `Governance.vote` intent against the
env-configured external governance contract. The old standalone
`test_governance_flow.go` helper was removed with the legacy service layer.

## Datafeed Workflow (0.1% Threshold)

1. `neofeeds` polls configured sources on `NEOFEEDS_UPDATE_INTERVAL` (commonly `1s`).
2. Computes a median price across configured sources.
3. Triggers on-chain update when `abs(delta) / last` exceeds `NEOFEEDS_PUBLISH_THRESHOLD_BPS` (default `10`, i.e. `0.1%`).
4. Applies hysteresis + throttling via `NEOFEEDS_PUBLISH_HYSTERESIS_BPS`, `NEOFEEDS_PUBLISH_MIN_INTERVAL`, and `NEOFEEDS_PUBLISH_MAX_PER_MINUTE`.
5. Optional heartbeat publishes are controlled by `NEOFEEDS_PUBLISH_HEARTBEAT_INTERVAL` when source timestamps advance.
6. The on-chain DataFeed contract (owned by `neo-morpheus-oracle`, not in this
   repo) stores the update and emits events for subscribers.

Current production/testnet symbol set includes:
`NEO-USD`, `GAS-USD`, `USDT-USD`, `USDC-USD`, `BTC-USD`, `ETH-USD`, `XRP-USD`,
`BNB-USD`, `SOL-USD`, `TRX-USD`, `DOGE-USD`, `XAU-USD`, `XAG-USD`, `NVDA-USD`,
`AAPL-USD`, `GOOGL-USD`, `MSFT-USD`, `META-USD`, `TSM-USD`, `TSLA-USD`,
`TCEHY-USD`.

## Automation Workflow (Optional On-Chain Anchoring)

1. `neoflow` stores triggers (Supabase).
2. Scheduler evaluates triggers and executes actions.
3. If anchoring is enabled, the external automation stack's on-chain
   `AutomationAnchor` contract records execution metadata (env-configured via
   `CONTRACT_AUTOMATIONANCHOR_HASH`; source not in this repo).

## Failure and Retry Behavior

- NeoRequests marks failures in `service_requests` and records `chain_txs` errors.
- Callback submission can be retried based on `retry_count`.
- Use `NEOREQUESTS_TX_WAIT=true` to wait for confirmation when needed.
- When waiting for confirmations, set `TXPROXY_TIMEOUT` long enough for chain
  finality (testnet commonly needs 60s+).

## Testnet Callback Validation (Runbook)

Use this runbook to validate the **full on-chain request → service → callback**
workflow on Neo N3 testnet.

1. **Deploy a MiniApp callback contract**
    - Build artifacts are expected in `contracts/build/`.
    - If missing, run: `./contracts/build.sh`.
    - Deploy any callback-capable MiniApp contract from `contracts/` (e.g.
      `MiniAppTarotVrf`) with the current deployment tooling; the old generic
      `deploy_miniapp.go` helper was removed with the legacy service layer.
    - Record the deployed contract hash.
2. **Seed Supabase `miniapps`**
    - Insert a manifest row with:
        - `app_id` matching the request (e.g., `com.test.consumer`).
        - `permissions.rng=true` (or `oracle` / `compute`).
        - `callback_contract` set to the deployed MiniApp contract hash.
        - `callback_method` set to the contract's callback entrypoint (the
          canonical rich adapter in in-tree apps is `OnMiniAppResult`).
3. **Register + Approve in AppRegistry** (external contract, env-configured)
    - Use the current deployment/registration toolchain that writes directly from the active manifests and deployment registries.
    - Do not use the removed legacy Supabase registration helpers from older service-layer workflows.
4. **Trigger a direct service request**
    - Run:
        ```bash
        # verify direct Oracle / AA testnet path end-to-end
        export AA_TEST_WIF=<funded-aa-testnet-wif>
        bash deploy/scripts/verify_cross_repo_testnet.sh
        ```
    - For Oracle / Compute / AA:

        ```bash
        export AA_TEST_WIF=<funded-aa-testnet-wif>
        bash deploy/scripts/verify_cross_repo_testnet.sh
        ```

5. **Verify the direct runtime result**
    - Check the Oracle / AA runtime output and chain receipt.
    - Query chain state or app-specific getters to confirm the effect.
    - Review the direct validation script output and the resulting chain state.

If the direct runtime result does not arrive, verify:

- `MORPHEUS_RUNTIME_URL` or the legacy `NEOVRF_URL` / `NEOORACLE_URL` / `NEOCOMPUTE_URL` endpoints are reachable.
- `MORPHEUS_PUBLIC_API_URL`, `MORPHEUS_EDGE_URL`, and `AA_RELAY_URL` are reachable.
- `AA_RELAY_URL` points at the intended external relay.
- paymaster policy allowlists the current AA core and target account when sponsorship is enabled.

## Automated Full Workflow (Testnet)

Use the helper scripts to run:

- direct Oracle / direct AA cross-repo validation

```bash
./deploy/scripts/verify_cross_repo_testnet.sh
```

Required environment variables:

- `NEO_TESTNET_WIF` (funded testnet signer for the Oracle smoke path)
- `AA_TEST_WIF` (funded AA testnet WIF that controls the configured
  `PAYMASTER_ACCOUNT_ID` for the stable allowlisted paymaster path)

## Automation Workflow (Periodic Tasks)

The platform's automation system executes periodic tasks via the external
NeoFlow service. The system supports two modes:

1. **Off-Chain Triggers** (Supabase-based): user-managed triggers via the
   `automation-trigger-*` edge functions documented below
2. **On-Chain Anchored Tasks**: NeoFlow can optionally anchor periodic-task
   metadata on-chain via an `AutomationAnchor` contract owned by the external
   automation stack (`CONTRACT_AUTOMATIONANCHOR_HASH`; source not in this
   repo — the in-tree copy was removed)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Automation Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │   NeoFlow    │───▶│ On-Chain Anchor  │───▶│  Target Contract         │  │
│  │   Service    │    │   (external)     │    │  (MiniApp/Platform)      │  │
│  │   (TEE)      │    │                  │    │                          │  │
│  └──────────────┘    └──────────────────┘    └──────────────────────────┘  │
│         │                     │                                             │
│         ▼                     ▼                                             │
│  ┌──────────────┐    ┌──────────────┐                                      │
│  │  Supabase    │    │  GAS Deposit │                                      │
│  │  Triggers    │    │     Pool     │                                      │
│  └──────────────┘    └──────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

The anchored-task deposit pool, task lifecycle operations, and per-execution
fees are behaviors of the external anchor contract; they are documented with
the external automation stack, not here.

### Off-Chain Triggers (NeoFlow API)

For non-anchored automation, users can create triggers via the NeoFlow API:

#### Create Trigger

```
POST /functions/v1/automation-triggers
Authorization: Bearer <supabase-jwt>

{
  "name": "Daily Price Alert",
  "trigger_type": "cron",
  "schedule": "0 0 * * *",
  "action": {
    "type": "webhook",
    "url": "https://example.com/webhook",
    "method": "POST",
    "body": {"message": "Daily alert"}
  }
}
```

**Trigger Types:**

- `cron`: Time-based with cron expression
- `interval`: Fixed interval (not anchored on-chain)
- `price`: Price threshold condition
- `threshold`: Balance threshold condition

#### List Triggers

```
GET /functions/v1/automation-triggers
Authorization: Bearer <supabase-jwt>

Response:
[
  {
    "id": "uuid",
    "name": "Daily Price Alert",
    "trigger_type": "cron",
    "schedule": "0 0 * * *",
    "enabled": true,
    "last_execution": "2025-12-28T00:00:00Z",
    "next_execution": "2025-12-29T00:00:00Z",
    "created_at": "2025-12-01T00:00:00Z"
  }
]
```

#### Update Trigger

```
PUT /functions/v1/automation-trigger-update
Authorization: Bearer <supabase-jwt>

{
  "id": "uuid",
  "name": "Updated Name",
  "schedule": "0 12 * * *"
}
```

#### Enable/Disable Trigger

```
POST /functions/v1/automation-trigger-enable
POST /functions/v1/automation-trigger-disable
Authorization: Bearer <supabase-jwt>

{
  "id": "uuid"
}
```

#### Delete Trigger

```
DELETE /functions/v1/automation-trigger-delete
Authorization: Bearer <supabase-jwt>

{
  "id": "uuid"
}
```

#### View Execution History

```
GET /functions/v1/automation-trigger-executions?trigger_id=uuid
Authorization: Bearer <supabase-jwt>

Response:
[
  {
    "id": "uuid",
    "trigger_id": "uuid",
    "executed_at": "2025-12-28T00:00:00Z",
    "success": true,
    "action_type": "webhook",
    "action_payload": {...}
  }
]
```

### Configuration and Environment Variables

#### NeoFlow Service (external)

- `NEOFLOW_TASK_IDS`: Comma-separated list of anchored task IDs to monitor
- `CONTRACT_AUTOMATIONANCHOR_HASH`: external AutomationAnchor contract hash
  (source not in this repo)
- `NEOFLOW_ENABLE_CHAIN_EXEC`: Enable on-chain task execution (default: true)

# Note

For the current flagship path, **OS service calls** (`ctx.os.*`) are the
canonical pattern for payment, storage, game, badge, checkin, leaderboard,
escrow, NFT, and vesting workflows. Direct Morpheus Oracle callbacks and
direct AA relay integration remain canonical for Oracle and AA flows. Use
`docs/ARCHITECTURE.md`, `docs/FRONTEND_SPECIFICATION.md`, and `README.md` as the
current source of truth.
