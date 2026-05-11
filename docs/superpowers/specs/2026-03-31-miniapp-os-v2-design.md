# MiniApp-OS v2: System Service Contract Architecture

**Date**: 2026-03-31
**Status**: Implemented (2026-03-30)
**Supersedes**: Earlier Platform-as-OS refactoring design notes removed during repository cleanup
**Scope**: Complete platform refactoring — OS service contracts, ScriptEngine, frontend PlatformContext, edge proxy layer, legacy cleanup

> **Implementation Complete (2026-03-30):** This design has been fully
> implemented across 51 commits. Key completion milestones:
>
> - **10 OS service contracts** built and deployed under `contracts/os-*/`
> - **10 typed frontend proxy classes** in `apps/shared/services/os/`
> - **45 OS Binder edge functions** in `platform/edge/functions/os-*/`
> - **All 7 flagship apps** migrated to OS services
> - **27 total apps** using OS services via `defineMiniApp()` + `ctx.os.*`
> - **Zero App.legacy.vue** files remaining — all apps on modern pattern
> - **169 legacy files removed** during cleanup
> - **189 new tests** covering OS proxies, shared services, edge utilities
> - **SaaS integrations** added: Sentry (errors), PostHog (analytics), Supabase Realtime (notifications)
> - **31 files** fixed for type safety with proper interfaces
> - ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, ServiceGateway archived
> - UX improvements: i18n, wallet error handling, mobile, accessibility, confirmations
>
> See `docs/ARCHITECTURE.md` for the current runtime documentation.

## Vision

Transform the platform from "composable module registry + per-app contracts" to a true **Android OS model** where:

- **OS contract layer** provides direct system services (storage, payment, game, badges, etc.)
- **MiniApps call OS services directly** — no module registry, no recipe binding, no service gateway routing
- **ScriptEngine** enables custom on-chain NeoVM bytecode execution at hook points
- **Most miniapps need ZERO custom contracts** — they declare a manifest and call OS services
- **Platform handles ALL IO, communication, callbacks, lifecycle** — miniapps only implement business logic

## Architectural Shift

### Before (Current — 4-hop indirect routing)

```
MiniApp Frontend
  → composable (useCheckin, useLastSurvivor, etc.)
    → ChainService.invoke(INDIVIDUAL_CONTRACT_HASH, method, params)
      → Individual miniapp contract (45 separate contracts)
        → Each implements: payment, storage, badges, player tracking, settlement

Shared modules (ModuleRegistry → RecipeRegistry → InstanceRegistry → ServiceGateway):
  → 4-hop resolution chain to call a shared module
  → Each module requires instance registration + binding
```

### After (OS model — direct service calls)

```
MiniApp Frontend
  → PlatformContext.os.checkin.checkIn(appId)
    → Edge function (Binder proxy: auth + rate limit + permission check)
      → CheckinService contract (OS system service)
        → ScriptEngine.Execute(appId, "onCheckin", context) [if script registered]

No ModuleRegistry. No RecipeRegistry. No InstanceRegistry. No ServiceGateway.
Direct calls to OS services, scoped by appId.
```

## OS System Service Contracts

### Contract Inventory (15 contracts)

#### NEW contracts to build (6):

1. **StorageService** — On-chain KV storage scoped by appId
2. **PaymentService** — Deposits, withdrawals, transfers, fee management
3. **GameService** — Betting pools, RNG integration, settlement framework
4. **EscrowService** — Lock/release/refund with milestone tracking
5. **NFTService** — Mint/transfer/burn with soulbound and ticket modes
6. **ScriptEngine** — On-chain NeoVM bytecode execution at hook points

#### PROMOTE existing modules to direct services (4):

7. **BadgeService** — from StatsBadgeModule (remove instance binding requirement)
8. **LeaderboardService** — from LeaderboardModule (remove instance binding requirement)
9. **CheckinService** — from CheckinModule (remove instance binding requirement)
10. **VestingService** — from StreamVesting (remove instance registration, make appId-scoped)

#### KEEP as-is (5):

11. **AppRegistry** — enhance with action declarations and script registration tracking
12. **PauseRegistry** — emergency stop (already correct)
13. **OracleService** — external data (already correct)
14. **AutomationAnchor** — periodic tasks (already correct)
15. **RandomnessLog** — VRF anchor (already correct)

