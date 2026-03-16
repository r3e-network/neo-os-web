# MiniApp Platform Architecture

This document describes the **current** architecture of the Neo MiniApp
platform repo.

The key boundary is simple:

- this repo owns the MiniApp platform surface
- `neo-morpheus-oracle` owns Oracle / DataFeed / VRF / Compute / Paymaster
- `neo-abstract-account` owns AA core contracts, verifiers, relay UX, and AA runtime

Current production target is **Neo N3 only**.

## Repo Responsibilities

This repo owns:

- `platform/host-app`: end-user host shell that injects `window.MiniAppSDK`
- `platform/admin-console`: operational/admin UX
- `platform/edge/functions`: thin gateways for auth, wallet binding, policy enforcement, and forwarding to external services
- `contracts/`: MiniApp platform contracts and example MiniApp contracts
- `apps/`: shared MiniApp UI/composable/template code plus example MiniApps
- `deploy/scripts`: deployment, validation, and testnet workflow helpers

This repo does **not** own the full Oracle / AA runtime anymore.

## High-Level Topology

```text
MiniApp frontend / host UI / admin UI
            |
            v
Supabase Edge + host-side proxy routes
  - auth
  - wallet binding
  - API keys / scopes
  - rate limits
  - usage caps
  - request routing
            |
            +------------------------------+
            |                              |
            v                              v
neo-morpheus-oracle                 neo-abstract-account
  - oracle                              - AA core contract
  - datafeed                            - verifier contracts
  - vrf                                 - relay endpoint
  - compute                             - paymaster-aware relay flow
  - paymaster
            |                              |
            +---------------+--------------+
                            v
                         Neo N3
  - platform contracts
  - MiniApp contracts
  - Morpheus Oracle / DataFeed
  - Abstract Account + verifiers
```

## Trust Boundaries

### 1. Browser / MiniApp

The browser can:

- call host-injected `window.MiniAppSDK`
- request wallet signatures
- call same-origin host proxies such as `/api/rpc/*` and `/api/aa/relay`

The browser must **not** receive:

- service role keys
- host-only API keys
- raw Oracle / Compute secrets

### 2. Platform Edge Gateway

The edge layer is the platform policy boundary. It handles:

- Supabase auth
- wallet binding requirements
- app permission checks
- daily usage caps
- per-function scopes
- rate limiting

It then forwards work to the external Oracle stack or returns wallet invocation
intents to the client.

### 3. External Oracle Stack

`neo-morpheus-oracle` owns:

- allowlisted external fetches
- datafeed aggregation
- VRF generation
- confidential compute
- paymaster authorization
- on-chain callback fulfillment

This repo only stores the integration URLs, domains, and contract hashes needed
to reach that stack.

### 4. External AA Stack

`neo-abstract-account` owns:

- canonical AA contract deployment
- verifier and hook contracts
- relay endpoint
- paymaster-aware AA relay submission
- Web3Auth / session-key / recovery flows

This repo exposes a host-side relay proxy and shared AA config, but the AA
runtime remains external.

## On-Chain Components Owned Here

Platform-owned Neo N3 contracts in this repo include:

- `PaymentHub` (compatibility-only receipt settlement for the small set of contracts that still require numeric receipt validation)
- `Governance`
- `PriceFeed`
- `RandomnessLog`
- `AppRegistry`
- `AutomationAnchor`
- MiniApp-specific contracts under `contracts/` and `apps/*`

These contracts integrate with the external Oracle / AA systems rather than
embedding those runtimes.

## Integration Paths

### Wallet-Signed Flows

User-signed actions typically go:

1. MiniApp calls `window.MiniAppSDK`
2. edge returns an invocation intent
3. host wallet signs/submits
4. events and stats are indexed back into platform views

Examples:

- `pay-gas`
- `vote-bneo`
- `app-register`
- `app-update-manifest`

### Primary Oracle / AA Flows

The preferred production path is:

1. MiniApp host or host-only tooling calls the platform edge / host proxy
2. the platform forwards directly to:
   - `neo-morpheus-oracle` for Oracle / DataFeed / VRF / Compute / sponsorship
   - `neo-abstract-account` for AA relay / verifier-aware execution
3. the external system performs the chain interaction
4. the platform only consumes the result, receipt, or user-facing state

This keeps the MiniApp platform simple and avoids a second platform-owned
service bus on top of the existing Oracle / AA systems.

### Edge -> External Oracle Flows

Gateway-backed service calls go:

1. MiniApp or host calls edge function
2. edge authenticates and validates policy
3. edge forwards to configured external Morpheus endpoint
4. response returns directly to caller

Examples:

- `rng-request`
- `datafeed-price`
- `oracle-query`
- `compute-execute`
- `compute-app-execute`
- `gas-sponsor-check`
- `gas-sponsor-request`

## Compute Script Size Strategy

Inline compute scripts are supported, but they are not the only option.

When notification or callback payload size is too small, prefer a registered
script reference:

- store script source in a user-controlled registry contract getter
- send `script_ref` / `script_name` metadata on-chain
- let the external Morpheus worker resolve the script body at execution time

This keeps the MiniApp platform aligned with the external compute runtime and
avoids forcing large scripts through request payloads.

## Runtime Configuration

Canonical external Neo N3 addresses and domains are centralized in:

- `apps/shared/constants/rpc.ts`

That registry powers:

- `useOracle()`
- `useAbstractAccount()`
- shared frontend network selection
- host / admin documentation

## Local Development Model

Local development no longer means "boot the old in-repo Go service layer".

The supported model is:

1. run host/admin apps from this repo
2. point `.env` to deployed external Oracle / AA services
3. optionally run the external repos themselves if you need a private dev stack

See [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) for the detailed flow.
