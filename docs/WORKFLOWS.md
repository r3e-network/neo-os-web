# MiniApp Workflows

This document describes the **end-to-end workflows** for Neo N3 MiniApps,
including on-chain service requests, callback handling, and the platform's
off-chain gateway flows.

## MiniApp Lifecycle (Developer + Host)

1. **Build the MiniApp**
    - Create a bundle (Module Federation or iframe bundle).
    - Author `manifest.json` following `docs/manifest-spec.md`.
2. **Register or Update Manifest**
    - Call `app-register` or `app-update-manifest` (Supabase Edge).
    - Edge canonicalizes the manifest, enforces **GAS-only / bNEO-only**, and
      returns an `AppRegistry` invocation for the developer wallet to sign.
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
    - SDK calls Edge functions or on-chain ServiceLayerGateway for services.
6. **Platform Indexing**
    - Indexer tracks approved MiniApps and parses platform events.
    - Host UI reads `miniapp-stats` and `miniapp-notifications` for analytics and news.

## On-Chain Service Request/Callback Workflow

This is the **callback workflow** for service contracts requested by MiniApps.

1. **MiniApp Contract Request**
    - Contract calls:
      `ServiceLayerGateway.RequestService(app_id, service_type, payload, callback_contract, callback_method)`.
    - `payload` is a `ByteString` (UTF-8 JSON); canonical formats live in
      `docs/service-request-payloads.md`.
2. **ServiceRequested Event**
    - `ServiceLayerGateway` emits `ServiceRequested` with:
      `(request_id, app_id, service_type, requester, callback_contract, callback_method, payload)`.
3. **NeoRequests Dispatcher**
    - Listens to `ServiceRequested`.
    - Stores the event in Supabase `contract_events`.
    - Marks `processed_events` for idempotency.
    - Loads the MiniApp manifest from Supabase.
    - Validates:
        - app status is active (pending/disabled blocked)
        - service permission is granted
        - callback target matches manifest (unless explicitly allowed)
        - AppRegistry status is `Approved` (when enabled)
        - AppRegistry manifest hash matches Supabase (when enabled)
4. **Service Execution**
    - Routes to the enclave service:
        - `neovrf` (`/random`)
        - `neooracle` (`/query`)
        - `neocompute` (`/execute`)
    - Normalizes and truncates the result to `NEOREQUESTS_MAX_RESULT_BYTES`.
5. **Callback Transaction**
    - NeoRequests submits `ServiceLayerGateway.FulfillRequest(...)` via `txproxy`.
    - `txproxy` enforces allowlisted contract + method.
6. **MiniApp Callback**
    - `ServiceLayerGateway` emits `ServiceFulfilled`.
    - `ServiceLayerGateway` invokes the MiniApp callback:
      `(request_id, app_id, service_type, success, result, error)`.
7. **Audit Records**
    - `service_requests` and `chain_txs` rows are updated for status + auditing.

### MiniApp Callback Contract Requirements

- Implement the callback method declared in the manifest (`callback_method`).
- Use the signature:
  `(request_id, app_id, service_type, success, result, error)`.
- Avoid throwing/reverting in callbacks; failures are recorded as `service_requests`
  and can be retried by the dispatcher.

### Event Monitoring & Retry

- NeoRequests is the **event monitor** for `ServiceRequested` and the single
  place where callbacks are dispatched.
- Idempotency is enforced via `processed_events` (Supabase).
- Failed callbacks are recorded with error details; retries are performed using
  `retry_count` and the queued request state.

## Platform Indexer + Analytics Workflow

1. **Block Sync**
    - Indexer subscribes to Neo N3 blocks with a confirmation depth.
    - Reorgs trigger backfill to keep stats consistent.
2. **Event Filtering**
    - Loads AppRegistry approvals and manifest hashes.
    - Filters events to approved MiniApps only.
3. **Notification Ingestion**
    - Parses `Platform_Notification(app_id, title, content, notification_type, priority)`.
    - Requires a valid `manifest.contracts.<chain>.address` when strict ingestion is enabled.
    - Writes `miniapp_notifications` rows for the host feed.
4. **Metric Ingestion**
    - Parses `Platform_Metric(app_id, metric_name, value)` and scans tx scripts for
      `System.Contract.Call` activity.
    - Writes `miniapp_tx_events` and daily snapshots to `miniapp_stats_daily`.
