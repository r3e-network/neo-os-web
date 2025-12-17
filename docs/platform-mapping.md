# Platform Mapping (Current Repo → Target MiniApp Platform)

This document maps the current repository structure into the target **Neo N3 MiniApp Platform** layout.

## Target Top-Level

The target structure is:

- `contracts/`: platform contracts (GAS-only payments, NEO-only governance, feeds, randomness logs, app registry, automation anchor)
- `services/`: attested SGX services (datafeed/oracle/compute/automation/tx-proxy)
- `platform/`: Next.js host + SDK + Supabase Edge + RLS policies
- `miniapps/`: builtin + community miniapps
- `infra/`: neo-express config, docker compose, CI helpers
- `docs/`: specs and operational guidance

## Current Repo Modules

### Services (current → target naming)

The repository keeps service IDs (runtime) stable, and maps them to the target
platform naming in docs:

- `services/datafeed` (`neofeeds`) → `datafeed-service`
- `services/conforacle` (`neooracle`) → `oracle-gateway`
- `services/confcompute` (`neocompute`) → `compute-service`
- `services/automation` (`neoflow`) → `automation-service`
- `services/txproxy` (`txproxy`) → `tx-proxy`

### Existing Infrastructure (keep)

- `infrastructure/chain`: Neo N3 RPC, tx building/submission, event monitoring
- `infrastructure/globalsigner`: enclave-held signing keys
- `infrastructure/accountpool`: large account pool + locking
- `infrastructure/secrets`: per-user secrets + permissions

These remain as shared building blocks used by the platform services.

### Platform Layer (Scaffolded)

- `platform/host-app`: Next.js host (Vercel) scaffold with strict CSP starter
- `platform/sdk`: JS SDK scaffold (`window.MiniAppSDK` shape)
- `platform/edge`: Supabase Edge function scaffolds (auth/limits/routing)
- `platform/rls`: Supabase RLS SQL policies (placeholder, see migrations for current SQL)
- `miniapps/`: builtin apps + templates (placeholder)

## Notes

- The user-facing gateway is **Supabase Edge** (there is no Go gateway binary in the current codebase).
- This repo will keep a strong separation: **chain I/O** in `infrastructure/chain`, **policy enforcement** in Edge + tx-proxy, **sensitive compute/signing** inside TEE.
