# Production Readiness (Current)

This document is the **current** production readiness checklist for the Neo
Service Layer as described in `docs/ARCHITECTURE.md`.

## Scope

**Gateway (edge)**:
- Auth (wallet + OAuth), sessions/JWT, API keys, wallet bindings
- Secrets API + permissions (stored in Supabase; not a separate service)
- Delegated payments / gas bank (stored in Supabase)
- Service proxy routes (mTLS inside the mesh)

**Enclave workloads (MarbleRun + EGo)**:
- Infrastructure marbles: `infrastructure/accountpool`, `infrastructure/globalsigner`
- Product services: `services/datafeed`, `services/automation`, `services/confcompute`, `services/conforacle`

## Required External Dependencies

- **Supabase** (Postgres + PostgREST): migrations applied, service role key available.
- **Neo N3 RPC**: one or more reliable endpoints configured.
- **Deployed contracts**: MiniApp platform contracts deployed and hashes set (`PaymentHub`, `Governance`, `PriceFeed`, `RandomnessLog`, `AppRegistry`, `AutomationAnchor`).

## Required Secrets / Config

### Gateway (recommended outside TEE)

- `JWT_SECRET` (>= 32 bytes recommended)
- `SECRETS_MASTER_KEY` (hex-encoded 32 bytes)
- `OAUTH_TOKENS_MASTER_KEY` (hex-encoded 32 bytes) when OAuth is enabled
- OAuth provider secrets (Google/GitHub/etc) if enabled

### Enclave Workloads

Injected via MarbleRun secrets (values depend on which services you run):

- `POOL_MASTER_KEY` (+ `POOL_MASTER_KEY_HASH` in enclave mode) for AccountPool
- `GLOBALSIGNER_MASTER_SEED` for GlobalSigner
- `NEOFEEDS_SIGNING_KEY` for Datafeeds
- `COMPUTE_MASTER_KEY` for Confidential Compute
- `TEE_PRIVATE_KEY` if you enable on-chain fulfillments/callback tx submission

## Chain / Contract Configuration

Contract hashes are configured via environment variables (0x-prefixed Uint160 strings):

- `CONTRACT_PAYMENTHUB_HASH` (**payments/settlement = GAS only**, enforced on-chain)
- `CONTRACT_GOVERNANCE_HASH` (**governance = NEO only**, enforced on-chain)
- `CONTRACT_PRICEFEED_HASH` (datafeed anchoring)
- `CONTRACT_RANDOMNESSLOG_HASH` (optional randomness anchoring)
- `CONTRACT_APPREGISTRY_HASH` (app allowlist + manifest hashes)
- `CONTRACT_AUTOMATIONANCHOR_HASH` (automation task registry + anti-replay)

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