5. **Aggregation**
    - Aggregator rolls up into `miniapp_stats` (totals, DAU/WAU, gas).
6. **Realtime Push**
    - Supabase Realtime broadcasts new `miniapp_notifications`.

## MiniApp Payment Workflow (Frontend → Contract → Payout)

This is the **correct business workflow** for MiniApps that involve payments
(gaming, DeFi, social). The simulation layer follows this exact pattern.

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MiniApp Payment Workflow                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────┐    ┌────────────┐    ┌──────────────────────┐ │
│  │  User    │───▶│   SDK   │───▶│ PaymentHub │───▶│ OnNEP17Payment       │ │
│  │ (Wallet) │    │ payGAS  │    │  (GAS)     │    │ (records payment)    │ │
│  └──────────┘    └─────────┘    └────────────┘    └──────────────────────┘ │
│       │                                                     │               │
│       │ USER ACTION                                         │               │
│       ▼                                                     ▼               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        PLATFORM ACTIONS                               │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  1. Platform detects payment via PaymentHub events                    │  │
│  │  2. Platform invokes MiniApp Contract (game logic, state updates)     │  │
│  │  3. Platform determines winners (using VRF for randomness)            │  │
│  │  4. Platform sends payouts to winners via PayoutToUser                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. **USER ACTION: Pay via SDK**
    - User interacts with MiniApp frontend (e.g., buy lottery ticket, place bet)
    - MiniApp calls `window.MiniAppSDK.payments.payGAS(appId, amount, memo)`
    - SDK returns an invocation intent for GAS `transfer` to `PaymentHub`
    - User's wallet signs and broadcasts the GAS transfer

2. **PLATFORM ACTION: Process Payment**
    - `PaymentHub.OnNEP17Payment` callback receives the GAS
    - Payment is recorded with `appId` extracted from memo/data
    - Platform services detect the payment event

3. **PLATFORM ACTION: Invoke MiniApp Contract**
    - Platform calls the MiniApp's own contract to process game logic
    - Example: `MiniAppLottery.recordTickets(round, user, ticketCount)`
    - MiniApp contract stores app-specific state (bets, tickets, votes, etc.)

4. **PLATFORM ACTION: Determine Outcome**
    - For games: Platform uses VRF service for provable randomness
    - For predictions: Platform checks oracle price feeds
    - MiniApp contract records the outcome

5. **PLATFORM ACTION: Send Payouts**
    - Platform calls `PayoutToUser(appId, winner, amount, memo)`
    - Winners receive GAS directly to their wallets
    - Payout is recorded for auditing

### Example: Lottery Workflow

```
User clicks "Buy 5 Tickets" in Lottery MiniApp
    │
    ▼
SDK.payGAS("builtin-lottery", "0.5", "lottery:round:42:tickets:5")
    │
    ▼
PaymentHub receives 0.5 GAS with memo
    │
    ▼
Platform invokes MiniAppLottery.recordTickets(42, userAddr, 5)
    │
    ▼
[Later] Platform triggers draw using VRF randomness
    │
    ▼
Platform invokes MiniAppLottery.recordWinner(42, winnerAddr)
    │
    ▼
Platform calls PayoutToUser("builtin-lottery", winnerAddr, prizeAmount, "lottery:win:42")
```

### Key Principles

- **Users never directly invoke MiniApp contracts** - they only pay via SDK
- **MiniApp contracts store app-specific state** - not payment logic
- **Platform orchestrates the workflow** - payment → logic → payout
- **All payments flow through PaymentHub** - single audit point

## Off-Chain (Gateway) Workflows

### Payments (GAS only)

1. SDK calls `pay-gas` Edge function.
2. Edge validates:
    - manifest permissions (`payments`)
    - `assets_allowed == ["GAS"]`
    - per-user daily caps
3. Edge returns a GAS `transfer` invocation to `PaymentHub`.
4. Wallet signs and broadcasts the network.

### Governance (bNEO only)

1. SDK calls `vote-bneo`.
2. Edge validates:
    - manifest permissions (`governance`)
    - `governance_assets_allowed == ["bNEO"]`
3. Edge returns a `Governance.vote` invocation.
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

### GAS Payment (PaymentHub)

```bash
# Send a real GAS transfer to PaymentHub (OnNEP17Payment)
go run scripts/send_paymenthub_gas.go

# Optional overrides
# PAY_APP_ID=builtin-lottery
# PAY_GAS_AMOUNT=100000   # 0.001 GAS
```