#### DEPRECATE (4 + 45):

- ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, ServiceGateway
- All 45 individual miniapp contracts (replaced by OS service calls + ScriptEngine)

### Contract Specifications

#### 1. StorageService

Android analog: ContentProvider + StorageManager

```csharp
// Scoped KV storage — each app can only access its own namespace
public static void Set(ByteString appId, string key, ByteString value)
public static ByteString Get(ByteString appId, string key)
public static void Delete(ByteString appId, string key)
public static Map ListKeys(ByteString appId, string prefix, int limit)
public static void BatchSet(ByteString appId, string[] keys, ByteString[] values)

// Cross-app data sharing (ContentProvider pattern)
public static void GrantReadAccess(ByteString ownerAppId, ByteString readerAppId, string keyPrefix)
public static void RevokeAccess(ByteString ownerAppId, ByteString readerAppId, string keyPrefix)
public static ByteString ReadShared(ByteString readerAppId, ByteString ownerAppId, string key)

// Authorization: app developer/operator OR ScriptEngine executing on behalf of app
// Storage layout: 0x01 admin, 0x10 data (appId + key → value), 0x20 permissions

// Events:
// DataSet(appId, key), DataDeleted(appId, key), AccessGranted(owner, reader, prefix)
```

#### 2. PaymentService

Android analog: ConnectivityManager for money

```csharp
// Per-app balance tracking (replaces per-contract OnNEP17Payment)
public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
  // data = appId — routes deposit to the correct app's balance pool

// Balance management
public static BigInteger GetBalance(ByteString appId, UInt160 user)
public static BigInteger GetAppPool(ByteString appId)
public static void Withdraw(ByteString appId, UInt160 user, BigInteger amount)
public static void Transfer(ByteString appId, UInt160 from, UInt160 to, BigInteger amount)
public static void DistributePrize(ByteString appId, UInt160[] recipients, BigInteger[] amounts)

// Fee configuration (platform fee + developer fee)
public static void SetFeeConfig(ByteString appId, int platformBps, int devBps, UInt160 devAddress)
public static BigInteger GetPlatformFees()  // accumulated platform fees
public static void ClaimPlatformFees()      // admin only

// Hook: after deposit, calls ScriptEngine("onPaymentReceived") if registered
// Authorization: user for own balance, app operator for app pool, admin for platform
// Storage: 0x01 admin, 0x10 user balances (appId + user → amount),
//          0x20 app pools, 0x30 fee config, 0x40 platform fees

// Events:
// Deposited(appId, user, amount), Withdrawn(appId, user, amount),
// Transferred(appId, from, to, amount), PrizeDistributed(appId, recipients),
// FeeCollected(appId, platformFee, devFee)
```

#### 3. GameService

Android analog: Gaming framework

```csharp
// Pool management
public static ByteString CreatePool(ByteString appId, ByteString configJson)
  // config: { type: "countdown"|"pvp"|"lottery", maxPlayers, entryFee, duration, ... }
public static void ClosePool(ByteString appId, ByteString poolId)

// Player actions
public static void JoinPool(ByteString appId, ByteString poolId, UInt160 player)
public static void PlaceBet(ByteString appId, ByteString poolId, UInt160 player, BigInteger amount)
  // Deducts from PaymentService balance

// Settlement
public static void Settle(ByteString appId, ByteString poolId, ByteString resultJson)
  // resultJson: { winners: [...], amounts: [...] }
  // Calls PaymentService.DistributePrize internally
  // Calls ScriptEngine("onSettlement") if registered

// Queries
public static ByteString GetPoolState(ByteString appId, ByteString poolId)
public static ByteString GetPlayerState(ByteString appId, ByteString poolId, UInt160 player)

// Built-in safety: cooldowns, bet limits, max players, anti-replay nonces
// Authorization: app operator for pool management, players for bet/join
// Storage: 0x01 admin, 0x10 pools, 0x20 player states, 0x30 settlement history

// Events:
// PoolCreated(appId, poolId, config), PlayerJoined(appId, poolId, player),
// BetPlaced(appId, poolId, player, amount), PoolSettled(appId, poolId, results)
```

#### 4. EscrowService

