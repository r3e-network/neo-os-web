# NeoRequests Service

NeoRequests is the on-chain request dispatcher for the MiniApp platform. It
listens to `ServiceLayerGateway.ServiceRequested` events, executes the requested
TEE workflow (NeoVRF / NeoOracle / NeoCompute), and submits
`ServiceLayerGateway.fulfillRequest(...)` via TxProxy.

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

- `CONTRACT_SERVICEGATEWAY_HASH`: ServiceLayerGateway script hash.
- `CONTRACT_APPREGISTRY_HASH`: AppRegistry script hash (optional enforcement).
- `NEOVRF_URL`, `NEOORACLE_URL`, `NEOCOMPUTE_URL`: internal service URLs.
- `NEOREQUESTS_MAX_RESULT_BYTES`: max callback payload size (bytes). Default
  keeps callbacks under the Neo `Notify` 1024-byte limit to avoid on-chain
  failures.
- `NEOREQUESTS_MAX_ERROR_LEN`: max error string length (bytes).
- `NEOREQUESTS_RNG_RESULT_MODE`: `raw` (default) or `json`.
- `NEOREQUESTS_TX_WAIT`: `true` to wait for callback tx confirmation.
- `TXPROXY_TIMEOUT`: timeout for TxProxy invocations (Go duration, e.g. `90s`).
  Set high enough to cover confirmation latency when `NEOREQUESTS_TX_WAIT=true`.
- `NEOREQUESTS_ENFORCE_APPREGISTRY`: `true` to require AppRegistry Approved status
  (defaults to on when AppRegistry hash + chain client are available).
- `NEOREQUESTS_APPREGISTRY_CACHE_SECONDS`: cache TTL for AppRegistry lookups.