### Governance (Stake + Vote)

```bash
# Stake + vote with a small bNEO amount
go run scripts/test_governance_flow.go

# Optional overrides
# GOV_PROPOSAL_ID=test-proposal-1
# GOV_STAKE_AMOUNT=1
# GOV_VOTE_AMOUNT=1
# GOV_VOTE_SUPPORT=true
```

If `GOV_PROPOSAL_ID` is not set, the script auto-generates a unique proposal ID
based on the latest block timestamp.

## Datafeed Workflow (0.1% Threshold)

1. `neofeeds` polls configured sources every second.
2. Computes a median price.
3. Triggers an on-chain update if `abs(delta) / last >= 0.001`.
4. Throttles to max 1 tx per symbol per 5 seconds and uses hysteresis.
5. `PriceFeed` stores the update and emits events for subscribers.

## Automation Workflow (Optional On-Chain Anchoring)

1. `neoflow` stores triggers (Supabase).
2. Scheduler evaluates triggers and executes actions.
3. If anchoring is enabled, `AutomationAnchor` records execution metadata.

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
    - Run:
        ```bash
        # deploy MiniAppLottery (or any MiniApp with callback support)
        go run scripts/deploy_miniapp.go --contract MiniAppLottery
        ```
    - Record the deployed contract address printed by the script.
2. **Seed Supabase `miniapps`**
    - Insert a manifest row with:
        - `app_id` matching the request (e.g., `com.test.consumer`).
        - `permissions.rng=true` (or `oracle` / `compute`).
        - `callback_contract` set to the deployed MiniApp contract address.
        - `callback_method` set to `onServiceCallback`.
3. **Register + Approve in AppRegistry**
    - Register the manifest on-chain and approve it:
        ```bash
        # uses manifest from Supabase by default (set MINIAPP_APP_ID if needed)
        go run scripts/register_miniapp_appregistry.go
        ```
    - Optional overrides:
        ```bash
        # use a local manifest file instead of Supabase
        export MINIAPP_MANIFEST_PATH=miniapps/templates/react-starter/manifest.json
        # override developer pubkey if needed
        export MINIAPP_DEVELOPER_PUBKEY=03...
        # use a separate admin key (optional)
        export MINIAPP_ADMIN_WIF=Kx...
        ```
4. **Trigger a service request**
    - Run:
        ```bash
        # set the MiniApp contract address from step 1
        export CONTRACT_MINIAPP_CONSUMER_ADDRESS=0x...
        # wait for the callback to land in the MiniApp contract
        export MINIAPP_WAIT_CALLBACK=true
        # optional: override callback wait timeout (default 180s)
        export MINIAPP_CALLBACK_TIMEOUT_SECONDS=240
        # calls MiniAppLottery.requestRng(app_id) or similar RNG method
        go run scripts/request_miniapp_rng.go
        ```
    - For Oracle / Compute:

        ```bash
        export CONTRACT_MINIAPP_CONSUMER_ADDRESS=0x...
        export MINIAPP_SERVICE_TYPE=oracle
        export MINIAPP_WAIT_CALLBACK=true
        # optional override; uses a Binance price query by default
        export MINIAPP_SERVICE_PAYLOAD='{"url":"https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT","json_path":"price"}'
        go run scripts/request_miniapp_service.go

        export MINIAPP_SERVICE_TYPE=compute
        export MINIAPP_WAIT_CALLBACK=true
        export MINIAPP_SERVICE_PAYLOAD='{"script":"function main(){return {ok:true,sum:input.a+input.b};}","entry_point":"main","input":{"a":2,"b":3}}'
        go run scripts/request_miniapp_service.go
        ```

5. **Verify the callback**
    - Check `neorequests` logs for `ServiceRequested` and `fulfillRequest`.
    - Check `txproxy` logs for the callback submission.
    - Query `service_requests` and `chain_txs` in Supabase.
    - Invoke the MiniApp's callback getter method to confirm data was stored.

If the callback does not arrive, verify:

