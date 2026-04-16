# Platform Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 9 per-app smart contracts into 3 multi-tenant platform contracts (PlatformGame, PlatformDeFi, PlatformSocial) so miniapps register with a shared engine instead of deploying their own contracts.

**Architecture:** Each platform contract uses `appId`-prefixed storage keys to isolate state per miniapp. Miniapps register via `RegisterApp(appId, appType, config)` and interact through the same contract methods, with the `appId` parameter routing to the right tenant's state. Admin/pause/automation boilerplate lives once in the platform contract, not duplicated per app.

**Tech Stack:** Neo N3 C# smart contracts (.NET 10, Neo.SmartContract.Framework), neon-js for testnet validation

---

## File Structure

```
contracts/
  platform/
    PlatformGame/
      PlatformGame.cs              # Core: RegisterGame, admin, payment handler
      PlatformGame.Countdown.cs    # LastSurvivor logic (countdown pot game)
      PlatformGame.CoinFlip.cs     # FogPlay logic (oracle-backed coin flip)
      PlatformGame.Gacha.cs        # GASBox logic (gacha machine engine)
      PlatformGame.Storage.cs      # Namespaced storage helpers
      PlatformGame.csproj          # Project file
    PlatformDeFi/
      PlatformDeFi.cs              # Core: RegisterProduct, admin, payment handler
      PlatformDeFi.Lending.cs      # SelfLoan logic (collateral + borrow)
      PlatformDeFi.FlashLoan.cs    # FlashLoan logic (same-block borrow/repay)
      PlatformDeFi.Capsule.cs      # CompoundCapsule logic (time-lock + compound)
      PlatformDeFi.Storage.cs      # Namespaced storage helpers
      PlatformDeFi.csproj          # Project file
    PlatformSocial/
      PlatformSocial.cs            # Core: RegisterApp, admin, payment handler
      PlatformSocial.Envelope.cs   # RedEnvelope logic (create/split/claim)
      PlatformSocial.Trust.cs      # HeritageTrust logic (heartbeat/execute)
      PlatformSocial.Vault.cs      # UnbreakableVault logic (bounty/break)
      PlatformSocial.Storage.cs    # Namespaced storage helpers
      PlatformSocial.csproj        # Project file

  # Keep existing per-app contracts until platform contracts are deployed
  # and miniapps are migrated. Then delete.
```

### Key Design Decision: Namespaced Storage

Every storage key is prefixed with `appId` to isolate tenant state:

```csharp
// Instead of: Storage.Put(ctx, PREFIX_ROUND_ID, value)
// Platform:   Storage.Put(ctx, AppKey(appId, PREFIX_ROUND_ID), value)

private static byte[] AppKey(string appId, byte[] prefix)
{
    return Helper.Concat((ByteString)appId, (ByteString)prefix);
}
```

This means one PlatformGame contract can host multiple countdown games, each with their own round state, pot, players, etc.

---

### Task 1: Create PlatformGame contract — core + registration

**Files:**
- Create: `contracts/platform/PlatformGame/PlatformGame.cs`
- Create: `contracts/platform/PlatformGame/PlatformGame.Storage.cs`
- Create: `contracts/platform/PlatformGame/PlatformGame.csproj`

- [ ] **Step 1: Create the csproj**

```xml
<Project Sdk="Neo.SmartContract.Sdk/3.7.0">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <RootNamespace>NeoMiniApps.Platform</RootNamespace>
    <Nullable>enable</Nullable>
    <WarningsAsErrors>nullable</WarningsAsErrors>
  </PropertyGroup>
</Project>
```

- [ ] **Step 2: Create PlatformGame.Storage.cs — namespaced storage helpers**

```csharp
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniApps.Platform
{
    public partial class PlatformGame
    {
        // Namespace all storage keys by appId
        private static byte[] AppKey(string appId, byte[] prefix)
        {
            return Helper.Concat((ByteString)appId, (ByteString)prefix);
        }

        private static byte[] AppKey(string appId, byte[] prefix, BigInteger id)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)appId, (ByteString)prefix),
                (ByteString)id.ToByteArray());
        }

        private static byte[] AppKey(string appId, byte[] prefix, UInt160 addr)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)appId, (ByteString)prefix),
                (ByteString)(byte[])addr);
        }

        private static void AppPut(string appId, byte[] prefix, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, prefix), value);
        }

        private static BigInteger AppGetInt(string appId, byte[] prefix)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, prefix));
            return raw == null ? 0 : (BigInteger)raw;
        }
    }
}
```

