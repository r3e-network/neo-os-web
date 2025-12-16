# Service API (Draft)

This document describes the intended API surface for the MiniApp platform.

## Layers

- **Supabase Edge**: authentication, nonce/replay protection, rate limits, manifest policy enforcement, routing.
- **TEE Services**: trusted execution + key custody + signing + verifiable origin.
- **Neo N3 Contracts**: final authorization, state updates, and public audit trail.

## Edge Endpoints (Gateway)

All endpoints require either:

- Supabase session (cookie), or
- `Authorization: Bearer <jwt>`, or
- `X-API-Key: <key>`

### Payments (GAS only)

- `POST /v1/apps/{appId}/pay`
  - body: `{ amount_gas: "1.5", memo?: "..." }`

### Governance (NEO only)

- `POST /v1/apps/{appId}/governance/vote`
  - body: `{ proposal_id: "...", neo_amount: "10", memo?: "..." }`

### RNG / VRF

- `POST /v1/apps/{appId}/rng/request`
  - body: `{ mode?: "vrf"|"rng" }`

### Datafeed

- `GET /v1/datafeed/price/{symbol}`
- `GET /v1/datafeed/stream/{symbol}` (SSE/WebSocket proxy)

## TEE Service Endpoints

### `datafeed-service`

- `POST /push` (internal): publish updates to chain if threshold rules pass.
- `GET /price/{symbol}` (optional): direct read (signed response).

### `oracle-gateway`

- `POST /fetch`: allowlisted HTTP fetch + parsing + signature.

### `vrf-service`

- `POST /random`: returns `(randomness, attestation/report hash, signature)`.

### `compute-service`

- `POST /execute`: run restricted script/wasm with optional secret injection.

### `automation-service`

- `POST /tasks`: register task (writes `AutomationAnchor`).
- `POST /tick`: internal scheduler loop.

### `tx-proxy`

- `POST /invoke`: build+sign+broadcast allowlisted transactions.
  - hard rule: **payments only GAS**, **governance only NEO**, contract/method allowlists enforced.

