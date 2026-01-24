# Service API (Draft)

This document describes the intended API surface for the MiniApp platform.
For lifecycle and event flow details, see `docs/WORKFLOWS.md` and
`docs/DATAFLOWS.md`.

## Layers

- **Supabase Edge**: authentication, nonce/replay protection, rate limits, manifest policy enforcement, routing.
- **TEE Services**: trusted execution + key custody + signing + verifiable origin.
- **Neo N3 Contracts**: final authorization, state updates, and public audit trail.

## Edge Endpoints (Gateway)

Supabase deploys Edge functions under:

- `/functions/v1/<function-name>`

The architectural blueprint sometimes describes these as `/api/rpc/<name>`. In
production, Supabase uses `/functions/v1/<name>`. For local development, the
repo’s Edge dev server supports both prefixes. The host app also provides
`/api/rpc/relay` as a blueprint-friendly alias when a single relay endpoint is
preferred (pass `fn` via query or JSON body).

The JS SDK (`platform/sdk`) is expected to set `edgeBaseUrl` to:

- `https://<project>.supabase.co/functions/v1`

Host apps can optionally proxy these via Next.js routes:

- `/api/market/trending` → `market-trending`
- `/api/app/:id/news` → `miniapp-notifications`

Most endpoints require authentication via:

- `Authorization: Bearer <jwt>`, or
- `X-API-Key: <key>`

Exceptions:

- `GET /functions/v1/datafeed-price` is currently a public read proxy (no auth).

Host-only endpoints (oracle/compute/automation/secrets) require **API keys with
explicit scopes** in production; bearer JWTs are rejected there.

Most state-changing endpoints also require a **verified primary wallet binding**
(`wallet-nonce` + `wallet-bind`).

## On-Chain Service Requests (ServiceLayerGateway)

MiniApps that need confidential services can use the on-chain request/callback
pattern instead of calling Edge endpoints directly:

1. MiniApp contract calls `ServiceLayerGateway.RequestService(...)`.
2. Gateway emits `ServiceRequested` event.
3. NeoRequests executes the TEE workflow and prepares the result.
4. NeoRequests submits `ServiceLayerGateway.FulfillRequest(...)` via `tx-proxy`.
5. Gateway calls the MiniApp callback method on-chain.

This flow is recorded in Supabase `contract_events` and `chain_txs`.

When configured, NeoRequests also verifies that the MiniApp is **Approved** in
AppRegistry and that the on-chain `manifest_hash` matches the Supabase record
before executing the request.

Payload formats are defined in `docs/service-request-payloads.md`.

**Callback payload size:** the ServiceLayerGateway `ServiceFulfilled` event
emits the result bytes. Neo limits notifications to 1024 bytes, so NeoRequests
enforces a conservative result size cap (configurable via
`NEOREQUESTS_MAX_RESULT_BYTES`).

### Payments (GAS only)

- `POST /functions/v1/pay-gas`
    - body: `{ app_id: "...", amount_gas: "1.5", chain_id?: "...", memo?: "..." }`
    - returns: a GAS `transfer` invocation to `PaymentHub` (GAS-only) for the wallet/SDK to sign and submit
    - enforces: manifest `permissions.payments` and `limits.max_gas_per_tx` (when present)
    - enforces: `limits.daily_gas_cap_per_user` via `miniapp_usage_bump(...)`
      (or `miniapp_usage_check(...)` when `MINIAPP_USAGE_MODE=check` or
      `MINIAPP_USAGE_MODE_PAYMENTS=check`)

### Governance (NEO only)

- `POST /functions/v1/vote-neo`
    - body: `{ app_id: "...", proposal_id: "...", neo_amount: "10", chain_id?: "...", support?: true }`
    - legacy compatibility: `POST /functions/v1/vote-bneo` and `bneo_amount` are accepted
    - returns: a Governance `vote` invocation (NEO-only) for the wallet/SDK to sign and submit
    - enforces: manifest `permissions.governance` and `limits.governance_cap` (when present)
    - tracks: `limits.governance_cap` via `miniapp_usage_bump(...)` (per-day enforcement)
      or `miniapp_usage_check(...)` when `MINIAPP_USAGE_MODE=check` or
      `MINIAPP_USAGE_MODE_GOVERNANCE=check`

### RNG / VRF

- `POST /functions/v1/rng-request`
    - body: `{ app_id: "...", chain_id?: "..." }`
    - requests randomness from `neovrf` (`/random`) with signature + attestation hash
    - returns: `{ randomness, signature, public_key, attestation_hash }`
    - enforces: manifest `permissions.rng`
    - optional: anchors to `RandomnessLog` via `txproxy` when enabled