- [ ] **Step 3: Create PlatformGame.cs — core contract with registration**

```csharp
using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniApps.Platform
{
    public enum GameType : byte
    {
        Countdown = 1,   // LastSurvivor-style
        CoinFlip = 2,    // FogPlay-style
        Gacha = 3,       // GASBox-style
    }

    [DisplayName("PlatformGame")]
    [ManifestExtra("Description", "Multi-tenant game engine for Neo N3 MiniApps")]
    [ContractPermission("*", "*")]
    public partial class PlatformGame : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_COUNT = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };

        // Per-app game state prefixes
        private static readonly byte[] PREFIX_GAME_TYPE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GAME_CONFIG = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_GAME_ACTIVE = new byte[] { 0x12 };

        public static void _deploy(object data, bool update)
        {
            if (!update)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)(byte[])Runtime.Transaction.Sender);
            }
        }

        [Safe]
        public static UInt160 Admin()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        private static void RequireAdmin()
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized");
        }

        /// <summary>
        /// Register a new game miniapp in this platform contract.
        /// </summary>
        public static void RegisterGame(string appId, GameType gameType, UInt160 appAdmin, ByteString config)
        {
            RequireAdmin();
            ExecutionEngine.Assert(appId != null && appId.Length > 0 && appId.Length <= 64, "invalid appId");
            ExecutionEngine.Assert(appAdmin != null && appAdmin.IsValid, "invalid admin");

            // Check not already registered
            ByteString existing = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_GAME_TYPE));
            ExecutionEngine.Assert(existing == null, "appId already registered");

            // Store registration
            AppPut(appId, PREFIX_GAME_TYPE, (BigInteger)gameType);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_APP_REGISTRY), (ByteString)(byte[])appAdmin);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_GAME_ACTIVE), 1);
            if (config != null && config.Length > 0)
            {
                Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_GAME_CONFIG), config);
            }

            BigInteger count = AppGetInt("", PREFIX_APP_COUNT) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_APP_COUNT, count);
        }

        [Safe]
        public static BigInteger GetGameType(string appId)
        {
            return AppGetInt(appId, PREFIX_GAME_TYPE);
        }

        [Safe]
        public static bool IsGameActive(string appId)
        {
            return AppGetInt(appId, PREFIX_GAME_ACTIVE) != 0;
        }

        private static void RequireAppAdmin(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_APP_REGISTRY));
            ExecutionEngine.Assert(raw != null, "app not registered");
            UInt160 appAdmin = (UInt160)raw;
            ExecutionEngine.Assert(
                Runtime.CheckWitness(appAdmin) || Runtime.CheckWitness(Admin()),
                "unauthorized for this app");
        }

        private static void RequireActive(string appId)
        {
            ExecutionEngine.Assert(IsGameActive(appId), "app paused");
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 caller = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(caller == GAS.Hash || caller == NEO.Hash, "only GAS/NEO accepted");
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            // Payment routing handled by game-type-specific methods
        }

        public static void update(ByteString nef, string manifest)
        {
            RequireAdmin();
            ContractManagement.Update(nef, manifest);
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add contracts/platform/PlatformGame/
git commit -m "feat: scaffold PlatformGame contract with registration + namespaced storage"
```

---

### Task 2: PlatformGame — Countdown game type (LastSurvivor pattern)

**Files:**
- Create: `contracts/platform/PlatformGame/PlatformGame.Countdown.cs`

- [ ] **Step 1: Implement countdown game logic as partial class**

Port the LastSurvivor business logic into the PlatformGame contract using `appId`-namespaced storage. Key methods:
- `StartCountdownRound(appId)` — admin starts a new round
- `BuyCountdownKeys(appId, player, keyCount)` — player buys keys via GAS
- `CheckCountdownRound(appId)` — check if round ended, distribute prizes
- `GetCountdownStatus(appId)` — read current round state

