# MiniApp Platform Architecture

This document describes the **current** architecture of the Neo MiniApp
platform repo, updated to reflect the **MiniApp-OS v2** system service
contract model shipped in March 2026.

The key boundary is simple:

- this repo owns the MiniApp platform surface, including **10 OS service contracts** and **45 edge proxy functions**
- `neo-morpheus-oracle` owns Oracle / DataFeed / VRF / Compute / Paymaster
- `neo-abstract-account` owns AA core contracts, verifiers, relay UX, and AA runtime

Current production target is **Neo N3 only**.

## Repo Responsibilities

This repo owns:

- `platform/host-app`: end-user host shell that injects `window.MiniAppSDK`
- `platform/admin-console`: operational/admin UX
- `platform/edge/functions`: thin gateways for auth, wallet binding, policy enforcement, forwarding to external services, **and 45 OS service Binder proxy functions** (the `os-*` edge functions)
- `contracts/os-*`: **10 OS system service contracts** (StorageService, PaymentService, GameService, EscrowService, NFTService, ScriptEngine, BadgeService, LeaderboardService, CheckinService, VestingService)
- `contracts/`: platform infrastructure contracts (AppRegistry, Governance, PriceFeed, RandomnessLog, AutomationAnchor, PauseRegistry)
- `apps/shared/services/os/`: **10 typed frontend OS proxy classes** with `EdgeClient` transport
- `apps/`: shared MiniApp UI/composable/template code plus example MiniApps (all using `defineMiniApp()`)
- `deploy/scripts`: deployment, validation, and testnet workflow helpers

This repo does **not** own the full Oracle / AA runtime anymore.

## SaaS Integrations

The platform integrates three SaaS services for production observability:

- **Sentry** for error tracking and crash reporting (`NEXT_PUBLIC_SENTRY_DSN`)
- **PostHog** for product analytics and event tracking (`NEXT_PUBLIC_POSTHOG_KEY`)
- **Supabase Realtime** for live notification push to connected clients

Configuration lives in `platform/host-app/lib/monitoring/` and
`platform/host-app/.env.example`.

## High-Level Topology (OS v2)

```text
MiniApp Frontend (defineMiniApp → PlayArea)
  │
  │  ctx.os.<service>()      ctx.services.<service>()
  │
  ▼
PlatformContext / PlatformServices
  │
  │  EdgeClient (Binder transport)
  │
  ▼
Supabase Edge + host-side proxy routes
  ┌──────────────────────────────────────────────────┐
  │  45 OS Binder edge functions (os-storage-get,    │
  │  os-payment-deposit, os-game-bet, etc.)          │
  │  + existing auth / wallet binding / rate limit   │
  │  + API keys / scopes / usage caps                │
  └──────────────────────────────────────────────────┘
            │                                │
            ▼                                ▼
  ┌─────────────────────┐    ┌───────────────────────────────┐
  │  OS Service Contracts│    │  neo-morpheus-oracle           │
  │  (10 on-chain)       │    │  oracle / datafeed / vrf /     │
  │  StorageService      │    │  compute / paymaster runtime   │
  │  PaymentService      │    └───────────────────────────────┘
  │  GameService         │                   │
  │  EscrowService       │    ┌───────────────────────────────┐
  │  NFTService          │    │  neo-abstract-account          │
  │  ScriptEngine        │    │  AA core / verifiers / relay   │
  │  BadgeService        │    └───────────────────────────────┘
  │  LeaderboardService  │                   │
  │  CheckinService      │                   │
  │  VestingService      │                   │
  └─────────────────────┘                    │
            │                                │
            └────────────────┬───────────────┘
                             ▼
                          Neo N3
  - OS service contracts (10)
  - Platform infrastructure contracts (AppRegistry, Governance, etc.)
  - Morpheus Oracle / DataFeed
  - Abstract Account + verifiers
```

### Previous Topology (pre-v2, archived)

The pre-v2 architecture used a 4-hop indirect routing chain:
`MiniApp → composable → ChainService.invoke(INDIVIDUAL_CONTRACT) → per-app contract`
with ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, and ServiceGateway
for shared module resolution. That chain has been replaced by direct OS service
calls. The deprecated contracts are archived under `_archive/deprecated-contracts/`.

## Trust Boundaries

### 1. Browser / MiniApp

The browser can:

- call host-injected `window.MiniAppSDK`
- call `ctx.os.*` OS service proxies (which route through edge)
- request wallet signatures
- call same-origin host proxies such as `/api/rpc/*` and `/api/aa/relay`

The browser must **not** receive:

- service role keys
- host-only API keys
- raw Oracle / Compute secrets
- OS contract admin keys or signer material

OS proxies automatically inject `appId` (like Android Binder UID), preventing
identity forgery from the browser.

### 2. Platform Edge Gateway (Binder Proxy Layer)

The edge layer is the platform policy boundary. It handles:

- Supabase auth
- wallet binding requirements
- app permission checks (manifest `permissions` validated per OS service call)
- daily usage caps
- per-function scopes
- rate limiting

