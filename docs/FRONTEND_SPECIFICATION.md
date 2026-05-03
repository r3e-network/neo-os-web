# Frontend Specification

This document describes the **current** frontend surface of the Neo MiniApp
platform repository, updated to reflect the **MiniApp-OS v2** architecture
shipped in March 2026. It is not a product wishlist or future-state design deck.

## Scope

Frontend code owned here covers:

- `platform/host-app`: the public host shell, miniapp catalog, detail pages,
  stats pages, and host-side API routes
- `platform/admin-console`: operational and admin UX
- `apps/*`: miniapp frontends loaded by the host (all using `defineMiniApp()`)
- shared frontend runtime code under `apps/shared/*`:
  - `apps/shared/services/PlatformServices.ts` — central service registry with OS proxies
  - `apps/shared/services/os/` — 10 typed OS proxy classes + EdgeClient + types
  - `apps/shared/utils/defineMiniApp.ts` — sole entry point for all miniapps
  - `apps/shared/types/miniapp-context.ts` — `MiniAppContext` with `os: OSServices`

Current production target is **Neo N3 only**.

## Current Host Stack

`platform/host-app` currently uses:

- Next.js `15.x`
- React `18`
- **Pages Router** rather than App Router
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- `@r3e/neo-js-sdk`
- host-native playarea registry for miniapp-specific interaction surfaces
- Supabase-backed host APIs for stats, notifications, publish workflow, and auth-linked features

## Host Responsibilities

The host frontend is responsible for:

- catalog browsing and miniapp discovery
- featured / flagship presentation
- miniapp catalog/detail rendering with unified information and operation panels
- wallet-aware transaction prompting
- host-side proxy calls for Oracle / AA / relay / stats / notifications
- review / rating / comment surfaces
- admin publishing and definition preview tooling

The host frontend is **not** the Oracle runtime, AA runtime, or paymaster
runtime. Those remain external integrations.

## Current Route Surface

The main user-facing pages currently implemented under `platform/host-app/pages`
include:

- `/`
- `/home`
- `/miniapps`
- `/miniapps/[id]`
- `/explorer`
- `/docs`
- `/developer`
- `/account`
- `/analytics`
- `/stats`
- `/leaderboard`
- `/secrets`

Operational/API routes currently implemented include:

- `/api/rpc/[fn]`
- `/api/rpc/relay`
- `/api/rpc/sponsor`
- `/api/aa/relay`
- `/api/morpheus/oracle/*`
- `/api/morpheus/confidential/*`
- `/api/morpheus/neodid/*`
- `/api/miniapps/*`
- `/api/cron/*`
- `/api/platform/stats`
- `/api/notifications/*`
- `/api/chain/health`

## MiniApp Runtime Model

The host resolves each miniapp definition and renders a single web detail page:
shared catalog, information, status, reviews, and operation panels stay common,
while the playarea is selected by `PlayAreaRegistry` for the app id.

### defineMiniApp() Entry Pattern (OS v2)

Miniapp packages can still use `defineMiniApp()` for local package previews, but
the public host renders production miniapp detail pages directly through the
host-native playarea registry.

```ts
defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    // ctx.os.*    — OS service proxies (storage, payment, game, badge, etc.)
    // ctx.services.* — platform services (chain, balance, notify, clipboard, fmt)
    // ctx.t()     — i18n translation
    // ctx.registerAction() — wire operation panel buttons
    // ctx.setStatus() / ctx.clearStatus() — status messages
  }
})
```

### PlatformContext.os — OS Service Proxies

The `MiniAppContext.os` property provides 10 typed proxy classes that call
OS system contracts through the edge Binder layer:

| Proxy Class | Type Exports | Purpose |
| --- | --- | --- |
| `StorageProxy` | — | App-scoped KV storage |
| `PaymentProxy` | — | Deposits, withdrawals, transfers, balances |
| `GameProxy` | `PoolConfig` | Pool management, betting, settlement |
| `CheckinProxy` | `CheckinData` | Daily check-in, streaks, rewards |
| `BadgeProxy` | — | Achievement badges |
| `LeaderboardProxy` | — | Ranked scores |
| `NFTProxy` | — | Minting, soulbound, ticket validation |
| `EscrowProxy` | — | Milestone-based escrow |
| `VestingProxy` | — | Token vesting schedules |
| `ScriptProxy` | — | Custom hook script management (dev only) |