All storage uses `AppKey(appId, PREFIX_*)` pattern.

- [ ] **Step 2: Commit**

---

### Task 3: PlatformGame — CoinFlip game type (FogPlay pattern)

**Files:**
- Create: `contracts/platform/PlatformGame/PlatformGame.CoinFlip.cs`

- [ ] **Step 1: Implement coin flip logic**

Port FogPlay logic: `PlaceCoinFlipBet(appId, player, choice)`, `ResolveCoinFlip(appId, betId, result)`, `GetCoinFlipBet(appId, betId)`

- [ ] **Step 2: Commit**

---

### Task 4: PlatformGame — Gacha game type (GASBox pattern)

**Files:**
- Create: `contracts/platform/PlatformGame/PlatformGame.Gacha.cs`

- [ ] **Step 1: Implement gacha logic**

Port GASBox logic: `CreateGachaMachine(appId, config)`, `PullGacha(appId, machineId, player)`, `ResolveGacha(appId, playId, result)`

- [ ] **Step 2: Commit**

---

### Task 5: Create PlatformDeFi contract

**Files:**
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.cs`
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.Storage.cs`
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.Lending.cs`
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.FlashLoan.cs`
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.Capsule.cs`
- Create: `contracts/platform/PlatformDeFi/PlatformDeFi.csproj`

- [ ] **Step 1: Create core + Lending (SelfLoan pattern)**
- [ ] **Step 2: Add FlashLoan with reentrancy guard**
- [ ] **Step 3: Add Capsule (time-lock + compound)**
- [ ] **Step 4: Commit**

---

### Task 6: Create PlatformSocial contract

**Files:**
- Create: `contracts/platform/PlatformSocial/PlatformSocial.cs`
- Create: `contracts/platform/PlatformSocial/PlatformSocial.Storage.cs`
- Create: `contracts/platform/PlatformSocial/PlatformSocial.Envelope.cs`
- Create: `contracts/platform/PlatformSocial/PlatformSocial.Trust.cs`
- Create: `contracts/platform/PlatformSocial/PlatformSocial.Vault.cs`
- Create: `contracts/platform/PlatformSocial/PlatformSocial.csproj`

- [ ] **Step 1: Create core + Envelope (RedEnvelope pattern)**
- [ ] **Step 2: Add Trust (HeritageTrust pattern)**
- [ ] **Step 3: Add Vault (UnbreakableVault pattern)**
- [ ] **Step 4: Commit**

---

### Task 7: Update frontend rpc-helpers for platform contracts

**Files:**
- Modify: `platform/host-app/lib/rpc-helpers.ts`
- Modify: `platform/host-app/components/MiniAppPlayfield.tsx`

- [ ] **Step 1: Add platform contract hashes**

Once deployed, add the 3 platform contract hashes and update `getMiniAppContractHash` to return the appropriate platform contract + appId for each flagship.

- [ ] **Step 2: Update fetchAppStats to pass appId**
- [ ] **Step 3: Commit**

---

### Task 8: Remove old per-app contracts

**Files:**
- Delete: `contracts/MiniAppLastSurvivor/`
- Delete: `contracts/MiniAppGASBox/`
- Delete: `contracts/MiniAppFogPlay/`
- Delete: `contracts/MiniAppRedEnvelope/`
- Delete: `contracts/MiniAppSelfLoan/`
- Delete: `contracts/MiniAppFlashLoan/`
- Delete: `contracts/MiniAppCompoundCapsule/`
- Delete: `contracts/MiniAppHeritageTrust/`
- Delete: `contracts/MiniAppUnbreakableVault/`
- Delete: `contracts/MiniAppBase/`
- Delete: `contracts/MiniApp.DevPack/`

- [ ] **Step 1: Remove all per-app contracts**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

### Task 9: Deploy and register miniapps on testnet

**Files:**
- Create: `deploy/scripts/deploy_platform_contracts.js`

- [ ] **Step 1: Write deployment script**
- [ ] **Step 2: Deploy 3 platform contracts to testnet**
- [ ] **Step 3: Register all 7 flagships in the appropriate contract**
- [ ] **Step 4: Verify on-chain state**
- [ ] **Step 5: Commit**