- `TXPROXY_ALLOWLIST` includes `ServiceLayerGateway.fulfillRequest`.
- `ServiceLayerGateway` updater is set to the TEE signer.
- `miniapps.manifest.permissions` includes the requested service.
- `CONTRACT_SERVICE_GATEWAY_ADDRESS` + `NEO_RPC_URL` + `NEO_NETWORK_MAGIC` match the target network.
- `NEOVRF_URL` / `NEOORACLE_URL` / `NEOCOMPUTE_URL` are reachable by `neorequests`.

## Automated Full Workflow (Testnet)

Use the helper script to run **payments**, **governance**, and **service callback**
flows in one sequence.

```bash
./scripts/verify_testnet_workflows.sh --env-file .env --miniapp-address 0x...
```

Required environment variables:

- `NEO_TESTNET_WIF`
- `CONTRACT_PAYMENT_HUB_ADDRESS`
- `CONTRACT_GOVERNANCE_ADDRESS`
- `CONTRACT_SERVICE_GATEWAY_ADDRESS`
- `CONTRACT_APP_REGISTRY_ADDRESS`

You can also set `CONTRACT_MINIAPP_CONSUMER_ADDRESS`
in `.env` instead of passing `--miniapp-address`.

## Automation Workflow (Periodic Tasks with GAS Deposit Pool)

The platform provides a comprehensive automation system for executing periodic tasks
on-chain. The system supports two modes:

1. **Off-Chain Triggers** (Supabase-based): User-managed triggers via NeoFlow API
2. **On-Chain Anchored Tasks** (AutomationAnchor V2): Periodic tasks with GAS deposit pools

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Automation Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │   NeoFlow    │───▶│ AutomationAnchor │───▶│  Target Contract         │  │
│  │   Service    │    │   (On-Chain)     │    │  (MiniApp/Platform)      │  │
│  │   (TEE)      │    │                  │    │                          │  │
│  └──────────────┘    └──────────────────┘    └──────────────────────────┘  │
│         │                     │                                             │
│         │                     │                                             │
│         ▼                     ▼                                             │
│  ┌──────────────┐    ┌──────────────┐                                      │
│  │  Supabase    │    │  GAS Deposit │                                      │
│  │  Triggers    │    │     Pool     │                                      │
│  └──────────────┘    └──────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Periodic Task Registration Flow

#### Step 1: Register Periodic Task

Users register periodic tasks via the AutomationAnchor V2 contract:

```
User Wallet
    │
    ▼
AutomationAnchor.RegisterPeriodicTask(
    target: UInt160,           // Target contract to invoke
    method: string,            // Method name to call
    triggerType: string,       // "cron" or "interval"
    schedule: string,          // Cron expression or interval ("hourly", "daily", "weekly", "monthly")
    gasLimit: BigInteger       // Gas limit per execution
)
    │
    ▼
Returns: taskId (BigInteger)
```

**Trigger Types:**

- **interval**: Fixed time intervals
    - Supported schedules: `"hourly"`, `"daily"`, `"weekly"`, `"monthly"`
    - Interval seconds: 3600, 86400, 604800, 2592000 respectively
- **cron**: Cron expressions (parsed off-chain by NeoFlow)
    - Example: `"0 0 * * *"` (daily at midnight)
    - Example: `"*/15 * * * *"` (every 15 minutes)

#### Step 2: Deposit GAS to Task Pool

After registration, users must deposit GAS to fund task executions:

```
User Wallet
    │
    ▼
GAS.transfer(
    to: AutomationAnchor,
    amount: BigInteger,        // GAS amount in satoshis (1 GAS = 100000000)
    data: taskId               // Task ID as BigInteger
)
    │
    ▼
AutomationAnchor.OnNEP17Payment(from, amount, taskId)
    │
    ▼
Task balance updated
    │
    ▼
Event: TaskDeposited(taskId, from, amount)
```

**Fee Model:**

- Fixed fee: **1 GAS per execution**
- Execution fails if balance < 1 GAS
- Users can deposit any amount to fund multiple executions

#### Step 3: Task Execution by NeoFlow

The NeoFlow service monitors registered tasks and executes them at scheduled intervals:

