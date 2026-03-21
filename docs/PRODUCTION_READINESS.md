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

- `CONTRACT_PAYMENTHUB_HASH`
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
- legacy compatibility only:
  - `NEOFEEDS_URL`
  - `NEOORACLE_URL`
  - `NEOVRF_URL`
  - `NEOCOMPUTE_URL`
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
cd /Users/jinghuiliao/git/neo-miniapps-platform

# Env sanity
npm run validate:miniapp-env -- --stage=prod --json

# Frontend / shared tests
npm test

# Production builds
cd platform/host-app && npm run build
cd ../admin-console && npm run build

# Platform workflow validations
cd ../..
bash deploy/scripts/verify_testnet_workflows.sh --env-file .env --skip-stats-rollup-check

# Preferred direct Oracle / direct AA validation
AA_TEST_WIF=<funded-aa-testnet-wif> \
  bash deploy/scripts/verify_cross_repo_testnet.sh
```

## Interpretation Of Workflow Results

`verify_testnet_workflows.sh` proves different things depending on the current
external environment:

- if request submission succeeds, the platform contracts, wallet wiring, and request payload construction are working
- if callback fulfillment also succeeds, the external Morpheus worker / relayer path is live and correctly integrated
- if callback waits time out, the unresolved area is usually the external Oracle worker / relayer environment, not the local MiniApp platform code

Treat callback timeouts as an integration or environment gap until the external
stack is confirmed healthy.

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
