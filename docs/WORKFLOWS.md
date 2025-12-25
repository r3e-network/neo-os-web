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
   - Edge canonicalizes the manifest, enforces **GAS-only / NEO-only**, and
     returns an `AppRegistry` invocation for the developer wallet to sign.
3. **On-Chain Registry Approval**
   - Developer wallet signs and submits the `AppRegistry.register` (or
     `updateManifest`) invocation.
   - Platform admin sets the AppRegistry status to `Approved` (or `Disabled`)
     after verification.
4. **Publish**
   - Upload the bundle to CDN.
   - Host app reads registry + manifest metadata from Supabase.
5. **Runtime Access**
   - Users authenticate via Supabase Auth.
   - Users bind a Neo N3 wallet via `wallet-nonce` + `wallet-bind`.
   - SDK calls Edge functions or on-chain ServiceLayerGateway for services.

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
     - app status is active
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

## Off-Chain (Gateway) Workflows

### Payments (GAS only)

1. SDK calls `pay-gas` Edge function.
2. Edge validates:
   - manifest permissions (`payments`)
   - `assets_allowed == ["GAS"]`
   - per-user daily caps
3. Edge returns a `PaymentHub.pay` invocation.
4. Wallet signs and broadcasts to the network.

### Governance (NEO only)

1. SDK calls `vote-neo`.
2. Edge validates:
   - manifest permissions (`governance`)
   - `governance_assets_allowed == ["NEO"]`
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

Use these scripts to validate GAS payments and NEO governance flows on testnet.

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
# Stake + vote with a small NEO amount
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

1. **Deploy the sample MiniApp callback contract**
   - Build artifacts are expected in `contracts/build/`.
   - If missing, run: `./contracts/build.sh`.
   - Run:
     ```bash
     # deploy MiniAppServiceConsumer and set its gateway
     go run scripts/deploy_miniapp_consumer.go
     ```
   - Record the deployed contract hash printed by the script.
2. **Seed Supabase `miniapps`**
   - Insert a manifest row with:
     - `app_id` matching the request (e.g., `com.test.consumer`).
     - `permissions.rng=true` (or `oracle` / `compute`).
     - `callback_contract` set to the deployed MiniApp contract hash.
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
     # set the MiniApp contract hash from step 1
     export MINIAPP_CONSUMER_HASH=0x...
     # wait for the callback to land in the MiniApp contract
     export MINIAPP_WAIT_CALLBACK=true
     # optional: override callback wait timeout (default 180s)
     export MINIAPP_CALLBACK_TIMEOUT_SECONDS=240
     # calls MiniAppServiceConsumer.requestRng(app_id)
     go run scripts/request_miniapp_rng.go
     ```
   - For Oracle / Compute:
     ```bash
     export MINIAPP_CONSUMER_HASH=0x...
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
   - Invoke `MiniAppServiceConsumer.getLastCallback` to confirm it was stored.

If the callback does not arrive, verify:
- `TXPROXY_ALLOWLIST` includes `ServiceLayerGateway.fulfillRequest`.
- `ServiceLayerGateway` updater is set to the TEE signer.
- `miniapps.manifest.permissions` includes the requested service.
- `CONTRACT_SERVICEGATEWAY_HASH` + `NEO_RPC_URL` + `NEO_NETWORK_MAGIC` match the target network.
- `NEOVRF_URL` / `NEOORACLE_URL` / `NEOCOMPUTE_URL` are reachable by `neorequests`.

## Automated Full Workflow (Testnet)

Use the helper script to run **payments**, **governance**, and **service callback**
flows in one sequence.

```bash
./scripts/verify_testnet_workflows.sh --env-file .env --miniapp-hash 0x...
```

Required environment variables:
- `NEO_TESTNET_WIF`
- `CONTRACT_PAYMENTHUB_HASH`
- `CONTRACT_GOVERNANCE_HASH`
- `CONTRACT_SERVICEGATEWAY_HASH`
- `CONTRACT_APPREGISTRY_HASH`

You can also set `CONTRACT_MINIAPP_CONSUMER_HASH` or `MINIAPP_CONTRACT_HASH`
in `.env` instead of passing `--miniapp-hash`.