```csharp
public static ByteString CreateEscrow(ByteString appId, ByteString paramsJson)
  // params: { depositor, beneficiary, amount, milestones: [{name, amount}], expiry }
public static void FundEscrow(ByteString appId, ByteString escrowId)
  // Locks funds from PaymentService
public static void CompleteMilestone(ByteString appId, ByteString escrowId, int milestoneIndex)
  // Releases milestone amount to beneficiary
public static void Refund(ByteString appId, ByteString escrowId)
  // Returns remaining to depositor
public static ByteString GetEscrow(ByteString appId, ByteString escrowId)

// Calls ScriptEngine("onEscrowStateChange") at each state transition
// Authorization: depositor for funding/refund, operator for milestone completion
// Storage: 0x01 admin, 0x10 escrows (appId + escrowId → state)

// Events:
// EscrowCreated(appId, escrowId), EscrowFunded(appId, escrowId, amount),
// MilestoneCompleted(appId, escrowId, index), EscrowRefunded(appId, escrowId)
```

#### 5. NFTService

```csharp
// Minting
public static ByteString Mint(ByteString appId, UInt160 owner, ByteString metadataJson)
  // metadataJson: { name, description, image, attributes, soulbound, expiry }
public static void BatchMint(ByteString appId, UInt160[] owners, ByteString[] metadatas)

// Transfer (respects soulbound flag)
public static void Transfer(ByteString appId, ByteString tokenId, UInt160 to)
public static void Burn(ByteString appId, ByteString tokenId)

// Queries
public static ByteString GetToken(ByteString appId, ByteString tokenId)
public static ByteString[] GetTokensByOwner(ByteString appId, UInt160 owner, int limit)

// Ticket mode
public static void Validate(ByteString appId, ByteString tokenId)  // marks ticket as used
public static bool IsValid(ByteString appId, ByteString tokenId)

// Authorization: app operator for minting, token owner for transfer/burn
// Storage: 0x01 admin, 0x10 tokens (appId + tokenId → metadata),
//          0x20 owner index, 0x30 supply counters

// Events:
// Minted(appId, tokenId, owner), Transferred(appId, tokenId, from, to),
// Burned(appId, tokenId), Validated(appId, tokenId)
```

#### 6. ScriptEngine

Android analog: Dalvik/ART VM for custom app logic

```csharp
// Script registration
public static void RegisterScript(ByteString appId, string hookPoint, ByteString nefBytes, ByteString manifestBytes)
  // hookPoint: "onPaymentReceived" | "onSettlement" | "onCheckin" | "onBadgeAwarded" |
  //            "onEscrowStateChange" | "onCustom:<name>"
  // nefBytes: compiled NeoVM bytecode (NEF format)
  // manifestBytes: NEP-15 manifest for the script contract
  // Validates: caller is app developer (from AppRegistry), script size within limits

public static void UnregisterScript(ByteString appId, string hookPoint)

// Execution (called by other OS services, not by miniapps directly)
public static ByteString Execute(ByteString appId, string hookPoint, ByteString contextData)
  // contextData: serialized { caller, amount, method, params, timestamp, ... }
  // 1. Looks up registered script for appId + hookPoint
  // 2. Deploys script temporarily (or calls pre-deployed contract)
  // 3. Invokes script.Execute(appId, contextData) with gas limit
  // 4. Returns script output
  // 5. If script exceeds gas limit → revert script effects, emit GasExceeded event

// Queries
public static ByteString GetScript(ByteString appId, string hookPoint)
public static string[] ListHookPoints(ByteString appId)

// Safety controls
public static void SetGasLimit(ByteString appId, string hookPoint, BigInteger maxGas)
  // Default: 5 GAS per execution
public static void DisableScript(ByteString appId, string hookPoint)  // admin only
public static void SetGlobalScriptPause(bool paused)  // admin only

// Script sandbox:
// - Scripts CAN: read/write StorageService (own appId only), return values, emit events
// - Scripts CANNOT: call external contracts, transfer assets, modify other apps, deploy contracts
// - Scripts are stateless between invocations (state goes in StorageService)

// Authorization: app developer for register/unregister, OS services for execute, admin for disable
// Storage: 0x01 admin, 0x10 scripts (appId + hookPoint → nef + manifest),
//          0x20 gas limits, 0x30 execution counters

// Events:
// ScriptRegistered(appId, hookPoint, scriptHash), ScriptUnregistered(appId, hookPoint),
// ScriptExecuted(appId, hookPoint, gasUsed, success), ScriptGasExceeded(appId, hookPoint),
// ScriptDisabled(appId, hookPoint)
```