The **45 OS Binder edge functions** (`os-storage-get`, `os-payment-deposit`,
`os-game-bet`, etc.) follow a standardized pattern:
1. Authenticate via Supabase JWT
2. Validate app permission for the target OS service
3. Apply rate limits
4. Forward to the OS contract via Neo N3 RPC
5. Return result to caller

The edge layer also forwards work to the external Oracle stack or returns
wallet invocation intents to the client.

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

### 5. OS Service Contracts (On-Chain Trust Boundary)

The 10 OS service contracts enforce on-chain access control:

- **appId scoping**: all data access is namespaced by `appId` from AppRegistry
- **ScriptEngine sandboxing**: registered scripts can only read/write their own
  app's StorageService data, cannot call external contracts or transfer assets
- **PaymentService**: enforces per-app balance pools with platform + developer fee splits
- **PauseRegistry**: provides emergency stop for all OS services

## On-Chain Components Owned Here

### OS System Service Contracts (MiniApp-OS v2)

| Contract | Directory | Purpose |
| --- | --- | --- |
| StorageService | `contracts/os-storage/` | On-chain KV storage scoped by appId |
| PaymentService | `contracts/os-payment/` | Deposits, withdrawals, transfers, fee management |
| GameService | `contracts/os-game/` | Betting pools, RNG integration, settlement |
| EscrowService | `contracts/os-escrow/` | Lock/release/refund with milestone tracking |
| NFTService | `contracts/os-nft/` | Mint/transfer/burn with soulbound and ticket modes |
| ScriptEngine | `contracts/os-script/` | On-chain NeoVM bytecode execution at hook points |
| BadgeService | `contracts/os-badge/` | Achievement badges scoped by appId |
| LeaderboardService | `contracts/os-leaderboard/` | Ranked scores scoped by appId |
| CheckinService | `contracts/os-checkin/` | Daily check-in streaks and rewards |
| VestingService | `contracts/os-vesting/` | Token vesting schedules scoped by appId |

### Platform Infrastructure Contracts

| Contract | Purpose |
| --- | --- |
| AppRegistry | MiniApp registration, permissions, action declarations |
| Governance | NEO staking and voting |
| PriceFeed | Oracle price data |
| RandomnessLog | VRF attestation anchoring |
| AutomationAnchor | Periodic task scheduling with GAS deposit pools |
| PauseRegistry | Emergency stop for OS services |

### Deprecated Contracts (archived)

The following have been replaced by OS services and archived under
`_archive/deprecated-contracts/`:

- ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, ServiceGateway
- Individual per-app MiniApp contracts (45 total)

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

## Frontend OS Architecture

### PlatformContext / PlatformServices

The `PlatformServices` class (`apps/shared/services/PlatformServices.ts`) is the
central service registry, analogous to Android's `Context`. It provides:

**Core platform services** (`services.*`):
- `chain` (ChainService), `balance` (BalanceService), `transfer` (TransferService)
- `oracle` (OracleService), `aa` (AAService)
- `events` (EventBus), `cache` (CacheService), `lifecycle` (LifecycleService)
- `notify` (NotificationService), `clipboard` (ClipboardService), `fmt` (FormattingService)

**OS service proxies** (`os.*`):
- `storage` (StorageProxy), `payment` (PaymentProxy), `game` (GameProxy)
- `vesting` (VestingProxy), `escrow` (EscrowProxy), `badge` (BadgeProxy)
- `leaderboard` (LeaderboardProxy), `checkin` (CheckinProxy)
- `nft` (NFTProxy), `script` (ScriptProxy)

All OS proxies extend `OSServiceProxy` and use `EdgeClient` as the Binder
transport layer. The `EdgeClient` automatically injects `appId` into every
request, preventing identity forgery.

### defineMiniApp Entry Pattern

All miniapps use `defineMiniApp()` as the sole entry point:

```ts
defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    // ctx.os.checkin.checkIn()  — call OS services
    // ctx.services.notify.toast() — call platform services
    // ctx.registerAction("key", handler) — wire operation panel
  }
})
```

There are zero `App.legacy.vue` files remaining. All apps use the modern pattern.

## Runtime Configuration

Canonical external Neo N3 addresses and domains are centralized in:

- `apps/shared/constants/rpc.ts`

That registry powers:

- `useOracle()`
- `useAbstractAccount()`
- shared frontend network selection
- host / admin documentation

OS contract hashes are configured via environment variables:
`CONTRACT_STORAGESERVICE_HASH` through `CONTRACT_NFTSERVICE_HASH` (10 total).
See `.env.example` for the complete list.

## Local Development Model

Local development no longer means "boot the old in-repo Go service layer".

The supported model is:

1. run host/admin apps from this repo
2. point `.env` to deployed external Oracle / AA services
3. optionally run the external repos themselves if you need a private dev stack

For OS contract development, see the OS contract section in
[`docs/LOCAL_DEV.md`](./LOCAL_DEV.md).

See [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) for the detailed flow.
