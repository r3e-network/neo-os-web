# Production Readiness (Current)

This document is the **current** production readiness checklist for the Neo
Service Layer as described in `docs/ARCHITECTURE.md`.

## Scope

**Gateway (edge)**:
- Auth (Supabase Auth: OAuth providers), sessions/JWT, API keys, wallet bindings
- Secrets API + permissions (stored in Supabase; not a separate service)
- Delegated payments / gas bank (stored in Supabase)
- Service proxy routes (mTLS inside the mesh)

**Enclave workloads (MarbleRun + EGo)**:
- Infrastructure marbles: `infrastructure/accountpool`, `infrastructure/globalsigner`
- Product services: `services/datafeed`, `services/automation`, `services/confcompute`, `services/conforacle`, `services/txproxy`

## Required External Dependencies

- **Supabase** (Postgres + PostgREST): migrations applied, service role key available.
- **Neo N3 RPC**: one or more reliable endpoints configured.
- **Deployed contracts**: MiniApp platform contracts deployed and hashes set (`PaymentHub`, `Governance`, `PriceFeed`, `RandomnessLog`, `AppRegistry`, `AutomationAnchor`).

## Required Secrets / Config

### Gateway (recommended outside TEE)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (Edge validates `Authorization: Bearer <jwt>`)
- `SUPABASE_SERVICE_ROLE_KEY` (Edge reads/writes `public.*` platform tables)
- `SECRETS_MASTER_KEY` (hex-encoded 32 bytes)
- Host-only endpoints (oracle/compute/automation/secrets) require API keys with explicit scopes in production
- `rate_limit_bump(...)` RPC available in Postgres (see `migrations/024_rate_limit_bump.sql`) if you enable gateway rate limiting in production
- `miniapps` table available (see `migrations/025_miniapps.sql`) for manifest/limit enforcement
- `miniapp_usage` table + `miniapp_usage_bump(...)` RPC available (see `migrations/026_miniapp_usage.sql`) for daily cap enforcement
  (`miniapp_usage_check(...)` also available when using `MINIAPP_USAGE_MODE=check`)
- `TEE_MTLS_CERT_PEM`, `TEE_MTLS_KEY_PEM`, `TEE_MTLS_ROOT_CA_PEM` for Edge → TEE mTLS (required in production; Edge rejects non-HTTPS TEE URLs)

### Enclave Workloads

Injected via MarbleRun secrets (values depend on which services you run):

- `POOL_MASTER_KEY` (+ `POOL_MASTER_KEY_HASH` in enclave mode) for AccountPool
- `GLOBALSIGNER_MASTER_SEED` for GlobalSigner
- `NEOFEEDS_SIGNING_KEY` for Datafeeds
- `COMPUTE_MASTER_KEY` for Confidential Compute
- `GASBANK_DEPOSIT_ADDRESS` (public) for GasBank deposit verification
- `TEE_PRIVATE_KEY` (fallback only) if `txproxy` cannot use GlobalSigner and must sign/broadcast directly
- NeoRequests limits + enforcement (recommended in production):
  `NEOREQUESTS_MAX_RESULT_BYTES`, `NEOREQUESTS_MAX_ERROR_LEN`,
  `NEOREQUESTS_RNG_RESULT_MODE`, `NEOREQUESTS_TX_WAIT`, `TXPROXY_TIMEOUT`,
  `NEOREQUESTS_ENFORCE_APPREGISTRY`, `NEOREQUESTS_APPREGISTRY_CACHE_SECONDS`,
  `NEOREQUESTS_REQUIRE_MANIFEST_CONTRACT`, `NEO_EVENT_CONFIRMATIONS`,
  `NEO_EVENT_BACKFILL_BLOCKS`

## Chain / Contract Configuration

Contract addresses are configured via environment variables (0x-prefixed Uint160 strings):

- `CONTRACT_PAYMENT_HUB_ADDRESS` (**payments/settlement = GAS only**, enforced on-chain)
- `CONTRACT_GOVERNANCE_ADDRESS` (**governance = NEO only**, enforced on-chain)
- `CONTRACT_PRICE_FEED_ADDRESS` (datafeed anchoring)
- `CONTRACT_RANDOMNESS_LOG_ADDRESS` (optional randomness anchoring)
- `CONTRACT_APP_REGISTRY_ADDRESS` (app allowlist + manifest hashes)
- `CONTRACT_AUTOMATION_ANCHOR_ADDRESS` (automation task registry + anti-replay)
- `CONTRACT_SERVICE_GATEWAY_ADDRESS` (on-chain service requests + callbacks)

Make sure these addresses match the active network. For mainnet, use the
addresses from `deploy/config/mainnet_contracts.json` (testnet uses
`deploy/config/testnet_contracts.json`).

The gateway for user workflows is **Supabase Edge** (there is no on-chain
gateway contract in the current blueprint).

## Identity / Trust Boundary

- **Production should run in strict identity mode** (MarbleRun TLS injected).
- Public clients must not be able to spoof identity headers.
- Gateway is the trust boundary: it authenticates users and forwards derived
  identity into the mesh over mTLS.

## Validation Commands

```bash
go test ./...
go vet ./...
```

Local simulation:

```bash
make docker-up
```