### Apps (App Registry)

- `POST /functions/v1/app-register`
    - body: `{ manifest: { ... } }`
    - gateway computes `manifest_hash = sha256(canonical_json(manifest))`
    - enforces: `assets_allowed == ["GAS"]` and `governance_assets_allowed == ["NEO"]`
    - enforces: `contracts.<chain>.address` when news/stats are enabled
    - persists: canonical manifest in Supabase `miniapps` table for runtime enforcement
    - returns: an AppRegistry `registerApp` invocation for the developer wallet to sign and submit
- `POST /functions/v1/app-update-manifest`
    - body: `{ manifest: { ... } }`
    - gateway computes `manifest_hash = sha256(canonical_json(manifest))`
    - enforces: `assets_allowed == ["GAS"]` and `governance_assets_allowed == ["NEO"]`
    - enforces: `contracts.<chain>.address` when news/stats are enabled
    - persists: updated canonical manifest in Supabase `miniapps` table
    - returns: an AppRegistry `updateApp` invocation for the developer wallet to sign and submit

After `registerApp` / `updateApp`, an **admin** must approve or disable the
MiniApp on-chain via `AppRegistry.setStatus`. AppRegistry events mirror back to
Supabase so `miniapps.status` reflects `pending`/`active`/`disabled` and
on-chain metadata (name/icon/category/contracts) stays in sync.

### MiniApp Stats & Notifications (Public Read)

- `GET /functions/v1/miniapp-stats?app_id=...`
    - returns aggregate stats for a single MiniApp
    - when `app_id` is omitted, returns top apps by `total_transactions` (limit 50)
    - includes AppRegistry metadata when available (`name`, `description`, `icon`, `banner`, `category`,
      `contract_address`, `entry_url`) plus manifest fields (`permissions`, `limits`, `news_integration`, `stats_display`)
- `GET /functions/v1/miniapp-notifications?app_id=...&limit=20`
    - returns the most recent notifications (default `limit=20`, max `100`)
    - optional `app_id` to filter by MiniApp
    - requires the emitting contract to match `contracts.<chain>.address` when strict ingestion is enabled

### MiniApp Usage (Authenticated)

- `GET /functions/v1/miniapp-usage?app_id=...&chain_id=...&date=YYYY-MM-DD`
    - returns the caller's daily usage for a single MiniApp
    - `gas_used` / `governance_used` are returned in base units (1e-8 for GAS)
    - when `app_id` is omitted, returns all MiniApp usage rows for the date
    - `date` defaults to today (UTC) when omitted

### Contract Events (Authenticated)

- `GET /functions/v1/events-list?app_id=...&event_name=...&contract_address=...&chain_id=...&limit=...&after_id=...`
    - returns indexed contract events from `contract_events`
    - optional filters:
        - `app_id` (MiniApp identifier)
        - `event_name` (e.g., `Platform_Notification`)
        - `contract_address` (chain-specific contract address/hash)
        - `chain_id` (chain identifier)
    - pagination via `after_id` (numeric, descending order)

### Chain Transactions (Authenticated)

- `GET /functions/v1/transactions-list?app_id=...&chain_id=...&limit=...&after_id=...`
    - returns platform-tracked chain transactions from `chain_txs`
    - `app_id` filters by request ID pattern (used for service callbacks)

### Market Trending

- `GET /functions/v1/market-trending?period=7d&limit=20`
    - `period`: `1d` / `7d` / `30d` (default `7d`)
    - `limit`: `1-50` (default `20`)
    - ranks MiniApps by growth vs rolling average using `miniapp_stats_daily`

### Realtime Notifications

- Supabase Realtime subscribes to `miniapp_notifications` inserts for push UX.
- Clients can filter by `app_id` in memory when needed.

### Wallet Binding

- `POST /functions/v1/wallet-nonce`
    - issues `{ nonce, message }` to be signed by a Neo N3 wallet
- `POST /functions/v1/wallet-bind`
    - body: `{ address, public_key, signature, message, nonce, label? }`
    - verifies wallet ownership and binds the address to the authenticated user

### API Keys

API key management endpoints require `Authorization: Bearer <jwt>` (cannot be called using an API key).

- `POST /functions/v1/api-keys-create`
    - body: `{ name, scopes?: string[], description?: string, expires_at?: string }`
    - returns: the raw key once (never stored in plaintext)
- `GET /functions/v1/api-keys-list`
    - returns: metadata only (no raw key)
- `POST /functions/v1/api-keys-revoke`
    - body: `{ id }`

Scope notes:

