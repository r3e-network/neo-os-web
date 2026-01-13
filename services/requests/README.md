# NeoRequests Service

NeoRequests is the on-chain request dispatcher for the MiniApp platform. It
listens to `ServiceLayerGateway.ServiceRequested` events, executes the requested
TEE workflow (NeoVRF / NeoOracle / NeoCompute), and submits
`ServiceLayerGateway.fulfillRequest(...)` via TxProxy.
It also ingests `PaymentHub.PaymentReceived` to attribute usage to bound wallets
and feed MiniApp analytics rollups.
AppRegistry lifecycle events are mirrored back into Supabase so `miniapps.status`
tracks on-chain `Pending`/`Approved`/`Disabled` states.

## Flow

1. MiniApp contract calls `ServiceLayerGateway.requestService(...)`.
2. NeoRequests listens for `ServiceRequested` events.
3. NeoRequests calls the appropriate enclave service:
   - `neovrf` (`/random`)
   - `neooracle` (`/query`)
   - `neocompute` (`/execute`)
4. NeoRequests submits `fulfillRequest` via TxProxy.
5. `ServiceLayerGateway` dispatches the callback to the MiniApp contract.

## Environment

- `CONTRACT_SERVICE_GATEWAY_ADDRESS`: ServiceLayerGateway contract address.
- `CONTRACT_APP_REGISTRY_ADDRESS`: AppRegistry contract address (optional enforcement).
- `CONTRACT_PAYMENT_HUB_ADDRESS`: PaymentHub contract address (validates `PaymentReceived` events).
- `NEOVRF_URL`, `NEOORACLE_URL`, `NEOCOMPUTE_URL`: internal service URLs.
- `NEOREQUESTS_MAX_RESULT_BYTES`: max callback payload size (bytes). Default
  keeps callbacks under the Neo `Notify` 1024-byte limit to avoid on-chain
  failures.
- `NEOREQUESTS_MAX_ERROR_LEN`: max error string length (bytes).
- `NEOREQUESTS_RNG_RESULT_MODE`: `raw` (default) or `json`.
- `NEOREQUESTS_TX_WAIT`: `true` to wait for callback tx confirmation.
- `NEOREQUESTS_ONCHAIN_USAGE`: `true` to bump MiniApp usage stats from
  `PaymentReceived` events (default false to avoid double counting with Edge).
  Pair with `MINIAPP_USAGE_MODE_PAYMENTS=check` in Edge to enforce caps without
  recording usage pre-transaction (leave governance in record mode).
- `NEOREQUESTS_TX_USAGE`: `true` to log MiniApp tx activity from `System.Contract.Call`
  scans (with event-based fallback; default true). This feeds `miniapp_tx_events`
  and drives tx_count/active_users in `miniapp_stats` rollups.
- `TXPROXY_TIMEOUT`: timeout for TxProxy invocations (Go duration, e.g. `90s`).
  Set high enough to cover confirmation latency when `NEOREQUESTS_TX_WAIT=true`.
- `NEOREQUESTS_ENFORCE_APPREGISTRY`: `true` to require AppRegistry Approved status
  (defaults to on when AppRegistry hash + chain client are available).
- `NEOREQUESTS_APPREGISTRY_CACHE_SECONDS`: cache TTL for AppRegistry + MiniApp
  registry lookups (contract address → app_id).
- `NEO_EVENT_LISTEN_ALL`: `true` to listen to all contract notifications for indexing
  (required to capture `Platform_Notification` / `Platform_Metric` from MiniApps).
  Defaults to `true` for `neorequests` when unset.
- `NEO_EVENT_CONFIRMATIONS`: number of block confirmations to wait before indexing
  (default `0`).
- `NEO_EVENT_BACKFILL_BLOCKS`: number of blocks to rewind when resuming from the
  latest processed cursor (default `0`).
- `NEOREQUESTS_REQUIRE_MANIFEST_CONTRACT`: `true` to require
  `manifest.contracts.<chain>.address` for MiniApp event ingestion and tx tracking
  (defaults to `true`).
- `NEOREQUESTS_STATS_ROLLUP_INTERVAL`: how often to recompute `miniapp_stats` and
  `miniapp_stats_daily` from `miniapp_usage` (Go duration, default `30m`).