#### 7-10. Promoted Services (BadgeService, LeaderboardService, CheckinService, VestingService)

These already exist as modules. The promotion involves:

1. **Remove instance registration requirement** — no more `InitializeInstance(instanceId, owner, operator)`
2. **Scope everything by appId** — from AppRegistry, not from instance registry
3. **Remove ServiceGateway dependency** — direct calls, no routing
4. **Add ScriptEngine hooks** — call scripts at relevant points

Example for **CheckinService** (promoted from CheckinModule):

```csharp
// BEFORE (current CheckinModule):
public static void InitializeInstance(ByteString instanceId, UInt160 owner, ...) // Complex setup
public static void CheckIn(ByteString instanceId, UInt160 user)                  // Instance-scoped

// AFTER (OS CheckinService):
public static void Configure(ByteString appId, ByteString configJson)            // App-scoped, simple
  // config: { intervalSeconds, rewardPerCheckin, minStreakForReward }
public static void CheckIn(ByteString appId, UInt160 user)                       // Direct call
  // → Updates streak → Calls ScriptEngine("onCheckin", {user, streak}) if registered
public static void ClaimRewards(ByteString appId, UInt160 user)
  // → Calls PaymentService.Withdraw internally
public static ByteString GetStreak(ByteString appId, UInt160 user)
public static ByteString GetStats(ByteString appId)
```

Same pattern for Badge, Leaderboard, and Vesting: remove instance indirection, scope by appId, add script hooks.

#### AppRegistry Enhancement

Add to existing AppRegistry:

```csharp
// NEW: Action declarations (Android intent-filter equivalent)
public static void DeclareActions(ByteString appId, ByteString actionsJson)
  // actionsJson: [{ name: "SWAP_TOKENS", category: "DEFI", dataTypes: ["token-pair"] }]
public static ByteString ResolveAction(string actionName)
  // Returns list of appIds that handle this action (implicit intent resolution)

// NEW: Service permissions (which OS services this app can use)
public static void SetPermissions(ByteString appId, ByteString permissionsJson)
  // permissionsJson: ["storage", "payment", "game", "badge", "checkin", "script"]
public static bool HasPermission(ByteString appId, string serviceName)

// NEW: Script tracking (which hook points have registered scripts)
public static void RecordScriptRegistration(ByteString appId, string hookPoint, UInt160 scriptHash)
```

## Frontend Architecture

### PlatformContext (Android Context equivalent)

File: `apps/shared/services/PlatformContext.ts` (new)

```typescript
export interface PlatformContext {
  // ---- App Identity ----
  appId: string
  manifest: MiniAppManifest

  // ---- i18n ----
  t: (key: string, params?: Record<string, string>) => string

  // ---- Action Registration ----
  registerAction: (name: string, handler: (...args: any[]) => Promise<void>) => void

  // ---- Existing Platform Services (enhanced, not replaced) ----
  services: {
    chain: ChainService          // Low-level chain access (still available)
    balance: BalanceService      // Balance queries
    transfer: TransferService    // Raw transfers
    oracle: OracleService        // Oracle/VRF
    events: EventBus             // Cross-component events
    aa: AAService                // Abstract account
    cache: CacheService          // Client-side caching
    notify: NotificationService  // Toast/guard notifications
    clipboard: ClipboardService  // Copy to clipboard
    fmt: FormattingService       // Number/date formatting
  }

  // ---- NEW: OS Service Proxies (call OS contracts through edge) ----
  os: {
    storage: StorageProxy        // → StorageService contract
    payment: PaymentProxy        // → PaymentService contract
    game: GameProxy              // → GameService contract
    vesting: VestingProxy        // → VestingService contract
    escrow: EscrowProxy          // → EscrowService contract
    badge: BadgeProxy            // → BadgeService contract
    leaderboard: LeaderboardProxy // → LeaderboardService contract
    checkin: CheckinProxy        // → CheckinService contract
    nft: NFTProxy                // → NFTService contract
    script: ScriptProxy          // → ScriptEngine contract (dev only)
  }

  // ---- Lifecycle ----
  onActivate: (callback: () => void) => void
  onDeactivate: (callback: () => void) => void
  onDestroy: (callback: () => void) => void
}
```