All proxies extend `OSServiceProxy` and use `EdgeClient` as transport. The
`EdgeClient` automatically injects `appId` into every request (Binder UID
pattern), preventing identity forgery from the browser.

### PlatformServices Registry

`PlatformServices` (`apps/shared/services/PlatformServices.ts`) is the central
service registry, created via `PlatformServices.create(appId, options)` and
provided via Vue's provide/inject mechanism. It contains both core platform
services (`chain`, `balance`, `transfer`, `oracle`, `aa`, `events`, `cache`,
`lifecycle`, `notify`, `clipboard`, `fmt`) and the OS service proxy object (`os`).

## Payment And Transaction UX

The current frontend must support **two** payment models:

### 1. Direct prepaid contract flow

Used by the current flagship direct-flow apps such as:

- GASBOX
- FogPlay
- Red Envelope
- NeoPay
- Daily Check-in
- SelfLoan

User flow:

1. wallet signs a direct GAS or asset transfer to the target contract
2. the contract records prepaid credit in `OnNEP17Payment`
3. the frontend invokes the follow-up contract method

### 2. Current payment model

The current flagship payment architecture uses direct contract transfers and
contract-local prepaid credit. New MiniApps should follow that path.

## Featured Catalog Policy

The repository currently contains **52** miniapp manifests under `apps/*`.

The current flagship 7 shown as primary market-facing apps are:

- `miniapp-self-loan`
- `miniapp-redenvelope`
- `miniapp-fogplay`
- `miniapp-dailycheckin`
- `miniapp-last-survivor`
- `miniapp-neo-pay`
- `miniapp-gasbox`

The current host homepage also surfaces a dedicated Account & Oracle Tools strip
for:

- `miniapp-aa-account-lab`
- `miniapp-aa-permissions-lab`
- `miniapp-aa-market-hub` (interactive trustless escrow market UI)
- `miniapp-aa-relay-console`
- `miniapp-aa-session-key-lab`
- `miniapp-oracle-price-console`
- `miniapp-oracle-vrf-console`
- `miniapp-neo-x-bridge`

These newer integration miniapps are **integration / adapter surfaces**:

- they intentionally do not reimplement third-party protocol logic
- they provide curated discovery, official app URLs, and wallet/network guidance
- bridge execution remains on the official third-party surfaces

Current flagship payment matrix:

- Direct prepaid GAS: FogPlay, Red Envelope, Daily Check-in, Self Loan, NeoPay
- Direct prepaid GAS with `receiptId=0` ABI placeholder: LastSurvivor buy flow, GASBOX spin flow

When there is any conflict between older screenshots, older docs, and runtime
behavior, the manifest + host definitions + live validation report win.

## Source Of Truth Files

For frontend-visible app metadata and routing, prefer:

- `apps/*/neo-manifest.json`
- `platform/host-app/public/miniapp-definitions/*.json`
- `apps/shared/constants/rpc.ts`
- `deploy/scripts/live_validate_flagship_user_flows.js`

For the OS service layer, refer to:

- `apps/shared/services/os/` — proxy implementations and types
- `apps/shared/services/PlatformServices.ts` — central registry
- `apps/shared/types/miniapp-context.ts` — `MiniAppContext` with `os: OSServices`
- `apps/shared/utils/defineMiniApp.ts` — entry pattern
- `platform/edge/functions/os-*/` — 45 Binder proxy edge functions

## Current Non-Goals

The frontend currently does **not** promise:

- full App Router migration
- universal AA execution for every miniapp
- dark-pattern-heavy gamification or speculative catalog counts
- broad “future roadmap” features that are not already present in code

## Monitoring and Observability

The host app integrates SaaS monitoring services (configured in
`platform/host-app/lib/monitoring/`):

- **Sentry** (`NEXT_PUBLIC_SENTRY_DSN`) — error tracking and crash reporting
- **PostHog** (`NEXT_PUBLIC_POSTHOG_KEY`) — product analytics and event tracking
- **Supabase Realtime** — live notification push to connected clients

These are initialized at app startup via `initAllMonitoring()`.

## Maintenance Rule

If a host page, API route, miniapp definition, or manifest is removed or added,
this file should be updated to match the actual codebase rather than preserving
older planning language.
