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
- NeoFeeds publish policy (recommended explicit values):
  `NEOFEEDS_UPDATE_INTERVAL`, `NEOFEEDS_PUBLISH_THRESHOLD_BPS`,
  `NEOFEEDS_PUBLISH_HYSTERESIS_BPS`, `NEOFEEDS_PUBLISH_MIN_INTERVAL`,
  `NEOFEEDS_PUBLISH_MAX_PER_MINUTE`, `NEOFEEDS_PUBLISH_HEARTBEAT_INTERVAL`

### Enclave Image Signing Key (SGX Production)

- `EGO_PRIVATE_KEY_FILE` must point to a valid enclave signing key.
- Required key properties:
  - RSA private key
  - 3072-bit modulus
  - public exponent `3`
- Validate before SGX image builds:

```bash
set -a; source .env; set +a
./scripts/check_enclave_signing_key.sh --key "$EGO_PRIVATE_KEY_FILE"
```

## Chain / Contract Configuration

Contract hashes are configured via environment variables (0x-prefixed Uint160 strings):

- `CONTRACT_PAYMENTHUB_HASH` (**payments/settlement = GAS only**, enforced on-chain)
- `CONTRACT_GOVERNANCE_HASH` (**governance = NEO only**, enforced on-chain)
- `CONTRACT_PRICEFEED_HASH` (datafeed anchoring)
- `CONTRACT_RANDOMNESSLOG_HASH` (optional randomness anchoring)
- `CONTRACT_APPREGISTRY_HASH` (app allowlist + manifest hashes)
- `CONTRACT_AUTOMATIONANCHOR_HASH` (automation task registry + anti-replay)
- `CONTRACT_SERVICEGATEWAY_HASH` (on-chain service requests + callbacks)

The gateway for user workflows is **Supabase Edge** (there is no on-chain
gateway contract in the current blueprint).

Current testnet values (from `.env`, validated on **February 26, 2026**):

- `CONTRACT_PAYMENTHUB_HASH=0x340cb33d770b38f26d066716dd1f9df5283d629e`
- `CONTRACT_GOVERNANCE_HASH=0x2ec930202e6d03313d97198259b298cc3c29295e`
- `CONTRACT_PRICEFEED_HASH=0x5284ef25f1bbbf36d139f6f94356e46b89138602`
- `CONTRACT_RANDOMNESSLOG_HASH=0xa24f83dcbafff909d4209ac76ca5d09237c0cda6`
- `CONTRACT_APPREGISTRY_HASH=0x9ceaabb583a9261b34380a9df2d32a75c1c04a3d`
- `CONTRACT_AUTOMATIONANCHOR_HASH=0xa016f7be94ad7c4d87ad2f8d38784797c2dc494b`
- `CONTRACT_SERVICEGATEWAY_HASH=0x194fcb975c47952c5a030e89946a5907b33efd23`

## Identity / Trust Boundary

- **Production should run in strict identity mode** (MarbleRun TLS injected).
- Public clients must not be able to spoof identity headers.
- Gateway is the trust boundary: it authenticates users and forwards derived
  identity into the mesh over mTLS.

## Validation Commands

```bash
set -a; source .env; set +a

go test ./...
go vet ./...
./scripts/production_readiness_check.sh
./scripts/verify_testnet_workflows.sh --env-file .env

env PRICEFEED_WATCH_SYMBOLS='NEO-USD,GAS-USD,USDT-USD,USDC-USD,BTC-USD,ETH-USD,XRP-USD,BNB-USD,SOL-USD,TRX-USD,DOGE-USD,XAU-USD,XAG-USD,NVDA-USD,AAPL-USD,GOOGL-USD,MSFT-USD,META-USD,TSM-USD,TSLA-USD,TCEHY-USD' \
  PRICEFEED_WATCH_MAX_STALENESS='24h' \
  go run -tags=scripts scripts/check_pricefeed_freshness.go
```

Local simulation:

```bash
make docker-up
```
