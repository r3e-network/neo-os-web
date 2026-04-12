# Production Readiness

This checklist covers the **MiniApp platform repo**.

It assumes the Oracle / DataFeed / VRF / Compute / Paymaster / AA runtimes are
provided externally by:

- `neo-morpheus-oracle`
- `neo-abstract-account`

## Scope

In-scope for this repo:

- host app
- admin console
- edge functions
- platform contracts
- MiniApp contracts
- deploy / validation helpers
- integration config and runtime wiring

Out-of-scope for this repo:

- operating the Morpheus worker / relayer / paymaster runtime
- operating the AA relay runtime
- proving enclave measurements for the external repos

## Required External Dependencies

- Supabase project with required migrations applied
- Neo N3 RPC endpoint
- external Morpheus runtime/public URLs:
  - `MORPHEUS_RUNTIME_URL` preferred
  - `MORPHEUS_RUNTIME_TOKEN` or `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`
  - `MORPHEUS_PUBLIC_API_URL`
  - `MORPHEUS_EDGE_URL`
  - `MORPHEUS_CONTROL_PLANE_URL`
  - `TXPROXY_URL`
- optional external AA / paymaster URLs:
  - `AA_RELAY_URL`
  - `AA_PAYMASTER_ENDPOINT` or `MORPHEUS_PAYMASTER_*`

## Required Platform Env

### Core

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_EDGE_URL`
- `NEO_RPC_URL`
- `NEO_NETWORK_MAGIC`

### Platform Contracts

- `CONTRACT_GOVERNANCE_HASH`
- `CONTRACT_PRICEFEED_HASH`
- `CONTRACT_RANDOMNESSLOG_HASH`
- `CONTRACT_APPREGISTRY_HASH`
- `CONTRACT_AUTOMATIONANCHOR_HASH`
- `CONTRACT_SERVICEGATEWAY_HASH`
- `CONTRACT_MINIAPP_CONSUMER_HASH` or `MINIAPP_CALLBACK_CONTRACT_HASH` for workflow validation

### External Service Wiring

- `MORPHEUS_RUNTIME_URL` preferred
- `MORPHEUS_RUNTIME_TOKEN` or `PHALA_API_TOKEN` / `PHALA_SHARED_SECRET`
- `MORPHEUS_PUBLIC_API_URL`
- `MORPHEUS_EDGE_URL`
- `MORPHEUS_CONTROL_PLANE_URL`
- `TXPROXY_URL`
- `GLOBALSIGNER_SERVICE_URL` when health checks should include signer availability
- `AA_RELAY_URL` when host `/api/aa/relay` should be enabled

## Contract / Domain Consistency

Before marking a release as ready, verify that:

- frontend shared config matches upstream mainnet / testnet anchors
- README and docs match the same canonical hashes
- testnet platform contracts in `.env` match the currently deployed platform contracts
- mainnet AA / Morpheus domains point to the intended external contracts

Primary shared registry in this repo:

- `apps/shared/constants/rpc.ts`

## Validation Commands

```bash
cd <repo-root>

# Env sanity
npm run validate:miniapp-env -- --stage=prod --json

# Frontend / shared tests
npm test

# Production builds
cd platform/host-app && npm run build
cd ../admin-console && npm run build

# Preferred direct Oracle / direct AA validation
cd ../..
AA_TEST_WIF=<funded-aa-testnet-wif> \
  bash deploy/scripts/verify_cross_repo_testnet.sh
```

## Interpretation Of Workflow Results

Treat failures in `verify_cross_repo_testnet.sh` as either:

- local platform wiring problems, if request construction or relay preparation fails early
- external integration problems, if Oracle / AA callbacks time out after request submission

## Release Gate

A platform release is ready when all of the following are true:

- env validation passes
- `npm test` passes
- host and admin builds pass
- canonical external AA / Morpheus config is aligned in code and docs
- direct Oracle testnet callback path is proven healthy
- direct AA paymaster + relay path is proven healthy
- wallet-signed flows still work
- testnet workflow script can at minimum submit requests successfully
- any callback failures are either fixed or explicitly attributed to an external environment outage