### OS Service Proxy Pattern

Each OS proxy follows the same pattern. File: `apps/shared/services/os/StorageProxy.ts` (example)

```typescript
export class StorageProxy {
  constructor(private appId: string, private edge: EdgeClient) {}

  async get(key: string): Promise<any> {
    return this.edge.call('os-storage-get', { appId: this.appId, key })
  }

  async set(key: string, value: any): Promise<void> {
    await this.edge.call('os-storage-set', { appId: this.appId, key, value })
  }

  async delete(key: string): Promise<void> {
    await this.edge.call('os-storage-delete', { appId: this.appId, key })
  }

  async list(prefix: string, limit = 100): Promise<string[]> {
    return this.edge.call('os-storage-list', { appId: this.appId, prefix, limit })
  }
}
```

All proxies:
- Inject `appId` automatically (miniapp cannot forge identity, like Binder UID)
- Route through edge functions (permission enforcement)
- Handle errors uniformly
- Support caching where appropriate

### defineMiniApp Enhancement

File: `apps/shared/utils/defineMiniApp.ts` (enhance existing)

```typescript
// Enhanced to inject OS services into context
export function defineMiniApp(config: {
  appId: string
  playArea: Component
  manifest: MiniAppManifest
  messages: Messages
  setup: (ctx: PlatformContext) => MiniAppSetupResult
}) {
  // ... existing logic ...

  // NEW: Create OS service proxies
  const edge = new EdgeClient(config.appId)
  const os = {
    storage: new StorageProxy(config.appId, edge),
    payment: new PaymentProxy(config.appId, edge),
    game: new GameProxy(config.appId, edge),
    vesting: new VestingProxy(config.appId, edge),
    escrow: new EscrowProxy(config.appId, edge),
    badge: new BadgeProxy(config.appId, edge),
    leaderboard: new LeaderboardProxy(config.appId, edge),
    checkin: new CheckinProxy(config.appId, edge),
    nft: new NFTProxy(config.appId, edge),
    script: new ScriptProxy(config.appId, edge),
  }

  // Inject into context
  const ctx: PlatformContext = {
    appId: config.appId,
    manifest: config.manifest,
    services: platformServices,
    os,
    t, registerAction, onActivate, onDeactivate, onDestroy
  }

  return config.setup(ctx)
}
```

## Edge Layer (Binder Proxy)

### New Edge Functions

Each OS service gets edge functions that enforce the security boundary:

```
platform/edge/functions/
  os-storage-get/index.ts
  os-storage-set/index.ts
  os-storage-delete/index.ts
  os-storage-list/index.ts
  os-payment-deposit/index.ts
  os-payment-withdraw/index.ts
  os-payment-transfer/index.ts
  os-payment-balance/index.ts
  os-game-create/index.ts
  os-game-bet/index.ts
  os-game-settle/index.ts
  os-game-status/index.ts
  os-badge-define/index.ts
  os-badge-award/index.ts
  os-badge-list/index.ts
  os-leaderboard-submit/index.ts
  os-leaderboard-get/index.ts
  os-leaderboard-reset/index.ts
  os-checkin-checkin/index.ts
  os-checkin-streak/index.ts
  os-checkin-claim/index.ts
  os-nft-mint/index.ts
  os-nft-transfer/index.ts
  os-nft-list/index.ts
  os-escrow-create/index.ts
  os-escrow-fund/index.ts
  os-escrow-complete/index.ts
  os-escrow-refund/index.ts
  os-script-register/index.ts
  os-script-list/index.ts
```

### Edge Function Pattern

Each edge function follows the same structure:

```typescript
import { serve } from "https://deno.land/std/http/server.ts"
import { validateAuth } from "../_shared/supabase.ts"
import { validatePermission } from "../_shared/apps.ts"
import { rateLimit } from "../_shared/ratelimit.ts"
import { neoRpc } from "../_shared/neo-rpc.ts"

serve(async (req) => {
  // 1. Auth
  const user = await validateAuth(req)

  // 2. Parse
  const { appId, ...params } = await req.json()

  // 3. Permission check (does this app's manifest allow this service?)
  await validatePermission(appId, "storage")

  // 4. Rate limit
  await rateLimit(user.id, appId, "os-storage-set")

  // 5. Call OS contract
  const result = await neoRpc.invokeContract(
    STORAGE_SERVICE_HASH,
    "set",
    [appId, params.key, params.value]
  )

  // 6. Return
  return new Response(JSON.stringify(result))
})
```