```
NeoFlow Scheduler (runs every 10 seconds)
    │
    ▼
Check all registered periodic tasks
    │
    ├─▶ Interval tasks: Check if (now - lastExecution) >= intervalSeconds
    ├─▶ Cron tasks: Parse cron expression and check if execution time reached
    └─▶ Price tasks: Check if price condition met (via PriceFeed contract)
    │
    ▼
For each task ready to execute:
    │
    ├─▶ Check task balance >= 1 GAS
    │
    ├─▶ Call AutomationAnchor.ExecutePeriodicTask(taskId, payload)
    │       │
    │       ├─▶ Deduct 1 GAS from task balance
    │       ├─▶ Update lastExecution and nextExecution timestamps
    │       └─▶ Emit: PeriodicTaskExecuted(taskId, fee, remainingBalance)
    │
    └─▶ Target contract method is invoked by platform (off-chain orchestration)
```

### Task Management Operations

#### Pause Task

Temporarily stop task execution without losing balance:

```
AutomationAnchor.PauseTask(taskId)
    │
    ▼
Task marked as paused
    │
    ▼
Event: TaskPaused(taskId)
```

#### Resume Task

Resume a paused task:

```
AutomationAnchor.ResumeTask(taskId)
    │
    ▼
Task marked as active
    │
    ▼
NextExecution recalculated from current time
    │
    ▼
Event: TaskResumed(taskId)
```

#### Withdraw GAS

Withdraw unused GAS from task balance:

```
AutomationAnchor.Withdraw(taskId, amount)
    │
    ▼
Verify: caller is task owner
    │
    ▼
Verify: balance >= amount
    │
    ▼
Transfer GAS to owner
    │
    ▼
Event: TaskWithdrawn(taskId, owner, amount)
```

#### Cancel Task

Cancel task and refund all remaining GAS:

```
AutomationAnchor.CancelPeriodicTask(taskId)
    │
    ▼
Verify: caller is task owner
    │
    ▼
Get remaining balance
    │
    ▼
Delete all task data (schedule, balance, ownership)
    │
    ▼
Refund balance to owner (if > 0)
    │
    ▼
Event: TaskCancelled(taskId, refundAmount)
```

### Error Handling and Edge Cases

#### Insufficient Balance

If task balance < 1 GAS when execution is due:

- NeoFlow logs warning with balance details
- Task execution is skipped
- Task remains registered and will retry on next schedule
- User must deposit more GAS to resume executions

#### Task Execution Failure

If target contract invocation fails:

- NeoFlow logs error with VM state and exception
- GAS fee is still deducted (execution was attempted)
- Task remains active and will retry on next schedule
- User should check target contract logic or cancel task

#### Schedule Drift

For interval tasks:

- Next execution calculated from last successful execution
- If service is down, tasks execute immediately when service resumes
- Cron tasks resync to next valid cron time if drift > 1 minute

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

#### NeoFlow Service

- `NEOFLOW_TASK_IDS`: Comma-separated list of anchored task IDs to monitor
- `CONTRACT_AUTOMATION_ANCHOR_ADDRESS`: AutomationAnchor contract address
- `NEOFLOW_ENABLE_CHAIN_EXEC`: Enable on-chain task execution (default: true)

#### AutomationAnchor Contract

- Admin: Can register V1 tasks and set updater
- Updater: NeoFlow service address (can execute periodic tasks)
- Task Owner: User who registered the task (can pause/resume/cancel/withdraw)

### Best Practices

1. **Fund Tasks Adequately**: Deposit enough GAS for multiple executions (e.g., 30 GAS for 30 days of daily tasks)
2. **Monitor Balance**: Check task balance regularly via `BalanceOf(taskId)`
3. **Test Target Contract**: Ensure target contract method works correctly before registering task
4. **Use Appropriate Intervals**: Choose intervals that match your use case (avoid too frequent executions)
5. **Handle Failures Gracefully**: Target contracts should not revert on expected conditions
6. **Pause Instead of Cancel**: Use pause for temporary stops to avoid re-registration costs

### Example: Daily Reward Distribution

```
1. Register task:
   RegisterPeriodicTask(
     target: 0x...RewardContract,
     method: "distributeDaily",
     triggerType: "interval",
     schedule: "daily",
     gasLimit: 10000000
   )
   → Returns taskId: 1

2. Deposit GAS for 30 days:
   GAS.transfer(AutomationAnchor, 30_00000000, taskId: 1)

3. NeoFlow executes daily:
   - Checks balance (30 GAS available)
   - Calls ExecutePeriodicTask(1, payload)
   - Deducts 1 GAS (29 GAS remaining)
   - Platform invokes RewardContract.distributeDaily()

4. After 30 days:
   - Balance reaches 0
   - Executions stop
   - User deposits more GAS to continue
```
