# Service Layer Architecture

This document describes the **current** architecture of the Neo Service Layer.
For a quick map of directory responsibilities, see `docs/LAYERING.md`.
For end-to-end flow details, see `docs/WORKFLOWS.md` and `docs/DATAFLOWS.md`.

## Goals

- **Clean layering**: one module = one responsibility.
- **Minimal TEE surface**: only sensitive computation + signing runs in enclaves.
- **No duplicated chain I/O**: Neo RPC, tx building, and event monitoring live in one place.
- **Consistent service shape**: same patterns for config, routing, storage, and workers.

## Core Constraints

- **Settlement**: GAS only (PaymentHub rejects all other assets).
- **Governance**: NEO only (Governance rejects all other assets).
- **Confidentiality**: MarbleRun + EGo enclaves for sensitive services.
- **Gateway**: Supabase Edge Functions (Auth + routing + RLS).
- **Dev stack**: k3s + local Supabase for development.

## High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               DAPPS / FRONTEND                               │
│                           (Vercel / browsers / CLI)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  GATEWAY                                     │
│     Supabase Edge Functions (“thin gateway”): auth, wallet binding, routing, │
│           rate limits, nonce/replay protection, secrets API (RLS)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ mTLS (mesh, optional)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARBLERUN COORDINATOR                              │
│         Attestation, topology verification, mTLS certs, secret injection     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │ mTLS (MarbleRun-issued)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENCLAVE WORKLOADS                                │
│                                                                             │
│  Infrastructure marbles:                                                    │
│   - GlobalSigner  (TEE-managed domain-separated signing + rotation)         │
│   - NeoAccounts   (account pool management + rotation)                      │
│                                                                             │
│  Product services:                                                          │
│   - NeoFeeds    (data feeds)                                                │
│   - NeoFlow     (automation)                                                │
│   - NeoCompute  (confidential compute)                                      │
│   - NeoOracle   (confidential oracle)                                       │
│   - NeoRequests (on-chain request dispatcher + callbacks)                   │
│   - TxProxy     (allowlisted tx signing/broadcast)                           │
│   - NeoGasBank  (GAS deposits + fee deduction, optional)                    │
│   - NeoSimulation (dev/test transaction simulator, optional)                │
│   - Randomness  (via NeoCompute scripts, optional on-chain anchoring)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   SUPABASE                                   │
│     Auth metadata + sessions + secrets + service state (Postgres + RLS)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  NEO N3 CHAIN                                │
│   MiniApp platform contracts + ServiceLayerGateway (requests + callbacks)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layering (Code)

The repo is split into:

- `infrastructure/`: shared building blocks (runtime, middleware, storage, chain I/O, secrets, signing).
- `services/`: product services only (`datafeed`, `automation`, `confcompute`, `conforacle`, `vrf`, `requests`, `txproxy`, `gasbank`, `simulation`).
- `cmd/`: binaries (`cmd/marble`, deployment tooling, bundle verification helpers).
- `platform/`: Supabase Edge gateway + host app + SDK.

See `docs/LAYERING.md` for the concrete mapping.

## Identity & User Workflow (Outside the Enclave)

User-facing workflow lives **outside the enclave** and can run directly on Vercel/Supabase:

- **Auth**: Supabase Auth (OAuth providers: Google/GitHub/etc.).
- **Wallet binding**: users bind a Neo N3 address after OAuth registration (Edge nonce + signature verification).
- **Sessions**: Supabase JWT/cookie sessions (Edge validates).
- **Secrets UX**: users create secrets and manage which internal services may read them.

Enclave services should not implement login/registration flows.

### Strict Identity Mode

In production/SGX mode, internal services only trust identity headers over verified
mTLS. This is enforced by `infrastructure/runtime.StrictIdentityMode()` and
`infrastructure/middleware`.

## Secrets (Gateway + Supabase, Not a Separate Service)

User secrets are stored in Supabase, encrypted with `SECRETS_MASTER_KEY`.

- **Write path**: Supabase Edge functions under `/functions/v1/secrets-*`.
- **Encryption + policy**: `infrastructure/secrets.Manager` (Go) and `platform/edge/functions/_shared/secrets.ts` (Deno), using compatible AES‑GCM envelopes.
- **Storage**: `infrastructure/secrets/supabase`.

### Service Access (Secret Injection)

Enclave services do not implement user-facing secret workflows. They receive a
`secrets.Provider` implementation (injected by `cmd/marble`) that enforces:

- per-user ownership
- per-secret allowed services (permissions)
- audit logging

Compute and oracle support secret injection via request fields (`secret_refs`,
`secret_name`).

## Chain Module (Single Source of Truth)

All Neo chain communication belongs to `infrastructure/chain`:

- RPC client + pooling
- transaction building + signing helpers
- event monitoring/listeners
- shared contract parsing helpers

Contract wrappers and typed event parsing also live in `infrastructure/chain`
(`contracts_*.go`, `listener_events_*.go`) to keep services free of duplicated
chain bindings. This includes the **ServiceLayerGateway** request/callback
events used by NeoRequests.

State-changing on-chain writes are centralized behind `services/txproxy`, which
uses `infrastructure/chain` for tx building/broadcast and enforces an explicit
contract+method allowlist. Other services should only use `infrastructure/chain`
for **read-only** calls and event monitoring.

TxProxy clients use a configurable request timeout (`TXPROXY_TIMEOUT`) to
accommodate on-chain confirmation waits (e.g., NeoRequests callbacks or
anchored automation tasks).

## Platform Indexer & Analytics (Non-TEE)

The platform engine maintains the **news + stats** layer for MiniApps:

- **Ingestion:** consumes AppRegistry + MiniApp events and scans `System.Contract.Call`
  activity using `infrastructure/chain`.
- **Validation:** rejects MiniApp events that do not match the on-chain `contracts.<chain>.address` when strict ingestion is enabled.
- **Idempotency:** uses `processed_events` to avoid double-processing.
- **Rollups:** writes `miniapp_tx_events`, `miniapp_stats`, `miniapp_stats_daily`, `miniapp_notifications`.
- **Consistency:** handles confirmation depth, reorg backfill, and replay tooling.
- **Realtime:** `miniapp_notifications` inserts trigger Supabase Realtime updates.

## App Registry (On-Chain Anchor + Supabase Mirror)

The AppRegistry contract is the on-chain anchor for MiniApp manifests,
metadata, and approval status:

- Developers register `manifest_hash`, `entry_url`, and display metadata
  (`name`, `description`, `icon`, `banner`, `category`, `contracts.<chain>.address`) on-chain
  (typically via the Edge `app-register` intent).
- An admin sets status to `Approved` or `Disabled` on-chain (default is `Pending`).
- Supabase `miniapps` stores the canonical manifest for fast runtime checks and
  auditing. NeoRequests syncs AppRegistry metadata/status back into Supabase so
  the cache reflects on-chain state; AppRegistry remains the immutable reference
  for governance and third‑party verification.
  When enabled, NeoRequests verifies AppRegistry status + manifest hash before
  executing callbacks.

## Global Signer (TEE-Managed Signing)

`infrastructure/globalsigner` provides a single place to manage enclave-held
master key material and derive **domain-separated** signing keys.

Use cases:

- signing service-layer on-chain fulfillments / callbacks
- signing off-chain service receipts (future)
- key rotation with auditability

## Account Pool (Large-Scale Neo N3 Accounts)

`infrastructure/accountpool` manages a large pool of Neo N3 accounts (target:
10,000+ accounts) and provides:

- account allocation + locking (`service_id`)
- balance tracking + updates
- rotation/archival of accounts (move funds, retire old accounts)

This is an infrastructure capability used by multiple services; it is not a
product-facing API.

### Account Pool Persistence (Supabase)

Account pool metadata and balances are **durably stored** in Supabase:

- `pool_accounts`: address, lock state, rotation flags, usage stats
- `pool_account_balances`: per-token balances per account

The pool is **deterministically derived** from `POOL_MASTER_KEY`, but Supabase
holds critical state (locks, rotations, balances). Losing the database loses
allocation history and makes active locks ambiguous, so:

- keep `POOL_MASTER_KEY` stable across upgrades
- do **not** enable `NEOACCOUNTS_ALLOW_EPHEMERAL_MASTER_KEY` outside explicit
  local experiments
- ensure Postgres storage is persistent (PVC or Docker volume)

Use backups for production and avoid destructive resets in local dev if you
need to preserve pool allocations.

## Product Services (Responsibilities)

Only these services are considered product services right now:

- **NeoFeeds (`neofeeds`)**: aggregate prices, sign responses, optionally push updates on-chain.
- **NeoFlow (`neoflow`)**: schedule triggers, run webhooks, optionally execute on-chain actions.
- **NeoCompute (`neocompute`)**: execute JS with strict limits + optional secret injection.
- **NeoOracle (`neooracle`)**: fetch external data with allowlist + optional secret injection.
- **TxProxy (`txproxy`)**: allowlisted transaction signing + broadcast proxy (single point for tx policy).
- **NeoRequests (`neorequests`)**: listens to on-chain ServiceLayerGateway
  requests, routes to TEE services, and submits callback transactions via
  `txproxy`.
- **NeoGasBank (`neogasbank`)**: manages GAS deposits/balances and supports
  service fee deduction (optional).
- **NeoSimulation (`neosimulation`)**: development-only transaction simulator
  for MiniApp workflows (optional).

Randomness is provided by running scripts in NeoCompute (`neocompute`) inside the enclave (optionally anchoring results via `RandomnessLog`).

## On-Chain Request/Callback Workflow (ServiceLayerGateway)

The ServiceLayerGateway contract coordinates on-chain service requests:

1. MiniApp contract calls `ServiceLayerGateway.RequestService(...)`.
2. Gateway emits `ServiceRequested` event (payload is a `ByteString` — see
   `docs/service-request-payloads.md` for the canonical JSON formats).
3. NeoRequests listens to the event, validates the MiniApp manifest, and calls
   the appropriate TEE service
   (`neovrf`, `neooracle`, `neocompute`), and prepares the result payload.
4. NeoRequests submits `ServiceLayerGateway.FulfillRequest(...)` via `txproxy`
   (txproxy must be allowlisted and the Gateway updater set).
5. Gateway emits `ServiceFulfilled` and calls the MiniApp callback method
   on-chain with `(request_id, app_id, service_type, success, result, error)`.

Events are persisted to Supabase `contract_events` and the callback transaction
is recorded in `chain_txs` for auditing and UI consumption.

Each service follows the same internal pattern:

- `services/<svc>/marble`: HTTP handlers + workers (enclave runtime).
- `services/<svc>/supabase`: service-specific persistence (only when needed).

Platform contracts live under `contracts/` and are written by the enclave-managed
signer (Updater pattern) when needed.

## EGo Boundary (What belongs in the enclave)

Keep enclave code focused on operations that need:

- confidentiality (private compute / secret-using fetch)
- integrity + verifiable origin (proofs/signatures)
- key custody (global signer)

Keep outside-TEE code focused on:

- user workflows and web-facing APIs
- data modeling and storage (Supabase)
- deployment glue and observability