## Miniapp Migration Examples

### Daily Checkin: Before (2,491 LOC) → After (~150 LOC)

**Before**: Custom contract (MiniAppDailyCheckin.cs, ~800 LOC) + composable (useCheckin.ts, ~400 LOC) + PlayArea (600 LOC) + manifest/messages (700 LOC)

**After**: No custom contract. Manifest + setup + PlayArea only.

```typescript
// main.ts (~40 LOC)
defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const streak = ref(0)
    const rewards = ref('0')
    const lastCheckin = ref(0)
    const canCheckIn = computed(() => Date.now() - lastCheckin.value > 86400000)

    const loadData = async () => {
      const data = await ctx.os.checkin.getStreak(ctx.appId)
      streak.value = data.currentStreak
      rewards.value = data.unclaimedRewards
      lastCheckin.value = data.lastCheckinTime
    }

    ctx.registerAction("checkIn", async () => {
      await ctx.os.checkin.checkIn(ctx.appId)
      ctx.services.notify.toast(ctx.t("checkedIn"))
      await loadData()
    })

    ctx.registerAction("claim", async () => {
      await ctx.os.checkin.claimRewards(ctx.appId)
      ctx.services.notify.toast(ctx.t("claimed"))
      await loadData()
    })

    return { state: { streak, rewards, canCheckIn, lastCheckin }, loadData }
  }
})
```

Custom on-chain logic (badge awards on streak milestones) is in a registered script:

```csharp
// Registered via ScriptEngine.RegisterScript(appId, "onCheckin", nefBytes, manifestBytes)
// This is a small compiled C# contract (~50 LOC)
public static void Execute(ByteString appId, ByteString contextData) {
    var ctx = (Map<string, object>)StdLib.Deserialize(contextData);
    var streak = (BigInteger)ctx["streak"];
    var user = (UInt160)ctx["user"];

    // Award milestone badges
    if (streak == 7)
        Contract.Call(BadgeServiceHash, "Award", CallFlags.All, appId, "streak-7", user);
    else if (streak == 30)
        Contract.Call(BadgeServiceHash, "Award", CallFlags.All, appId, "streak-30", user);
    else if (streak == 100)
        Contract.Call(BadgeServiceHash, "Award", CallFlags.All, appId, "streak-100", user);
}
```

### LastSurvivor: Before (2,527 LOC) → After (~400 LOC)

**Before**: Custom contract (MiniAppLastSurvivor.cs, ~1200 LOC multi-file) + composable + PlayArea

**After**: Uses GameService + PaymentService + custom settlement script

```typescript
// main.ts (~80 LOC)
defineMiniApp({
  appId: "miniapp-lastsurvivor",
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const pool = ref(null)
    const countdown = ref(0)

    const loadData = async () => {
      pool.value = await ctx.os.game.getPoolState(ctx.appId, "current")
      // countdown calculated from pool state
    }

    ctx.registerAction("buyKey", async (count: number) => {
      const cost = pool.value.keyPrice * count
      await ctx.os.payment.deposit(ctx.appId, cost)
      await ctx.os.game.placeBet(ctx.appId, "current", count)
      await loadData()
    })

    ctx.registerAction("claimPrize", async () => {
      // Settlement done by AutomationAnchor → GameService.Settle → ScriptEngine
      await ctx.os.payment.withdraw(ctx.appId)
      await loadData()
    })

    return { state: { pool, countdown }, loadData }
  }
})
```

Custom game logic in registered script for "onPaymentReceived" and "onSettlement" hooks.

## Cleanup & Deprecation Plan

### Files/Directories to Remove

