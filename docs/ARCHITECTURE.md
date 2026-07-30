# MiniApp Platform Architecture

This document describes the Neo MiniApp platform repo in two parts:

1. **Current** — the architecture that actually exists at HEAD (verified
   against the code, July 2026).
2. **Target** — the Platform Contract Library v2 refactor now in flight.

Current production target is **Neo N3 only**.

## Repo Responsibilities

The platform was one tree — host app, admin console, edge functions, contracts,
SDK, and all 78 apps with their contracts. It is six repositories now, layered
bottom-up: chain, contracts, services, platform + devpack, apps.

| Repository | Owns |
| --- | --- |
| [`neo-os-contracts`](https://github.com/r3e-network/neo-os-contracts) | The platform on-chain estate: the `Platform*` contracts, `AppAccount`, `MiniAppFactory`, `MiniAppCredits`, the `MiniApp.DevPack` base library, the factory templates and the test fixtures — plus every audit and generator that reads a contract manifest. |
| [`neo-os-services`](https://github.com/r3e-network/neo-os-services) | Oracle / DataFeed / VRF / Compute / Paymaster, including the **kernel contract** that backs all `os-*` edge functions. |
| **`neo-os-web`** (this repo) | The platform only — see below. |
| [`neo-os-devpack`](https://github.com/r3e-network/neo-os-devpack) | The app-facing SDK: `@r3e-network/neo-miniapp-framework` (was `framework/`) and `@r3e-network/neo-miniapp-shared` (was `apps/shared`), including the audit that keeps the `platform-*-surface.ts` files in step with the contract ABIs. |
| [`neo-os-miniapps`](https://github.com/r3e-network/neo-os-miniapps) | The non-game MiniApps, their Neo N3 contracts, and their CDN publish pipeline. |
| [`neo-os-minigames`](https://github.com/r3e-network/neo-os-minigames) | The MiniGames, their contracts (including the compiler-pinned `MiniAppTarotVrf`), and their CDN publish pipeline. |
| [`neo-abstract-account`](https://github.com/r3e-network/neo-abstract-account) | AA core contracts, verifiers, relay UX, and AA runtime. |

This repo owns:

- `platform/host-app`: Next.js / React end-user host shell that injects
  `window.MiniAppSDK`, renders MiniApp manifests and native playareas, and
  hosts wallet / AA / RPC proxy routes
- `platform/admin-console`: Next.js operational/admin UX
- `platform/edge/functions`: Supabase Edge (Deno) gateway functions — auth,
  wallet binding, policy / rate-limit / scope enforcement, forwarding to
  external services, and the `os-*` OS service functions
- `deploy/`: deployment, validation, and testnet workflow helpers

It deliberately owns **no** app and **no** contract. Apps arrive from the CDN at
runtime and the host knows only what a manifest declares, which is what lets an
app ship without a platform release. Contract artifacts are read out of
`neo-os-contracts` (override with `NEO_OS_CONTRACTS_DIR`) or the app repos'
build output; `deploy/scripts/lib/vendored-from-contracts.test.mjs` fails if a
`contracts/` tree reappears here.

The app manifests the host serves are a committed snapshot,
`platform/host-app/public/miniapp-manifests.json`, rebuilt from the app repos by
`scripts/refresh-manifest-snapshot.mjs`. `--check` fails when it drifts, so the
host never reads a sibling checkout at runtime.

## SaaS Integrations

The platform integrates three SaaS services for production observability:

- **Sentry** for error tracking and crash reporting (`NEXT_PUBLIC_SENTRY_DSN`)
- **PostHog** for product analytics and event tracking (`NEXT_PUBLIC_POSTHOG_KEY`)
- **Supabase Realtime** for live notification push to connected clients

Configuration lives in `platform/host-app/lib/monitoring/` and
`platform/host-app/.env.example`.

---

# Part 1 — Current Architecture

## High-Level Topology

```text
MiniApp Frontend (defineMiniApp → PlayArea)
  │
  │  ctx.services.<service>()      ctx.os.<service>()
  │
  ▼
PlatformServices / EdgeClient   (apps/shared/services/, framework/)
  │
  │  HTTPS (Supabase JWT or API key, appId auto-injected)
  │
  ▼
Supabase Edge functions (Deno)
  ┌──────────────────────────────────────────────────┐
  │  42 os-* OS service functions                    │
  │  (createOSHandler: auth → rate limit → scope →   │
  │   manifest permission → appId validation)        │
  │  + auth / wallet-bind / api-keys / credits /     │
  │    gasbank / secrets / social / automation fns   │
  └──────────────────────────────────────────────────┘
        │ reads: Neo RPC state queries
        │ writes: wallet-signed invocation intents
        ▼
  ┌─────────────────────┐    ┌───────────────────────────────┐
  │  Morpheus kernel     │    │  neo-os-services           │
  │  contract (external) │    │  oracle / datafeed / vrf /     │
  │  — backs every os-*  │    │  compute / paymaster runtime   │
  │  service operation   │    └───────────────────────────────┘
  └─────────────────────┘                   │
  ┌─────────────────────┐    ┌───────────────────────────────┐
  │  Platform contracts  │    │  neo-abstract-account          │
  │  (contracts/platform)│    │  AA core / verifiers / relay   │
  └─────────────────────┘    └───────────────────────────────┘
        │                                 │
        └────────────────┬────────────────┘
                         ▼
                      Neo N3
```

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
- contract admin keys or signer material

OS proxies automatically inject `appId` (like Android Binder UID), preventing
identity forgery from the browser.

### 2. Platform Edge Gateway

The edge layer is the platform policy boundary. Every `os-*` function is
wrapped by `createOSHandler`
(`platform/edge/functions/_shared/os-service.ts`), which standardizes:

1. CORS preflight
2. Auth (bearer Supabase JWT or API key)
3. Rate limiting
4. Scope enforcement
5. App policy / manifest permission check
6. Body parsing + appId validation

Non-OS functions cover auth (`auth-wallet`, `auth-wallet-nonce`), wallet
binding, API keys, credits ledger/settlement, GasBank, secrets vault, social
feeds, automation triggers, and Oracle/AA/sponsorship forwarding
(`gas-sponsor-check`, `gas-sponsor-request`).

### 3. The OS Kernel Contract (external)

All 42 `os-*` functions route to a **single Morpheus Oracle kernel contract**
(`CONTRACT_MORPHEUS_ORACLE_HASH`; `_shared/kernel-rpc.ts`). The kernel exposes
the per-service operations (`putMiniAppState` / `getMiniAppState`,
`submitMiniAppRequest` / `fulfillRequest`, badge/checkin/escrow/… ops):

- **Reads** are proxied as Neo RPC state queries against the kernel.
- **Writes** return invocation intents the user's wallet signs — e.g.
  `os-payment-deposit` returns a `GAS.transfer` intent to the kernel with the
  `appId` encoded in the memo for `OnNEP17Payment` routing.

The ten per-service `CONTRACT_*SERVICE_HASH` variables in `.env.example` are a
legacy map retained for documentation parity with historical per-service
deployments — no edge function reads them (`_shared/os-contracts.ts`).

### 4. External Oracle and AA Stacks

`neo-os-services` owns allowlisted external fetches, datafeed aggregation,
VRF, confidential compute, paymaster authorization, and on-chain callback
fulfillment. `neo-abstract-account` owns the canonical AA deployment,
verifiers/hooks, relay endpoint, and Web3Auth / session-key / recovery flows.
This repo stores only the integration URLs, domains, and contract hashes
needed to reach those stacks (host-side relay proxy + shared AA config).

### 5. Platform Contracts (on-chain, owned here)

Seven contract projects live under `contracts/platform/`:

| Contract | Status | Purpose |
| --- | --- | --- |
| PlatformAnchor | live (5 apps) | Shared manual AA-agent routing anchor; the fleet's only permissionless registration lane |
| MiniAppFactory | live (3 apps) | Template registry + digest-verified `ContractManagement.Deploy` |
| PlatformGame | deployed, no live bindings | Multi-tenant game engine (Countdown, CoinFlip, Gacha, Dice) |
| PlatformDeFi | testnet, no live bindings | Lending, flash loan, capsule, credit |
| PlatformSocial | no deployment record | Red envelope / range pool, trust, vault |
| **PlatformRegistry** | **v2 spine, landed 2026-07-16/17** | Permissionless `registerApp`, AppAccount minting, timelocked engine table, role-bound treasury lanes |
| **AppAccount** | **v2, landed 2026-07-16/17** | Canonical per-app treasury shim NEF, minted once per registered app |

Alongside them, 34 legacy per-app `MiniApp*` contracts still compile in
`contracts/` root. They are **not archived** (there is no
`contracts/_archive/`); they are the legacy estate pending absorption into
the v2 engine estate (see Part 2). All contracts share source-level base code
via `MiniApp.DevPack` `Compile Include` — Neo N3 has no deployed-code
inheritance. Blueprint constraints: GAS-only payments, NEO-only governance.

## Frontend Service Architecture

### PlatformContext / PlatformServices

The `PlatformServices` class (`apps/shared/services/PlatformServices.ts`) is
the central service registry, analogous to Android's `Context`. It provides:

**Core platform services** (`services.*`):
- `chain` (ChainService), `balance` (BalanceService), `transfer` (TransferService)
- `oracle` (OracleService), `aa` (AAService)
- `events` (EventBus), `cache` (CacheService), `lifecycle` (LifecycleService)
- `notify` (NotificationService), `clipboard` (ClipboardService), `fmt` (FormattingService)

**OS service proxies** (`os.*`) — 9 typed proxies in
`apps/shared/services/os/`:
- `storage` (StorageProxy), `payment` (PaymentProxy), `game` (GameProxy)
- `vesting` (VestingProxy), `escrow` (EscrowProxy), `badge` (BadgeProxy)
- `leaderboard` (LeaderboardProxy), `checkin` (CheckinProxy), `nft` (NFTProxy)

All OS proxies extend `OSServiceProxy` and use `EdgeClient` as the transport
layer. The `EdgeClient` automatically injects `appId` into every request,
preventing identity forgery.

### Framework

`framework/` (`@neo/miniapp-framework`) is the typed SDK under every MiniApp:
chain query/write, storage, notify, stats, permissions, wallet, AA
(`utils/aa-account.ts`), plus `game/` and `gamefi/` helpers. The gamefi layer
hardcodes the reward-game ABI — `startGame` / `finalizeGame` / `expireGame` /
`withdraw`, reads `freePool` / `creditOf` / `activeGameOf` / `getGame` /
`statsOf`, events `GameStarted` / `Solved` / `CreditWithdrawn`
(`framework/gamefi/reward-game-sdk.ts`, `framework/funds.ts`) — and the v2 engine
estate preserves those names verbatim, so client migration is config + appId
threading, never a rewrite.

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

## Integration Paths

### Wallet-Signed Flows

User-signed actions typically go:

1. MiniApp calls `window.MiniAppSDK`
2. edge returns an invocation intent
3. host wallet signs/submits
4. events and stats are indexed back into platform views

Examples: `pay-gas`, `vote-bneo`, `app-register`, `app-update-manifest`. The
latter three build intents against **env-configured external contracts**
(`CONTRACT_GOVERNANCE_HASH`, `CONTRACT_APPREGISTRY_HASH`) whose sources are
not in this repo.

### Primary Oracle / AA Flows

The preferred production path is:

1. MiniApp host or host-only tooling calls the platform edge / host proxy
2. the platform forwards directly to:
   - `neo-os-services` for Oracle / DataFeed / VRF / Compute / sponsorship
   - `neo-abstract-account` for AA relay / verifier-aware execution
3. the external system performs the chain interaction
4. the platform only consumes the result, receipt, or user-facing state

This keeps the MiniApp platform simple and avoids a second platform-owned
service bus on top of the existing Oracle / AA systems.

### Compute Script Size Strategy

Inline compute scripts are supported, but they are not the only option.
When notification or callback payload size is too small, prefer a registered
script reference: store script source off-chain or in a getter, send
`script_ref` / `script_name` metadata on-chain, and let the external Morpheus
worker resolve the script body at execution time. This keeps the MiniApp
platform aligned with the external compute runtime and avoids forcing large
scripts through request payloads.

## Runtime Configuration

Canonical external Neo N3 addresses and domains are centralized in:

- `apps/shared/constants/rpc.ts`

That registry powers `useOracle()`, `useAbstractAccount()`, shared frontend
network selection, and host / admin documentation.

Contract hashes are env-configured: the OS kernel
(`CONTRACT_MORPHEUS_ORACLE_HASH`), the external intent targets
(`CONTRACT_APPREGISTRY_HASH`, `CONTRACT_GOVERNANCE_HASH`, …), and the ten
legacy per-service slots noted above. See `.env.example` for the full list.

## Local Development Model

Local development no longer means "boot the old in-repo Go service layer".

The supported model is:

1. run host/admin apps from this repo
2. point `.env` to deployed external Oracle / AA services
3. optionally run the external repos themselves if you need a private dev stack

See [`docs/LOCAL_DEV.md`](./LOCAL_DEV.md) for the detailed flow.

---

# Part 2 — Target Architecture (Platform Contract Library v2)

The authoritative design is
[`docs/platform-contract-library-v2.md`](./platform-contract-library-v2.md).
The first slice — PlatformRegistry + AppAccount — landed 2026-07-16/17; the
rest is in flight. In short:

- **PlatformRegistry (the spine).** Permissionless, fee-paid `registerApp`
  (lite tier ≈1 GAS, or full tier that also mints the AppAccount); a directory
  of `getApp` / `appAccountOf` / `appIdOfAccount` / `engineOf` reads that
  becomes the canonical on-chain estate ledger; a timelocked `registerEngine`
  table that is the extension mechanism (scenario N+1 = a new engine contract
  + one timelocked row, never a registry upgrade); role-bound treasury lanes;
  24h-timelocked two-tier governance with global + per-app pause.
- **AppAccount (minted per app).** One canonical audited NEF deployed per
  registered app with manifest name = appId — a real contract-account that
  holds NEP-17 (GAS/NEO in v1), receives fee sweeps and sponsorships, funds
  engine pools, and anchors permissions. Its only outbound path is
  registry-relayed `executeTransfer` to role-bound destinations, plus a
  pause-gated `escapeExecute` credible-exit hatch.
- **Engine estate.** PlatformGame evolves in place with a RewardGame module
  whose ABI is the clone ABI verbatim (`startGame(appId, …)`, appId-first) so
  the framework's hardcoded surface keeps working; per-app economics become
  validated registry descriptor rows. PlatformAnchor and MiniAppFactory are
  grandfathered as engine rows, untouched. PlatformFinance / PlatformSocial v2
  follow in later phases, each behind a named first tenant.
- **MiniApp.DevPack v2.** `MiniAppEngineBase.cs` adds the canonical
  `AppKey(appId, …)` kit, an (appId,payer) credit ledger with liability
  counter, reentrancy-lock granularities, and the `activateApp` /
  `validateAndApplyDescriptor` plumbing for lane-B thin shims.
- **Migration, not big-bang.** The 34 legacy per-app contracts are absorbed
  cohort by cohort (drain protocol: pause → settle/expire → withdraw pool →
  fund engine pool → flip the manifest binding); witness-gated withdrawal
  lanes on old contracts stay live forever. Healthy standalone contracts (the
  wager quartet, MiniAppCredits) are explicitly not forced to migrate.

### Testnet deployments (2026-07-18)

The v2 slice is live on Neo N3 testnet (records:
[`deploy/config/platform-registry-testnet-2026-07-17.json`](../deploy/config/platform-registry-testnet-2026-07-17.json),
[`contracts/build/testnet_game_deployment.json`](../contracts/build/testnet_game_deployment.json),
[`deploy/config/private-kernel-testnet-2026-07-18.json`](../deploy/config/private-kernel-testnet-2026-07-18.json);
verification evidence: [`docs/reports/joint-verification-2026-07-18.md`](./reports/joint-verification-2026-07-18.md)):

| Contract | Hash | Notes |
| --- | --- | --- |
| PlatformRegistry | `0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b` | 77/77 apps registered (lite, cohort 0); artifact + engine timelocks execute 2026-07-18; 24h self-update scheduled for 2026-07-19 |
| PlatformGame v2 | `0xc75b181b4561462903bb27d8d9e0b32b637bec12` | uc1: bound to the registry; oracle = private kernel; RewardGame settle loop proven on-chain |
| MorpheusOracle kernel (platform-operated) | `0x2e67d3a62d0020675fd7ba0fa0611fe4d3767a35` | uc1: current morpheus source + same-operator callback-sharing fix; `game.session` module + 11 clone appIds registered/granted, all sharing the PlatformGame callback |

Notes: the testnet hash `0x4b882e94…` long recorded as "the oracle" is the
**retired v1 oracle** — all platform pointers now resolve to the v2 kernel
generation (shared kernel `0xf54d8584…`, operated by the oracle team; the
platform-operated instance above runs the same source build and unblocks the
game lane until the shared kernel's own upgrade lands). The RewardGame
settlement path is proven end-to-end on testnet through the private kernel
(start → finalize → signed fulfill → rich-dispatch settle → withdraw, with
the liability identity exact); see the joint verification report.

### Current vs target at a glance

| Concern | Today | v2 target |
| --- | --- | --- |
| App identity | off-chain manifest + generated TS constants | on-chain registry directory row per app |
| App treasury | none (funds sit in per-app contracts) | minted AppAccount contract per app |
| Per-app game logic | 34 standalone `MiniApp*` contracts | descriptor rows on shared engines; thin DevPack shims for bespoke logic |
| Shared logic | DevPack `Compile Include` source sharing | same mechanism, extended with `MiniAppEngineBase` |
| Registration | admin-run deploy scripts | permissionless `registerApp` (+ pipeline lane) |
| Extension | upgrade or deploy new standalone | new engine + one timelocked `registerEngine` row |

### Historical note

The pre-OS-v2 architecture (ModuleRegistry, RecipeRegistry,
MiniAppInstanceRegistry, ServiceGateway routing chain) was replaced by direct
OS service calls in March 2026; its design doc is retained at
`platform/_archive/COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md`. Those
contracts were removed from the repo — they are not in any in-tree archive
directory.
