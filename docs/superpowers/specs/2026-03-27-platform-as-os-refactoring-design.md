# Platform-as-OS Refactoring Design

**Date**: 2026-03-27
**Status**: Superseded by 2026-03-31-miniapp-os-v2-design.md
**Scope**: Full platform refactoring to "Android OS for miniapps" model

## Vision

Transform the miniapp platform so that:
- **Platform = Android OS**: Manages lifecycle, provides services, standardizes UI
- **MiniApps = Android Apps**: Only implement their unique "play area", consume platform services
- **Smart Contracts = Universal Modules**: Composable capabilities via ModuleRegistry, not per-app contracts

## Current State

The platform already has strong foundations:
- `MiniAppPage.vue` (3-column layout), `createMiniApp()` factory, 37 shared components
- `useContractInteraction`, `useOracle`, `useAbstractAccount` composables
- `ModuleRegistry`, `RecipeRegistry`, `MiniAppInstanceRegistry` on-chain (Phase-1 skeleton)
- `COMPOSABLE_MINIAPP_PLATFORM_ARCHITECTURE.md` with composition vision

**Gaps**:
1. No unified platform service layer — miniapps wire composables manually
2. No explicit "play area" concept — miniapps still build full pages
3. Module/Recipe system stores opaque schemas, no runtime resolution
4. Each miniapp has its own domain composable reimplementing common patterns
5. 60+ miniapps with duplicated service integration boilerplate

## Design

### Phase 1: Platform Service Layer

Create `apps/shared/services/` — the "Android OS services" that every miniapp consumes.

```
apps/shared/services/
  index.ts              — Public exports
  PlatformServices.ts   — Central service registry (the "OS kernel")
  ChainService.ts       — Contract reads, writes, event watching
  BalanceService.ts     — Token balances with caching & watching
  TransferService.ts    — Token transfers with fee estimation
  OracleService.ts      — Oracle, VRF, compute, datafeed (wraps useOracle)
  AAService.ts          — Account abstraction, gas sponsorship (wraps useAbstractAccount)
  EventBus.ts           — Cross-component pub/sub event system
  CacheService.ts       — Unified caching (memory + localStorage)
  LifecycleService.ts   — App mount/unmount/pause/resume lifecycle
```

**PlatformServices** is a singleton per miniapp instance:

```typescript
interface PlatformServices {
  readonly appId: string
  readonly chain: ChainService
  readonly balance: BalanceService
  readonly transfer: TransferService
  readonly oracle: OracleService
  readonly aa: AAService
  readonly events: EventBus
  readonly cache: CacheService
  readonly lifecycle: LifecycleService
}
```

Each service wraps the existing composables but provides:
- Consistent error handling
- Automatic caching where appropriate
- Event bus integration (operations emit events)
- Lifecycle awareness (services pause when miniapp is backgrounded)

### Phase 2: Simplified MiniApp API (`defineMiniApp`)

Replace the current 4-layer pattern with a single entry point:

**Current** (verbose):
```
App.vue → StandardAppShell → IndexPage → createMiniApp() → usePage() → useDomainContract()
```

**Target** (minimal):
```
main.ts → defineMiniApp({ appId, playArea, manifest, messages })
```

```typescript
// apps/shared/utils/defineMiniApp.ts
interface MiniAppDefinition {
  appId: string
  playArea: Component           // The ONLY custom component
  manifest: MiniAppManifest     // Declarative config (tabs, stats, operations)
  messages?: LocaleMessages     // Optional i18n
  services?: string[]           // Which platform services to request
  setup?: (ctx: MiniAppContext) => void  // Optional setup hook
}

function defineMiniApp(definition: MiniAppDefinition): App
```

The `MiniAppManifest` drives everything else:

```typescript
interface MiniAppManifest {
  name: string
  description: string
  icon: string
  category: 'game' | 'defi' | 'social' | 'tool' | 'governance'

  // Shell configuration
  shell: 'launcher' | 'console' | 'market' | 'game'
  theme?: ThemeProfile

  // Layout sections (all config-driven, platform renders them)
  hero?: HeroConfig
  stats?: StatConfig[]
  tabs?: TabConfig[]
  operations?: OperationConfig[]
  docs?: DocSection[]

  // Sidebar (platform renders, miniapp provides data bindings)
  sidebar?: SidebarConfig

  // Contract binding (which module/contract to use)
  contract?: ContractBinding

  // Permissions requested from platform
  permissions?: PermissionSet
}
```

### Phase 3: Universal MiniApp Template

Enhance `MiniAppPage.vue` to be fully config-driven:

```
+------------------------------------------+
|  SIDEBAR          |  PLAY AREA    | OPS  |
|  (platform)       |  (miniapp)    | PANEL|
|                   |               | (plat|
|  - Brand/title    |  [Custom Vue  | form)|
|  - Tab nav        |   Component]  |      |
|  - Stats display  |               |      |
|  - Status info    |               |      |
+------------------------------------------+
|  TABS SECTION (platform-rendered)        |
|  [Stats] [History] [Activity] [Docs]     |
+------------------------------------------+
```

The miniapp provides ONLY the `PlayArea` component. Everything else — sidebar, operation panel, tabs, docs, comments, stats — is rendered by the platform from manifest config.

### Phase 4: Contract Composability

Enhance the module system so miniapps can use shared contracts:

1. **Concrete Capability Modules**: Implement real modules for common patterns:
   - `module.prepaid_gas` — Direct GAS prepayment + consume pattern
   - `module.oracle_rng` — Oracle RNG request + callback
   - `module.oracle_price` — Price feed consumption
   - `module.funding_vault` — Already exists, refine interface
   - `module.stream_vesting` — Already exists, refine interface
   - `module.checkin` — Check-in with streak tracking
   - `module.leaderboard` — On-chain leaderboard/ranking
   - `module.ticket_nft` — Ticket/NFT minting

2. **Runtime Resolution**: ModuleRegistry and ServiceGateway resolve module addresses at runtime so miniapps don't hardcode contract hashes.

3. **Universal MiniApp Contract**: A single `MiniAppConsumer` contract that any miniapp can use as its on-chain endpoint, routing operations to registered modules via ServiceGateway.

### Phase 5: Miniapp Migration

Refactor all 60+ miniapps to use the new pattern:
- Replace manual composable wiring with `defineMiniApp()`
- Replace per-app domain composables with platform service calls
- Replace custom layout code with manifest-driven configuration
- Replace per-app contracts with module composition where possible

## Architecture Layers (Final State)

```
Layer 5: MiniApp Play Areas (custom Vue components — minimal code)
Layer 4: MiniApp Manifests (declarative JSON/TS config)
Layer 3: Platform Services (chain, balance, transfer, oracle, AA, events, cache)
Layer 2: Platform Shell (MiniAppPage, StandardAppShell, operation panel, tabs)
Layer 1: Platform Core (SDK, edge functions, host app, wallet adapter)
Layer 0: Blockchain (Neo N3 contracts: ModuleRegistry, RecipeRegistry, shared modules)
```

## Implementation Priority

1. Platform Service Layer (`apps/shared/services/`)
2. `defineMiniApp()` simplified API
3. Enhanced MiniAppPage with explicit play area
4. Refactor flagship miniapps (daily-checkin, burn-league, coin-flip) as reference
5. Contract capability modules
6. Migrate remaining miniapps

## Success Criteria

- A new miniapp can be created with <50 lines of code (play area + manifest)
- All service integration (chain, oracle, AA, events) via platform services
- Consistent look and feel across all miniapps (only play area differs)
- Platform manages lifecycle (mount, data loading, error handling, cleanup)
- Smart contracts use shared modules, not per-app custom contracts