- Scopes are optional. If omitted (or empty), the key is treated as full access for that user.
- Recommended convention: set scopes to the Edge function names you want the key to call (e.g. `["pay-gas","rng-request"]`).
- `["*"]` can be used as an explicit “full access” scope.
- Host-only endpoints require **explicit scopes** (non-empty) in production.

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

### GasBank (Delegated Payments)

- `GET /functions/v1/gasbank-account`
    - returns: `{ account }` (creates account row if missing)
- `POST /functions/v1/gasbank-deposit`
    - body: `{ amount, from_address, tx_hash? }`
    - returns: `{ deposit }` (records a deposit request; settlement runs elsewhere)
- `GET /functions/v1/gasbank-deposits`
    - returns: `{ deposits }`
- `GET /functions/v1/gasbank-transactions`
    - returns: `{ transactions }`

### Datafeed

- `GET /functions/v1/datafeed-price?symbol=BTC-USD`
    - read proxy to `neofeeds` (or a future cache)
    - symbols without a quote default to `-USD` (e.g., `BTC` → `BTC-USD`)
- `GET /functions/v1/datafeed-stream?symbol=BTC-USD` (future: SSE/WebSocket proxy)

### Oracle

- `POST /functions/v1/oracle-query`
    - allowlisted HTTP fetch via `neooracle` (`/query`) with optional `secret_name` injection

### Compute

- `POST /functions/v1/compute-execute`
    - host-gated compute via `neocompute` (`/execute`) with optional `secret_refs` injection
- `GET /functions/v1/compute-jobs`
    - lists the authenticated user's recent compute jobs (proxy for `neocompute` `/jobs`)
- `GET /functions/v1/compute-job?id=<job_id>`
    - returns a compute job by id (proxy for `neocompute` `/jobs/{id}`)

### Automation

- `GET /functions/v1/automation-triggers`
    - lists the authenticated user's triggers (proxy for `neoflow` `/triggers`)
- `POST /functions/v1/automation-triggers`
    - creates a trigger (proxy for `neoflow` `/triggers`)
- `GET /functions/v1/automation-trigger?id=<trigger_id>`
    - gets a trigger by id (proxy for `neoflow` `/triggers/{id}`)
- `POST /functions/v1/automation-trigger-update`
    - updates a trigger (proxy for `neoflow` `PUT /triggers/{id}`)
- `POST /functions/v1/automation-trigger-delete`
    - deletes a trigger (proxy for `neoflow` `DELETE /triggers/{id}`)
- `POST /functions/v1/automation-trigger-enable|automation-trigger-disable|automation-trigger-resume`
    - lifecycle controls (proxy for `neoflow` `/triggers/{id}/...`)
- `GET /functions/v1/automation-trigger-executions?id=<trigger_id>&limit=50`
    - lists executions for a trigger (proxy for `neoflow` `/triggers/{id}/executions`)

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

Note: in the current implementation, Supabase-backed triggers execute only `cron`
triggers, and the supported action type is `webhook`.

### `txproxy` (tx-proxy)

- `POST /invoke`: build+sign+broadcast allowlisted transactions.
    - hard rule: **payments only GAS**, **governance only NEO**, contract/method allowlists enforced.
    - optional `intent` field enables stricter gates for `payments` (GAS.transfer to PaymentHub) and `governance` (Governance stake/unstake/vote) when contract addresses are configured.

### `neovrf` (vrf-service)

- `POST /random`: generate verifiable random bytes
    - body: `{ seed?: string, count?: number, range?: { min, max } }`
    - returns: `{ randomness, proof, signature, public_key }`
- `GET /pubkey`: returns the VRF public key for verification

### `neogasbank` (gasbank-service)

- `GET /account`: get user's GAS balance
- `GET /transactions`: list balance transactions
- `GET /deposits`: list deposit history
- `POST /deduct`: deduct fee from balance (internal mTLS)
- `POST /reserve`: reserve balance for pending operation
- `POST /release`: release reserved balance

### `neosimulation` (simulation-service)

Internal service for transaction simulation and load testing. Not exposed via Edge.

- `POST /start`: start simulation run
- `POST /stop`: stop simulation run
- `GET /status`: get simulation status
- `GET /metrics`: get performance metrics

## Service Lifecycle Reference

All TEE services follow a common lifecycle:

1. **Startup**: Load configuration, initialize connections
2. **Health Check**: Respond to `/health` endpoint
3. **Request Processing**: Handle incoming requests
4. **Graceful Shutdown**: Complete pending requests, close connections

### Health Endpoints

All services expose:

- `GET /health`: returns `{ status: "ok" }` when healthy
- `GET /ready`: returns `{ ready: true }` when ready to serve