```
contracts/ModuleRegistry/              → Replaced by direct OS services
contracts/RecipeRegistry/              → Replaced by manifest declarations
contracts/MiniAppInstanceRegistry/     → No more instance binding
contracts/ServiceGateway/              → No more routing kernel
contracts/MiniApp.DevPack/MiniAppGameBase.cs    → GameService absorbs this
contracts/MiniApp.DevPack/MiniAppServiceBase.cs → OS services handle callbacks
contracts/MiniApp.DevPack/MiniAppComputeBase.cs → ScriptEngine replaces
contracts/MiniApp.DevPack/MiniAppGameComputeBase.cs → GameService + ScriptEngine

# Individual miniapp contracts (45 total) — phase out after migration:
contracts/MiniAppDailyCheckin/
contracts/MiniAppLastSurvivor/
contracts/MiniAppGASBox/
contracts/MiniAppRedEnvelope/
contracts/MiniAppDiceGame/
... (all 45)

# Legacy frontend patterns:
apps/*/App.legacy.vue                  → All apps use defineMiniApp() modern pattern
apps/*/pages/                          → Replaced by PlayArea.vue + manifest
```

### Files to Keep but Simplify

```
contracts/MiniApp.DevPack/MiniAppBase.cs       → Simplified, used as base for ScriptEngine scripts
contracts/MiniApp.DevPack/MiniAppCompactBase.cs → Lightweight script base
contracts/MiniAppFactory/                       → Repurpose for script deployment
```

### Frontend Migration (50 legacy → modern)

All 50 legacy apps need migration from:
```
App.legacy.vue → pages/index/ → createMiniApp() → composable chain
```
To:
```
main.ts → defineMiniApp({ playArea, manifest, setup(ctx) { ... } })
```

With business logic calling `ctx.os.*` services instead of `ctx.services.chain.invoke(CONTRACT_HASH, ...)`.

## Implementation Phases

### Phase 1: OS Contract Foundation
- Build StorageService, PaymentService, ScriptEngine contracts
- Enhance AppRegistry with permissions and action declarations
- Deploy to testnet

### Phase 2: Promote Existing Modules
- Promote CheckinModule → CheckinService (remove instance binding)
- Promote LeaderboardModule → LeaderboardService
- Promote StatsBadgeModule → BadgeService
- Promote StreamVesting → VestingService
- Deploy to testnet

### Phase 3: Build Remaining Services
- Build GameService, EscrowService, NFTService
- Integration test all services together
- ScriptEngine safety validation

### Phase 4: Frontend OS Layer
- Create OS proxy classes in apps/shared/services/os/
- Enhance PlatformContext with os property
- Enhance defineMiniApp() to inject OS proxies
- Create EdgeClient for standardized edge communication

### Phase 5: Edge Binder Layer
- Create 30 new edge functions for OS service access
- Standardized auth + permission + rate limit pattern
- Shared edge utilities for OS service calling

### Phase 6: Migrate Flagship Apps (7)
- Migrate DailyCheckin, LastSurvivor, GASBOX, RedEnvelope, NeoPay, SelfLoan, FogPlay
- Write custom scripts for each (ScriptEngine)
- Validate identical behavior
- Deploy to testnet, smoke test

### Phase 7: Migrate Remaining Apps (48)
- Batch migrate all remaining miniapps
- Remove legacy patterns
- Update documentation

### Phase 8: Deprecation & Cleanup
- Remove ModuleRegistry, RecipeRegistry, MiniAppInstanceRegistry, ServiceGateway
- Remove all 45 individual miniapp contracts
- Remove MiniAppGameBase and other deprecated base classes
- Remove legacy App.legacy.vue files
- Archive old contracts in _archive/
- Update all documentation

## Testing Strategy

- **Unit tests**: Each OS service contract tested independently
- **Integration tests**: Service-to-service calls (PaymentService → ScriptEngine)
- **ScriptEngine safety tests**: Gas limits, sandbox enforcement, malicious script rejection
- **Migration parity tests**: Verify migrated apps produce identical on-chain state
- **E2E smoke tests**: Run existing flagship validation suite against OS services
- **Regression tests**: Ensure no breaking changes during migration

## Success Criteria

1. **Zero custom contracts needed for 80%+ of miniapps** — they just call OS services
2. **ScriptEngine handles the remaining 20%** — custom logic as registered scripts
3. **All 55 miniapps on modern defineMiniApp() pattern** — no legacy App.legacy.vue
4. **4-hop routing chain eliminated** — direct OS service calls only
5. **Frontend LOC per miniapp reduced 60-80%** — from ~2500 to ~400 average
6. **All existing flagship user flows preserved** — no regression
