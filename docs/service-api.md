# Service API (Draft)

This document describes the intended API surface for the MiniApp platform.

## Layers

- **Supabase Edge**: authentication, nonce/replay protection, rate limits, manifest policy enforcement, routing.
- **TEE Services**: trusted execution + key custody + signing + verifiable origin.
- **Neo N3 Contracts**: final authorization, state updates, and public audit trail.

## Edge Endpoints (Gateway)

Supabase deploys Edge functions under:

- `/functions/v1/<function-name>`

The JS SDK (`platform/sdk`) is expected to set `edgeBaseUrl` to:

- `https://<project>.supabase.co/functions/v1`

All endpoints require either:

- Supabase session (cookie), or
- `Authorization: Bearer <jwt>`, or
- `X-API-Key: <key>`

### Payments (GAS only)

- `POST /functions/v1/pay-gas`
  - body: `{ app_id: "...", amount_gas: "1.5", memo?: "..." }`
  - returns: a PaymentHub `Pay` invocation (GAS-only) for the wallet/SDK to sign and submit

### Governance (NEO only)

- `POST /functions/v1/vote-neo`
  - body: `{ app_id: "...", proposal_id: "...", neo_amount: "10", support?: true }`
  - returns: a Governance `Vote` invocation (NEO-only) for the wallet/SDK to sign and submit

### RNG / VRF

- `POST /functions/v1/rng-request`
  - body: `{ app_id: "..." }`
  - executes a randomness script in `neocompute` (no dedicated VRF service)
  - optional: anchors to `RandomnessLog` via `txproxy` when enabled

### Wallet Binding

- `POST /functions/v1/wallet-nonce`
  - issues `{ nonce, message }` to be signed by a Neo N3 wallet
- `POST /functions/v1/wallet-bind`
  - body: `{ address, public_key, signature, message, nonce, label? }`
  - verifies wallet ownership and binds the address to the authenticated user

### Secrets

These endpoints manage user secrets stored in Supabase:

- `GET /functions/v1/secrets-list`
  - returns secret metadata (no values)
- `GET /functions/v1/secrets-get?name=...`
  - returns `{ name, value, version }` (decrypted in Edge using `SECRETS_MASTER_KEY`)
- `POST /functions/v1/secrets-upsert`
  - body: `{ name, value }`
- `POST /functions/v1/secrets-delete`
  - body: `{ name }`
- `POST /functions/v1/secrets-permissions`
  - body: `{ name, services: ["neocompute","neooracle"] }`

### Datafeed

- `GET /functions/v1/datafeed-price?symbol=BTC-USD`
  - read proxy to `neofeeds` (or a future cache)
- `GET /functions/v1/datafeed-stream?symbol=BTC-USD` (future: SSE/WebSocket proxy)

## TEE Service Endpoints

This repo uses stable **service IDs** (runtime) and maps them to the target
platform naming in docs:

- `neofeeds` → datafeed-service
- `neooracle` → oracle-gateway
- `neocompute` → compute-service
- `neoflow` → automation-service
- `txproxy` → tx-proxy

### `neofeeds` (datafeed-service)

- `GET /price/{pair}`: signed price for a pair (canonical: `BTC-USD`; legacy `BTC/USD` accepted)
- `GET /prices`: signed prices (bulk)
- `GET /feeds`, `GET /sources`, `GET /config`: configuration inspection

### `neooracle` (oracle-gateway)

- `POST /query`: allowlisted HTTP fetch + optional secret injection
- `POST /fetch`: alias (backward compatible)

### `neocompute` (compute-service)

- `POST /execute`: run restricted script/wasm with optional secret injection.
- `GET /jobs`, `GET /jobs/{id}`: job inspection

### `neoflow` (automation-service)

- `GET/POST /triggers`: manage triggers
- `POST /triggers/{id}/enable|disable|resume`: control lifecycle
- `GET /triggers/{id}/executions`: audit

### `txproxy` (tx-proxy)

- `POST /invoke`: build+sign+broadcast allowlisted transactions.
  - hard rule: **payments only GAS**, **governance only NEO**, contract/method allowlists enforced.
  - optional `intent` field enables stricter gates for `payments` (PaymentHub.Pay) and `governance` (Governance Stake/Unstake/Vote) when contract hashes are configured.
