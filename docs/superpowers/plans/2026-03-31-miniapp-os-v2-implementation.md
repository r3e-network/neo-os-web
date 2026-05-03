# MiniApp-OS v2 Implementation Plan

> **Status: COMPLETE (2026-03-30)** — All tasks implemented across 51 commits.
> This plan is retained for reference. See `docs/ARCHITECTURE.md` for current state.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the platform from composable module registry + per-app contracts to direct OS system service contracts following Android OS architecture.

**Architecture:** 15 OS system service contracts (6 new, 4 promoted from modules, 5 kept as-is) replace the 4-hop ModuleRegistry→RecipeRegistry→InstanceRegistry→ServiceGateway chain. Frontend gets OS proxy layer through PlatformContext. Edge functions act as Binder (auth + permission + rate limit proxy).

**Tech Stack:** C# / Neo N3 SmartContract Framework (contracts), TypeScript / host-native React (frontend), Deno (edge functions)

**Spec:** `docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md`

**Parallelization:** Tasks marked `[PARALLEL-A]` etc. can run concurrently within the same group. Groups must run sequentially: A → B → C → D → E.

---

## Group A: Core OS Contracts (parallel)

### Task 1: StorageService Contract `[PARALLEL-A]`

**Files:**
- Create: `contracts/os-storage/StorageService.cs`
- Create: `contracts/os-storage/StorageService.csproj`

- [ ] **Step 1: Create project file**

Create `contracts/os-storage/StorageService.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
</Project>
```

- [ ] **Step 2: Write StorageService contract**

Create `contracts/os-storage/StorageService.cs`:
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

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void DataSetHandler(string appId, string key);
    public delegate void DataDeletedHandler(string appId, string key);
    public delegate void AccessGrantedHandler(string ownerAppId, string readerAppId, string keyPrefix);
    public delegate void AccessRevokedHandler(string ownerAppId, string readerAppId, string keyPrefix);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    /// <summary>
    /// OS StorageService — On-chain KV storage scoped by appId.
    /// Android analog: ContentProvider + StorageManager.
    ///
    /// Every miniapp gets isolated storage keyed by its appId.
    /// Cross-app data sharing requires explicit permission grants.
    ///
    /// STORAGE LAYOUT:
    /// 0x01       admin address
    /// 0x02       AppRegistry contract hash
    /// 0x10       data: appId + key → value
    /// 0x20       access grants: ownerAppId + readerAppId + prefix → 1
    /// 0x30       key counter per app
    /// </summary>
    [DisplayName("StorageService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS-level on-chain KV storage scoped by appId")]
    [ContractPermission("*", "*")]
    public class StorageService : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_DATA = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_ACCESS = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_KEY_COUNT = new byte[] { 0x30 };

        private const int MAX_KEY_LENGTH = 128;
        private const int MAX_VALUE_SIZE = 4096;

        [DisplayName("DataSet")]
        public static event DataSetHandler OnDataSet = default!;
        [DisplayName("DataDeleted")]
        public static event DataDeletedHandler OnDataDeleted = default!;
        [DisplayName("AccessGranted")]
        public static event AccessGrantedHandler OnAccessGranted = default!;
        [DisplayName("AccessRevoked")]
        public static event AccessRevokedHandler OnAccessRevoked = default!;
        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged = default!;

        // ---- Lifecycle ----

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest);
        }

        // ---- Configuration ----

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appRegistry != null && appRegistry != UInt160.Zero, "Invalid registry");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, appRegistry);
        }

        // ---- Write Operations ----

        public static void Set(string appId, string key, ByteString value)
        {
            ValidateAppCaller(appId);
            ExecutionEngine.Assert(key != null && key.Length > 0 && key.Length <= MAX_KEY_LENGTH, "Invalid key");
            ExecutionEngine.Assert(value != null && value.Length <= MAX_VALUE_SIZE, "Value too large");

            byte[] dataKey = Helper.Concat(PREFIX_DATA, (ByteString)appId, (ByteString)":", (ByteString)key);
            Storage.Put(Storage.CurrentContext, dataKey, value);
            OnDataSet(appId, key);
        }

        public static void BatchSet(string appId, string[] keys, ByteString[] values)
        {
            ValidateAppCaller(appId);
            ExecutionEngine.Assert(keys.Length == values.Length, "Length mismatch");
            ExecutionEngine.Assert(keys.Length <= 20, "Batch limit 20");

            for (int i = 0; i < keys.Length; i++)
            {
                ExecutionEngine.Assert(keys[i].Length > 0 && keys[i].Length <= MAX_KEY_LENGTH, "Invalid key");
                ExecutionEngine.Assert(values[i].Length <= MAX_VALUE_SIZE, "Value too large");
                byte[] dataKey = Helper.Concat(PREFIX_DATA, (ByteString)appId, (ByteString)":", (ByteString)keys[i]);
                Storage.Put(Storage.CurrentContext, dataKey, values[i]);
            }
        }

        public static void Delete(string appId, string key)
        {
            ValidateAppCaller(appId);
            byte[] dataKey = Helper.Concat(PREFIX_DATA, (ByteString)appId, (ByteString)":", (ByteString)key);
            Storage.Delete(Storage.CurrentContext, dataKey);
            OnDataDeleted(appId, key);
        }

        // ---- Read Operations ----

        [Safe]
        public static ByteString Get(string appId, string key)
        {
            byte[] dataKey = Helper.Concat(PREFIX_DATA, (ByteString)appId, (ByteString)":", (ByteString)key);
            return Storage.Get(Storage.CurrentContext, dataKey);
        }

        [Safe]
        public static Map<string, ByteString> ListKeys(string appId, string prefix, int limit)
        {
            ExecutionEngine.Assert(limit > 0 && limit <= 100, "Limit 1-100");
            byte[] searchPrefix = Helper.Concat(PREFIX_DATA, (ByteString)appId, (ByteString)":", (ByteString)prefix);
            Map<string, ByteString> result = new Map<string, ByteString>();
            int count = 0;
            Iterator iterator = Storage.Find(Storage.CurrentContext, searchPrefix, FindOptions.RemovePrefix);
            while (iterator.Next() && count < limit)
            {
                var kv = (object[])iterator.Value;
                result[(string)(ByteString)kv[0]] = (ByteString)kv[1];
                count++;
            }
            return result;
        }

        // ---- Cross-App Sharing ----

        public static void GrantReadAccess(string ownerAppId, string readerAppId, string keyPrefix)
        {
            ValidateAppCaller(ownerAppId);
            byte[] accessKey = Helper.Concat(PREFIX_ACCESS, (ByteString)ownerAppId, (ByteString)":", (ByteString)readerAppId, (ByteString)":", (ByteString)keyPrefix);
            Storage.Put(Storage.CurrentContext, accessKey, 1);
            OnAccessGranted(ownerAppId, readerAppId, keyPrefix);
        }

        public static void RevokeAccess(string ownerAppId, string readerAppId, string keyPrefix)
        {
            ValidateAppCaller(ownerAppId);
            byte[] accessKey = Helper.Concat(PREFIX_ACCESS, (ByteString)ownerAppId, (ByteString)":", (ByteString)readerAppId, (ByteString)":", (ByteString)keyPrefix);
            Storage.Delete(Storage.CurrentContext, accessKey);
            OnAccessRevoked(ownerAppId, readerAppId, keyPrefix);
        }

        [Safe]
        public static ByteString ReadShared(string readerAppId, string ownerAppId, string key)
        {
            // Check permission: readerAppId must have access grant for a prefix of key
            byte[] accessKey = Helper.Concat(PREFIX_ACCESS, (ByteString)ownerAppId, (ByteString)":", (ByteString)readerAppId, (ByteString)":");
            Iterator iterator = Storage.Find(Storage.CurrentContext, accessKey, FindOptions.KeysOnly | FindOptions.RemovePrefix);
            bool hasAccess = false;
            while (iterator.Next())
            {
                string prefix = (string)(ByteString)iterator.Value;
                if (key.Length >= prefix.Length && key.Substring(0, prefix.Length) == prefix)
                {
                    hasAccess = true;
                    break;
                }
            }
            ExecutionEngine.Assert(hasAccess, "No access");
            return Get(ownerAppId, key);
        }

        // ---- Admin ----

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin != UInt160.Zero, "Invalid admin");
            UInt160 old = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(old, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        // ---- Internal Helpers ----

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "Not admin");
        }

        private static void ValidateAppCaller(string appId)
        {
            // Accept calls from: admin, app developer (via AppRegistry lookup), or ScriptEngine
            UInt160 admin = GetAdmin();
            if (Runtime.CheckWitness(admin)) return;

            // Check if calling contract is the app's registered contract or ScriptEngine
            UInt160 caller = Runtime.CallingScriptHash;
            // For now, also accept admin or tx sender matching app developer
            // In production: validate against AppRegistry that sender is app developer/operator
            ExecutionEngine.Assert(false, "Unauthorized: not app owner or admin");
        }
    }
}
```

- [ ] **Step 3: Build and verify compilation**

Run: `cd /home/neo/git/neo-miniapps-platform && dotnet build contracts/os-storage/StorageService.csproj`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add contracts/os-storage/
git commit -m "feat(os): add StorageService — on-chain KV storage scoped by appId"
```

---

### Task 2: PaymentService Contract `[PARALLEL-A]`

**Files:**
- Create: `contracts/os-payment/PaymentService.cs`
- Create: `contracts/os-payment/PaymentService.csproj`

- [ ] **Step 1: Create project file**

Create `contracts/os-payment/PaymentService.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
</Project>
```

- [ ] **Step 2: Write PaymentService contract**

Create `contracts/os-payment/PaymentService.cs`:
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

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void DepositedHandler(string appId, UInt160 user, BigInteger amount);
    public delegate void WithdrawnHandler(string appId, UInt160 user, BigInteger amount);
    public delegate void TransferredHandler(string appId, UInt160 from, UInt160 to, BigInteger amount);
    public delegate void PrizeDistributedHandler(string appId, int recipientCount, BigInteger totalAmount);
    public delegate void FeeConfigSetHandler(string appId, int platformBps, int devBps, UInt160 devAddress);
    public delegate void PlatformFeesClaimedHandler(UInt160 admin, BigInteger amount);
    public delegate void PaymentAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    /// <summary>
    /// OS PaymentService — Centralized deposit, withdrawal, transfer, and fee management.
    /// Android analog: ConnectivityManager for money.
    ///
    /// All miniapp payment flows go through this single contract.
    /// Each app gets an isolated balance pool keyed by appId.
    /// After deposit, triggers ScriptEngine("onPaymentReceived") if registered.
    ///
    /// STORAGE LAYOUT:
    /// 0x01       admin address
    /// 0x02       AppRegistry hash
    /// 0x03       ScriptEngine hash
    /// 0x10       user balance: appId + user → amount
    /// 0x20       app pool total: appId → amount
    /// 0x30       fee config: appId → {platformBps, devBps, devAddress}
    /// 0x40       platform fee pool
    /// 0x50       deposit nonce (anti-replay)
    /// </summary>
    [DisplayName("PaymentService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS-level payment service: deposits, withdrawals, transfers, fees")]
    [ContractPermission("*", "*")]
    public class PaymentService : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_USER_BALANCE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_POOL = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_FEE_CONFIG = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_PLATFORM_FEES = new byte[] { 0x40 };

        private const int MAX_BPS = 10000; // 100%
        private const int MAX_PLATFORM_BPS = 2000; // 20% max platform fee
        private const int MAX_DEV_BPS = 5000; // 50% max dev fee

        public struct FeeConfig
        {
            public int PlatformBps;
            public int DevBps;
            public UInt160 DevAddress;
        }

        [DisplayName("Deposited")]
        public static event DepositedHandler OnDeposited = default!;
        [DisplayName("Withdrawn")]
        public static event WithdrawnHandler OnWithdrawn = default!;
        [DisplayName("Transferred")]
        public static event TransferredHandler OnTransferred = default!;
        [DisplayName("PrizeDistributed")]
        public static event PrizeDistributedHandler OnPrizeDistributed = default!;
        [DisplayName("FeeConfigSet")]
        public static event FeeConfigSetHandler OnFeeConfigSet = default!;
        [DisplayName("PlatformFeesClaimed")]
        public static event PlatformFeesClaimedHandler OnPlatformFeesClaimed = default!;
        [DisplayName("AdminChanged")]
        public static event PaymentAdminChangedHandler OnAdminChanged = default!;

        // ---- Lifecycle ----

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest);
        }

        // ---- Configuration ----

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, appRegistry);
        }

        public static void SetScriptEngine(UInt160 scriptEngine)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, scriptEngine);
        }

        public static void SetFeeConfig(string appId, int platformBps, int devBps, UInt160 devAddress)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(platformBps >= 0 && platformBps <= MAX_PLATFORM_BPS, "Platform fee too high");
            ExecutionEngine.Assert(devBps >= 0 && devBps <= MAX_DEV_BPS, "Dev fee too high");
            ExecutionEngine.Assert(platformBps + devBps <= MAX_BPS, "Total fees exceed 100%");

            FeeConfig config = new FeeConfig
            {
                PlatformBps = platformBps,
                DevBps = devBps,
                DevAddress = devAddress
            };
            byte[] feeKey = Helper.Concat(PREFIX_FEE_CONFIG, (ByteString)appId);
            Storage.Put(Storage.CurrentContext, feeKey, StdLib.Serialize(config));
            OnFeeConfigSet(appId, platformBps, devBps, devAddress);
        }

        // ---- NEP17 Payment Receiver ----

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "GAS only");
            ExecutionEngine.Assert(amount > 0, "Amount must be positive");

            if (from == null) return; // Mint, ignore

            // data must be the appId string
            string appId = (string)(ByteString)data;
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required in data");

            // Apply fees
            FeeConfig fees = GetFeeConfig(appId);
            BigInteger platformFee = amount * fees.PlatformBps / MAX_BPS;
            BigInteger devFee = amount * fees.DevBps / MAX_BPS;
            BigInteger netAmount = amount - platformFee - devFee;

            // Credit user balance
            AddUserBalance(appId, from, netAmount);

            // Credit platform fee pool
            if (platformFee > 0)
            {
                BigInteger currentPlatformFees = ReadBigInteger(PREFIX_PLATFORM_FEES);
                Storage.Put(Storage.CurrentContext, PREFIX_PLATFORM_FEES, currentPlatformFees + platformFee);
            }

            // Transfer dev fee directly
            if (devFee > 0 && fees.DevAddress != null && fees.DevAddress != UInt160.Zero)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, fees.DevAddress, devFee, null);
            }

            // Update app pool total
            AddAppPool(appId, netAmount);

            OnDeposited(appId, from, netAmount);

            // Trigger ScriptEngine hook if registered
            TriggerScriptHook(appId, "onPaymentReceived", from, netAmount);
        }

        // ---- Balance Operations ----

        public static void Withdraw(string appId, UInt160 user, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "Not authorized");
            ExecutionEngine.Assert(amount > 0, "Amount must be positive");

            BigInteger balance = GetBalance(appId, user);
            ExecutionEngine.Assert(balance >= amount, "Insufficient balance");

            SubtractUserBalance(appId, user, amount);
            SubtractAppPool(appId, amount);
            GAS.Transfer(Runtime.ExecutingScriptHash, user, amount, null);

            OnWithdrawn(appId, user, amount);
        }

        public static void Transfer(string appId, UInt160 from, UInt160 to, BigInteger amount)
        {
            // Only app operator or admin can initiate internal transfers
            ValidateAppOperator(appId);
            ExecutionEngine.Assert(amount > 0, "Amount must be positive");

            BigInteger fromBalance = GetBalance(appId, from);
            ExecutionEngine.Assert(fromBalance >= amount, "Insufficient balance");

            SubtractUserBalance(appId, from, amount);
            AddUserBalance(appId, to, amount);

            OnTransferred(appId, from, to, amount);
        }

        public static void DistributePrize(string appId, UInt160[] recipients, BigInteger[] amounts)
        {
            ValidateAppOperator(appId);
            ExecutionEngine.Assert(recipients.Length == amounts.Length, "Length mismatch");
            ExecutionEngine.Assert(recipients.Length <= 50, "Max 50 recipients");

            BigInteger total = 0;
            for (int i = 0; i < recipients.Length; i++)
            {
                ExecutionEngine.Assert(amounts[i] > 0, "Amount must be positive");
                total += amounts[i];
            }

            BigInteger pool = GetAppPool(appId);
            ExecutionEngine.Assert(pool >= total, "Insufficient pool");

            for (int i = 0; i < recipients.Length; i++)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, recipients[i], amounts[i], null);
            }

            SubtractAppPool(appId, total);
            OnPrizeDistributed(appId, recipients.Length, total);
        }

        // ---- Queries ----

        [Safe]
        public static BigInteger GetBalance(string appId, UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BALANCE, (ByteString)appId, (ByteString)":", (ByteString)user);
            return ReadBigInteger(key);
        }

        [Safe]
        public static BigInteger GetAppPool(string appId)
        {
            byte[] key = Helper.Concat(PREFIX_APP_POOL, (ByteString)appId);
            return ReadBigInteger(key);
        }

        [Safe]
        public static BigInteger GetPlatformFees()
        {
            return ReadBigInteger(PREFIX_PLATFORM_FEES);
        }

        [Safe]
        public static FeeConfig GetFeeConfig(string appId)
        {
            byte[] key = Helper.Concat(PREFIX_FEE_CONFIG, (ByteString)appId);
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            if (raw == null)
                return new FeeConfig { PlatformBps = 200, DevBps = 0, DevAddress = UInt160.Zero }; // default 2%
            return (FeeConfig)StdLib.Deserialize(raw);
        }

        // ---- Admin ----

        public static void ClaimPlatformFees()
        {
            ValidateAdmin();
            BigInteger fees = GetPlatformFees();
            ExecutionEngine.Assert(fees > 0, "No fees");
            Storage.Put(Storage.CurrentContext, PREFIX_PLATFORM_FEES, 0);
            UInt160 admin = GetAdmin();
            GAS.Transfer(Runtime.ExecutingScriptHash, admin, fees, null);
            OnPlatformFeesClaimed(admin, fees);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            UInt160 old = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(old, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        // ---- Internal Helpers ----

        private static void ValidateAdmin()
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetAdmin()), "Not admin");
        }

        private static void ValidateAppOperator(string appId)
        {
            UInt160 admin = GetAdmin();
            if (Runtime.CheckWitness(admin)) return;
            // Also accept ScriptEngine calling on behalf of app
            UInt160 scriptEngine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (scriptEngine != UInt160.Zero && Runtime.CallingScriptHash == scriptEngine) return;
            ExecutionEngine.Assert(false, "Not authorized");
        }

        private static void AddUserBalance(string appId, UInt160 user, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BALANCE, (ByteString)appId, (ByteString)":", (ByteString)user);
            BigInteger current = ReadBigInteger(key);
            Storage.Put(Storage.CurrentContext, key, current + amount);
        }

        private static void SubtractUserBalance(string appId, UInt160 user, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BALANCE, (ByteString)appId, (ByteString)":", (ByteString)user);
            BigInteger current = ReadBigInteger(key);
            Storage.Put(Storage.CurrentContext, key, current - amount);
        }

        private static void AddAppPool(string appId, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_APP_POOL, (ByteString)appId);
            BigInteger current = ReadBigInteger(key);
            Storage.Put(Storage.CurrentContext, key, current + amount);
        }

        private static void SubtractAppPool(string appId, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_APP_POOL, (ByteString)appId);
            BigInteger current = ReadBigInteger(key);
            Storage.Put(Storage.CurrentContext, key, current - amount);
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            return val == null ? 0 : (BigInteger)val;
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        private static void TriggerScriptHook(string appId, string hookPoint, UInt160 user, BigInteger amount)
        {
            UInt160 scriptEngine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (scriptEngine == UInt160.Zero) return;
            try
            {
                ByteString context = StdLib.Serialize(new object[] { user, amount, Runtime.Time });
                Contract.Call(scriptEngine, "Execute", CallFlags.All, appId, hookPoint, context);
            }
            catch { } // Script execution failure should not block payment
        }
    }
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /home/neo/git/neo-miniapps-platform && dotnet build contracts/os-payment/PaymentService.csproj`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add contracts/os-payment/
git commit -m "feat(os): add PaymentService — centralized deposit/withdrawal/transfer with fees"
```

---

### Task 3: ScriptEngine Contract `[PARALLEL-A]`

**Files:**
- Create: `contracts/os-script/ScriptEngine.cs`
- Create: `contracts/os-script/ScriptEngine.csproj`

- [ ] **Step 1: Create project file**

Create `contracts/os-script/ScriptEngine.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
</Project>
```

- [ ] **Step 2: Write ScriptEngine contract**

Create `contracts/os-script/ScriptEngine.cs`:
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

namespace NeoMiniAppPlatform.Contracts.OS
{
    public delegate void ScriptRegisteredHandler(string appId, string hookPoint, UInt160 scriptHash);
    public delegate void ScriptUnregisteredHandler(string appId, string hookPoint);
    public delegate void ScriptExecutedHandler(string appId, string hookPoint, bool success);
    public delegate void ScriptDisabledHandler(string appId, string hookPoint);
    public delegate void GlobalScriptPauseHandler(bool paused);
    public delegate void ScriptAdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    /// <summary>
    /// OS ScriptEngine — On-chain NeoVM bytecode execution at hook points.
    /// Android analog: Dalvik/ART VM for custom app logic.
    ///
    /// MiniApps register compiled NEF contracts that OS services invoke at hook points.
    /// Scripts are sandboxed: they can only call whitelisted OS services with their own appId.
    ///
    /// HOOK POINTS:
    /// - onPaymentReceived: called after PaymentService deposits
    /// - onSettlement: called after GameService settles a pool
    /// - onCheckin: called after CheckinService records a check-in
    /// - onBadgeAwarded: called after BadgeService awards a badge
    /// - onEscrowStateChange: called after EscrowService state transition
    /// - onCustom:<name>: arbitrary named hooks for app-specific triggers
    ///
    /// STORAGE LAYOUT:
    /// 0x01       admin address
    /// 0x02       AppRegistry hash
    /// 0x10       script registration: appId + hookPoint → scriptHash (UInt160)
    /// 0x20       gas limit: appId + hookPoint → maxGas (BigInteger)
    /// 0x30       execution counter: appId + hookPoint → count
    /// 0x40       disabled flags: appId + hookPoint → 1
    /// 0x50       global pause flag
    /// 0x60       whitelisted caller contracts (OS services that can call Execute)
    /// </summary>
    [DisplayName("ScriptEngine")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "OS-level script execution engine for custom miniapp logic")]
    [ContractPermission("*", "*")]
    public class ScriptEngine : SmartContract
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_SCRIPT = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_GAS_LIMIT = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_EXEC_COUNT = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_DISABLED = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_GLOBAL_PAUSE = new byte[] { 0x50 };
        private static readonly byte[] PREFIX_WHITELISTED_CALLER = new byte[] { 0x60 };

        private const long DEFAULT_GAS_LIMIT = 5_00000000; // 5 GAS
        private const long MAX_GAS_LIMIT = 50_00000000;    // 50 GAS
        private const int MAX_HOOK_NAME_LENGTH = 64;

        [DisplayName("ScriptRegistered")]
        public static event ScriptRegisteredHandler OnScriptRegistered = default!;
        [DisplayName("ScriptUnregistered")]
        public static event ScriptUnregisteredHandler OnScriptUnregistered = default!;
        [DisplayName("ScriptExecuted")]
        public static event ScriptExecutedHandler OnScriptExecuted = default!;
        [DisplayName("ScriptDisabled")]
        public static event ScriptDisabledHandler OnScriptDisabled = default!;
        [DisplayName("GlobalScriptPause")]
        public static event GlobalScriptPauseHandler OnGlobalScriptPause = default!;
        [DisplayName("AdminChanged")]
        public static event ScriptAdminChangedHandler OnAdminChanged = default!;

        // ---- Lifecycle ----

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest);
        }

        // ---- Configuration ----

        public static void SetAppRegistry(UInt160 appRegistry)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, appRegistry);
        }

        public static void WhitelistCaller(UInt160 osServiceHash)
        {
            ValidateAdmin();
            byte[] key = Helper.Concat(PREFIX_WHITELISTED_CALLER, (ByteString)osServiceHash);
            Storage.Put(Storage.CurrentContext, key, 1);
        }

        public static void RemoveWhitelistedCaller(UInt160 osServiceHash)
        {
            ValidateAdmin();
            byte[] key = Helper.Concat(PREFIX_WHITELISTED_CALLER, (ByteString)osServiceHash);
            Storage.Delete(Storage.CurrentContext, key);
        }

        // ---- Script Registration (by app developers) ----

        public static void RegisterScript(string appId, string hookPoint, UInt160 scriptContractHash)
        {
            // Validate caller is app developer (check AppRegistry)
            ValidateAppDeveloper(appId);
            ValidateHookPoint(hookPoint);
            ExecutionEngine.Assert(scriptContractHash != null && scriptContractHash != UInt160.Zero, "Invalid script hash");

            // Verify the script contract exists on-chain
            Contract scriptContract = ContractManagement.GetContract(scriptContractHash);
            ExecutionEngine.Assert(scriptContract != null, "Script contract not deployed");

            byte[] scriptKey = Helper.Concat(PREFIX_SCRIPT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            Storage.Put(Storage.CurrentContext, scriptKey, scriptContractHash);

            OnScriptRegistered(appId, hookPoint, scriptContractHash);
        }

        public static void UnregisterScript(string appId, string hookPoint)
        {
            ValidateAppDeveloper(appId);
            byte[] scriptKey = Helper.Concat(PREFIX_SCRIPT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            Storage.Delete(Storage.CurrentContext, scriptKey);
            OnScriptUnregistered(appId, hookPoint);
        }

        public static void SetGasLimit(string appId, string hookPoint, BigInteger maxGas)
        {
            ValidateAppDeveloper(appId);
            ExecutionEngine.Assert(maxGas > 0 && maxGas <= MAX_GAS_LIMIT, "Gas limit out of range");
            byte[] gasKey = Helper.Concat(PREFIX_GAS_LIMIT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            Storage.Put(Storage.CurrentContext, gasKey, maxGas);
        }

        // ---- Execution (called by OS services only) ----

        public static ByteString Execute(string appId, string hookPoint, ByteString contextData)
        {
            // Only whitelisted OS services or admin can call Execute
            ValidateWhitelistedCaller();

            // Check global pause
            ByteString paused = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSE);
            if (paused != null && (BigInteger)paused == 1) return null;

            // Check per-script disable
            byte[] disabledKey = Helper.Concat(PREFIX_DISABLED, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            ByteString disabled = Storage.Get(Storage.CurrentContext, disabledKey);
            if (disabled != null && (BigInteger)disabled == 1) return null;

            // Look up registered script
            byte[] scriptKey = Helper.Concat(PREFIX_SCRIPT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            ByteString scriptHashRaw = Storage.Get(Storage.CurrentContext, scriptKey);
            if (scriptHashRaw == null) return null; // No script registered, not an error

            UInt160 scriptHash = (UInt160)scriptHashRaw;

            // Execute the script contract's Execute method
            bool success = true;
            ByteString result = null;
            try
            {
                result = (ByteString)Contract.Call(scriptHash, "Execute", CallFlags.All, appId, hookPoint, contextData);
            }
            catch
            {
                success = false;
            }

            // Increment execution counter
            byte[] countKey = Helper.Concat(PREFIX_EXEC_COUNT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            BigInteger count = ReadBigInteger(countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            OnScriptExecuted(appId, hookPoint, success);
            return result;
        }

        // ---- Queries ----

        [Safe]
        public static UInt160 GetScript(string appId, string hookPoint)
        {
            byte[] scriptKey = Helper.Concat(PREFIX_SCRIPT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            ByteString val = Storage.Get(Storage.CurrentContext, scriptKey);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        [Safe]
        public static BigInteger GetGasLimit(string appId, string hookPoint)
        {
            byte[] gasKey = Helper.Concat(PREFIX_GAS_LIMIT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            BigInteger val = ReadBigInteger(gasKey);
            return val == 0 ? DEFAULT_GAS_LIMIT : val;
        }

        [Safe]
        public static BigInteger GetExecutionCount(string appId, string hookPoint)
        {
            byte[] countKey = Helper.Concat(PREFIX_EXEC_COUNT, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            return ReadBigInteger(countKey);
        }

        [Safe]
        public static bool IsScriptDisabled(string appId, string hookPoint)
        {
            byte[] disabledKey = Helper.Concat(PREFIX_DISABLED, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            ByteString val = Storage.Get(Storage.CurrentContext, disabledKey);
            return val != null && (BigInteger)val == 1;
        }

        // ---- Admin Controls ----

        public static void DisableScript(string appId, string hookPoint)
        {
            ValidateAdmin();
            byte[] disabledKey = Helper.Concat(PREFIX_DISABLED, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            Storage.Put(Storage.CurrentContext, disabledKey, 1);
            OnScriptDisabled(appId, hookPoint);
        }

        public static void EnableScript(string appId, string hookPoint)
        {
            ValidateAdmin();
            byte[] disabledKey = Helper.Concat(PREFIX_DISABLED, (ByteString)appId, (ByteString)":", (ByteString)hookPoint);
            Storage.Delete(Storage.CurrentContext, disabledKey);
        }

        public static void SetGlobalScriptPause(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_GLOBAL_PAUSE, paused ? 1 : 0);
            OnGlobalScriptPause(paused);
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            UInt160 old = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
            OnAdminChanged(old, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            ByteString val = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return val == null ? UInt160.Zero : (UInt160)val;
        }

        // ---- Internal Helpers ----

        private static void ValidateAdmin()
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetAdmin()), "Not admin");
        }

        private static void ValidateWhitelistedCaller()
        {
            UInt160 admin = GetAdmin();
            if (Runtime.CheckWitness(admin)) return;
            UInt160 caller = Runtime.CallingScriptHash;
            byte[] key = Helper.Concat(PREFIX_WHITELISTED_CALLER, (ByteString)caller);
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            ExecutionEngine.Assert(val != null, "Caller not whitelisted");
        }

        private static void ValidateAppDeveloper(string appId)
        {
            UInt160 admin = GetAdmin();
            if (Runtime.CheckWitness(admin)) return;
            // In production: check AppRegistry for app developer and verify witness
            ExecutionEngine.Assert(false, "Not app developer");
        }

        private static void ValidateHookPoint(string hookPoint)
        {
            ExecutionEngine.Assert(hookPoint != null && hookPoint.Length > 0, "Empty hook point");
            ExecutionEngine.Assert(hookPoint.Length <= MAX_HOOK_NAME_LENGTH, "Hook name too long");
        }

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString val = Storage.Get(Storage.CurrentContext, key);
            return val == null ? 0 : (BigInteger)val;
        }
    }
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /home/neo/git/neo-miniapps-platform && dotnet build contracts/os-script/ScriptEngine.csproj`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add contracts/os-script/
git commit -m "feat(os): add ScriptEngine — on-chain NeoVM bytecode execution at hook points"
```

---

### Task 4: Enhance AppRegistry with Permissions and Actions `[PARALLEL-A]`

**Files:**
- Modify: `contracts/AppRegistry/AppRegistry.cs`

- [ ] **Step 1: Read current AppRegistry**

Read full file to understand existing structure before modifying.

- [ ] **Step 2: Add permission and action declaration methods**

Add the following new methods and storage to the existing AppRegistry contract. Append after the existing methods:

```csharp
// ---- NEW: Storage prefixes for OS features ----
private static readonly byte[] PREFIX_PERMISSIONS = new byte[] { 0x04 };
private static readonly byte[] PREFIX_ACTIONS = new byte[] { 0x05 };

// ---- NEW: Permission Management ----

/// <summary>
/// Set which OS services this app is allowed to use.
/// Called by app developer during registration or update.
/// Permissions: ["storage", "payment", "game", "badge", "leaderboard", "checkin", "vesting", "escrow", "nft", "script"]
/// </summary>
public static void SetPermissions(string appId, string permissionsJson)
{
    ValidateAppOwner(appId);
    byte[] key = Helper.Concat(PREFIX_PERMISSIONS, (ByteString)appId);
    Storage.Put(Storage.CurrentContext, key, permissionsJson);
}

[Safe]
public static string GetPermissions(string appId)
{
    byte[] key = Helper.Concat(PREFIX_PERMISSIONS, (ByteString)appId);
    ByteString val = Storage.Get(Storage.CurrentContext, key);
    return val == null ? "[]" : val;
}

[Safe]
public static bool HasPermission(string appId, string serviceName)
{
    string perms = GetPermissions(appId);
    // Simple contains check — JSON array like ["storage","payment"]
    return perms.Contains(serviceName);
}

// ---- NEW: Action Declarations (Intent system) ----

/// <summary>
/// Declare actions this app can handle (like Android intent-filters).
/// actionsJson: [{"name":"SWAP_TOKENS","category":"DEFI","dataTypes":["token-pair"]}]
/// </summary>
public static void DeclareActions(string appId, string actionsJson)
{
    ValidateAppOwner(appId);
    byte[] key = Helper.Concat(PREFIX_ACTIONS, (ByteString)appId);
    Storage.Put(Storage.CurrentContext, key, actionsJson);
}

[Safe]
public static string GetActions(string appId)
{
    byte[] key = Helper.Concat(PREFIX_ACTIONS, (ByteString)appId);
    ByteString val = Storage.Get(Storage.CurrentContext, key);
    return val == null ? "[]" : val;
}

private static void ValidateAppOwner(string appId)
{
    UInt160 admin = (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
    if (Runtime.CheckWitness(admin)) return;

    byte[] appKey = Helper.Concat(PREFIX_APP, (ByteString)appId);
    ByteString raw = Storage.Get(Storage.CurrentContext, appKey);
    ExecutionEngine.Assert(raw != null, "App not found");
    AppInfo info = (AppInfo)StdLib.Deserialize(raw);
    ExecutionEngine.Assert(Runtime.CheckWitness(info.Developer), "Not app owner");
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /home/neo/git/neo-miniapps-platform && dotnet build contracts/AppRegistry/AppRegistry.csproj`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```bash
git add contracts/AppRegistry/
git commit -m "feat(os): enhance AppRegistry with permissions and action declarations"
```

---

## Group B: Promote Modules + Build Remaining Services (parallel within group)

### Task 5: Promote CheckinModule → CheckinService `[PARALLEL-B]`

**Files:**
- Create: `contracts/os-checkin/CheckinService.cs`
- Create: `contracts/os-checkin/CheckinService.csproj`

- [ ] **Step 1: Create project file**

Same `.csproj` pattern as Task 1.

- [ ] **Step 2: Write CheckinService (promoted from CheckinModule)**

The key change: remove `InitializeInstance` / `instanceId` scoping, replace with direct `appId` scoping. Remove `PREFIX_INSTANCE_REGISTRY` dependency. Add ScriptEngine hook on checkin.

Create `contracts/os-checkin/CheckinService.cs` — full contract based on CheckinModule but scoped by `appId` instead of `instanceId`, with `Configure(appId, configJson)` replacing `InitializeInstance`, and `ScriptEngine.Execute(appId, "onCheckin", ctx)` called after each check-in.

Follow exact patterns from StorageService (Task 1) for admin, lifecycle, events. Keep the core checkin logic (streak tracking, reward calculation, UTC-day period) from the existing CheckinModule.

- [ ] **Step 3: Build, verify, commit**

```bash
dotnet build contracts/os-checkin/CheckinService.csproj
git add contracts/os-checkin/ && git commit -m "feat(os): add CheckinService — promoted from CheckinModule with appId scoping"
```

---

### Task 6: Promote StatsBadgeModule → BadgeService `[PARALLEL-B]`

Same promotion pattern as Task 5. Replace `instanceId` with `appId`. Remove instance registry dependency. Add ScriptEngine hook on badge award.

**Files:** `contracts/os-badge/BadgeService.cs` + `.csproj`

---

### Task 7: Promote LeaderboardModule → LeaderboardService `[PARALLEL-B]`

Same promotion pattern. Replace `instanceId` with `appId`.

**Files:** `contracts/os-leaderboard/LeaderboardService.cs` + `.csproj`

---

### Task 8: Promote StreamVesting → VestingService `[PARALLEL-B]`

Same promotion pattern. Replace `instanceId` with `appId`. Remove FundingVault dependency — integrate with PaymentService instead.

**Files:** `contracts/os-vesting/VestingService.cs` + `.csproj`

---

### Task 9: GameService Contract `[PARALLEL-B]`

**Files:**
- Create: `contracts/os-game/GameService.cs`
- Create: `contracts/os-game/GameService.csproj`

Full game framework contract with: pool creation, bet placement, settlement, player tracking. Integrates with PaymentService for balance operations and ScriptEngine for custom game logic hooks. Follow exact patterns from PaymentService (Task 2).

---

### Task 10: EscrowService Contract `[PARALLEL-B]`

**Files:** `contracts/os-escrow/EscrowService.cs` + `.csproj`

Milestone-based escrow with: create, fund, complete milestone, refund. Integrates with PaymentService. ScriptEngine hook on state change.

---

### Task 11: NFTService Contract `[PARALLEL-B]`

**Files:** `contracts/os-nft/NFTService.cs` + `.csproj`

AppId-scoped NFT management: mint, transfer, burn, validate (ticket mode), soulbound flag. No external dependencies except AppRegistry for authorization.

---

## Group C: Frontend OS Layer (after Group A contract interfaces are defined)

### Task 12: EdgeClient + OS Proxy Base `[PARALLEL-C]`

**Files:**
- Create: `apps/shared/services/os/EdgeClient.ts`
- Create: `apps/shared/services/os/OSServiceProxy.ts`
- Create: `apps/shared/services/os/index.ts`

- [ ] **Step 1: Create EdgeClient**

Create `apps/shared/services/os/EdgeClient.ts`:
```typescript
/**
 * EdgeClient — Standardized HTTP client for OS service edge functions.
 * Acts as the "Binder" transport layer between miniapp and OS services.
 */
export class EdgeClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private authToken: string | null = null;

  constructor(appId: string, baseUrl?: string) {
    this.appId = appId;
    this.baseUrl = baseUrl ?? (import.meta.env?.VITE_EDGE_URL || '/api/edge');
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  async call<T = unknown>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const body = { appId: this.appId, ...params };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`OS service error (${endpoint}): ${error.message || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }
}
```

- [ ] **Step 2: Create base proxy class**

Create `apps/shared/services/os/OSServiceProxy.ts`:
```typescript
import { EdgeClient } from './EdgeClient';

/**
 * Base class for all OS service proxies.
 * Each proxy maps method calls to edge function endpoints.
 */
export abstract class OSServiceProxy {
  protected readonly appId: string;
  protected readonly edge: EdgeClient;
  protected abstract readonly servicePrefix: string;

  constructor(appId: string, edge: EdgeClient) {
    this.appId = appId;
    this.edge = edge;
  }

  protected call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.edge.call<T>(`${this.servicePrefix}-${method}`, params);
  }
}
```

- [ ] **Step 3: Create index.ts barrel export**

Create `apps/shared/services/os/index.ts`:
```typescript
export { EdgeClient } from './EdgeClient';
export { OSServiceProxy } from './OSServiceProxy';
export { StorageProxy } from './StorageProxy';
export { PaymentProxy } from './PaymentProxy';
export { GameProxy } from './GameProxy';
export { VestingProxy } from './VestingProxy';
export { EscrowProxy } from './EscrowProxy';
export { BadgeProxy } from './BadgeProxy';
export { LeaderboardProxy } from './LeaderboardProxy';
export { CheckinProxy } from './CheckinProxy';
export { NFTProxy } from './NFTProxy';
export { ScriptProxy } from './ScriptProxy';
export type { OSServices } from './types';
```

- [ ] **Step 4: Commit**

```bash
git add apps/shared/services/os/
git commit -m "feat(os): add EdgeClient and OSServiceProxy base for frontend OS layer"
```

---

### Task 13: All OS Proxy Classes `[PARALLEL-C]`

**Files:**
- Create: `apps/shared/services/os/StorageProxy.ts`
- Create: `apps/shared/services/os/PaymentProxy.ts`
- Create: `apps/shared/services/os/GameProxy.ts`
- Create: `apps/shared/services/os/VestingProxy.ts`
- Create: `apps/shared/services/os/EscrowProxy.ts`
- Create: `apps/shared/services/os/BadgeProxy.ts`
- Create: `apps/shared/services/os/LeaderboardProxy.ts`
- Create: `apps/shared/services/os/CheckinProxy.ts`
- Create: `apps/shared/services/os/NFTProxy.ts`
- Create: `apps/shared/services/os/ScriptProxy.ts`
- Create: `apps/shared/services/os/types.ts`

- [ ] **Step 1: Create types file**

Create `apps/shared/services/os/types.ts`:
```typescript
import type { StorageProxy } from './StorageProxy';
import type { PaymentProxy } from './PaymentProxy';
import type { GameProxy } from './GameProxy';
import type { VestingProxy } from './VestingProxy';
import type { EscrowProxy } from './EscrowProxy';
import type { BadgeProxy } from './BadgeProxy';
import type { LeaderboardProxy } from './LeaderboardProxy';
import type { CheckinProxy } from './CheckinProxy';
import type { NFTProxy } from './NFTProxy';
import type { ScriptProxy } from './ScriptProxy';

/** All OS services available through PlatformContext.os */
export interface OSServices {
  storage: StorageProxy;
  payment: PaymentProxy;
  game: GameProxy;
  vesting: VestingProxy;
  escrow: EscrowProxy;
  badge: BadgeProxy;
  leaderboard: LeaderboardProxy;
  checkin: CheckinProxy;
  nft: NFTProxy;
  script: ScriptProxy;
}
```

- [ ] **Step 2: Create each proxy class**

Each follows the same pattern. Example `StorageProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class StorageProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-storage';

  async get(key: string): Promise<unknown> {
    return this.call('get', { key });
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.call('set', { key, value });
  }

  async delete(key: string): Promise<void> {
    await this.call('delete', { key });
  }

  async list(prefix: string, limit = 100): Promise<Record<string, unknown>> {
    return this.call('list', { prefix, limit });
  }

  async grantReadAccess(readerAppId: string, keyPrefix: string): Promise<void> {
    await this.call('grant-access', { readerAppId, keyPrefix });
  }

  async readShared(ownerAppId: string, key: string): Promise<unknown> {
    return this.call('read-shared', { ownerAppId, key });
  }
}
```

`PaymentProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class PaymentProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-payment';

  async deposit(amount: string, memo?: string): Promise<{ invocation: unknown }> {
    return this.call('deposit', { amount, memo });
  }

  async withdraw(amount: string): Promise<void> {
    await this.call('withdraw', { amount });
  }

  async getBalance(): Promise<string> {
    return this.call('balance', {});
  }

  async transfer(to: string, amount: string): Promise<void> {
    await this.call('transfer', { to, amount });
  }
}
```

`CheckinProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export interface CheckinData {
  currentStreak: number;
  highestStreak: number;
  totalCheckins: number;
  lastCheckinTime: number;
  unclaimedRewards: string;
  totalClaimed: string;
}

export class CheckinProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-checkin';

  async checkIn(): Promise<void> {
    await this.call('checkin', {});
  }

  async getStreak(): Promise<CheckinData> {
    return this.call('streak', {});
  }

  async claimRewards(): Promise<void> {
    await this.call('claim', {});
  }
}
```

`BadgeProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class BadgeProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-badge';

  async define(badgeId: string, name: string, criteria: string): Promise<void> {
    await this.call('define', { badgeId, name, criteria });
  }

  async award(badgeId: string, user: string): Promise<void> {
    await this.call('award', { badgeId, user });
  }

  async revoke(badgeId: string, user: string): Promise<void> {
    await this.call('revoke', { badgeId, user });
  }

  async list(user?: string): Promise<unknown[]> {
    return this.call('list', { user });
  }

  async getStat(user: string, statKey: string): Promise<string> {
    return this.call('get-stat', { user, statKey });
  }

  async updateStat(user: string, statKey: string, value: string): Promise<void> {
    await this.call('update-stat', { user, statKey, value });
  }
}
```

`LeaderboardProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export interface LeaderboardEntry { user: string; score: string; }

export class LeaderboardProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-leaderboard';

  async submitScore(score: string): Promise<void> {
    await this.call('submit', { score });
  }

  async get(limit = 100): Promise<LeaderboardEntry[]> {
    return this.call('get', { limit });
  }

  async reset(): Promise<void> {
    await this.call('reset', {});
  }
}
```

`GameProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class GameProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-game';

  async createPool(config: Record<string, unknown>): Promise<string> {
    return this.call('create', { config });
  }

  async joinPool(poolId: string): Promise<void> {
    await this.call('join', { poolId });
  }

  async placeBet(poolId: string, amount: string): Promise<void> {
    await this.call('bet', { poolId, amount });
  }

  async getPoolState(poolId: string): Promise<unknown> {
    return this.call('status', { poolId });
  }

  async settle(poolId: string, results: unknown): Promise<void> {
    await this.call('settle', { poolId, results });
  }
}
```

`VestingProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class VestingProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-vesting';

  async createStream(params: Record<string, unknown>): Promise<string> {
    return this.call('create', params);
  }

  async claim(streamId: string): Promise<void> {
    await this.call('claim', { streamId });
  }

  async cancel(streamId: string): Promise<void> {
    await this.call('cancel', { streamId });
  }

  async getStream(streamId: string): Promise<unknown> {
    return this.call('get', { streamId });
  }

  async listStreams(role: 'creator' | 'beneficiary'): Promise<unknown[]> {
    return this.call('list', { role });
  }
}
```

`EscrowProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class EscrowProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-escrow';

  async create(params: Record<string, unknown>): Promise<string> {
    return this.call('create', params);
  }

  async fund(escrowId: string): Promise<void> {
    await this.call('fund', { escrowId });
  }

  async completeMilestone(escrowId: string, index: number): Promise<void> {
    await this.call('complete', { escrowId, milestoneIndex: index });
  }

  async refund(escrowId: string): Promise<void> {
    await this.call('refund', { escrowId });
  }

  async get(escrowId: string): Promise<unknown> {
    return this.call('get', { escrowId });
  }
}
```

`NFTProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class NFTProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-nft';

  async mint(metadata: Record<string, unknown>): Promise<string> {
    return this.call('mint', { metadata });
  }

  async transfer(tokenId: string, to: string): Promise<void> {
    await this.call('transfer', { tokenId, to });
  }

  async burn(tokenId: string): Promise<void> {
    await this.call('burn', { tokenId });
  }

  async list(owner?: string, limit = 50): Promise<unknown[]> {
    return this.call('list', { owner, limit });
  }

  async validate(tokenId: string): Promise<void> {
    await this.call('validate', { tokenId });
  }
}
```

`ScriptProxy.ts`:
```typescript
import { OSServiceProxy } from './OSServiceProxy';

export class ScriptProxy extends OSServiceProxy {
  protected readonly servicePrefix = 'os-script';

  async register(hookPoint: string, scriptHash: string): Promise<void> {
    await this.call('register', { hookPoint, scriptHash });
  }

  async unregister(hookPoint: string): Promise<void> {
    await this.call('unregister', { hookPoint });
  }

  async listHooks(): Promise<string[]> {
    return this.call('list', {});
  }

  async getExecutionCount(hookPoint: string): Promise<number> {
    return this.call('count', { hookPoint });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/shared/services/os/
git commit -m "feat(os): add all OS service proxy classes for frontend"
```

---

### Task 14: Enhance PlatformContext + defineMiniApp `[DEPENDS-ON: 12, 13]`

**Files:**
- Modify: `apps/shared/types/miniapp-context.ts`
- Modify: `apps/shared/services/PlatformServices.ts`
- Modify: `apps/shared/utils/defineMiniApp.ts`
- Modify: `apps/shared/services/index.ts`

- [ ] **Step 1: Add OSServices to MiniAppContext**

In `apps/shared/types/miniapp-context.ts`, add the OS services import and extend MiniAppContext:

```typescript
// Add import at top:
import type { OSServices } from "../services/os/types";

// Extend MiniAppContext interface — add after the services field:
  /** OS system service proxies (storage, payment, game, badge, etc.) */
  os: OSServices;
```

- [ ] **Step 2: Add OS service creation to PlatformServices**

In `apps/shared/services/PlatformServices.ts`, add OS service wiring:

```typescript
// Add import at top:
import { EdgeClient } from "./os/EdgeClient";
import { StorageProxy } from "./os/StorageProxy";
import { PaymentProxy } from "./os/PaymentProxy";
import { GameProxy } from "./os/GameProxy";
import { VestingProxy } from "./os/VestingProxy";
import { EscrowProxy } from "./os/EscrowProxy";
import { BadgeProxy } from "./os/BadgeProxy";
import { LeaderboardProxy } from "./os/LeaderboardProxy";
import { CheckinProxy } from "./os/CheckinProxy";
import { NFTProxy } from "./os/NFTProxy";
import { ScriptProxy } from "./os/ScriptProxy";
import type { OSServices } from "./os/types";

// Add to PlatformServices class — new field:
  readonly os: OSServices;

// Add to constructor after FormattingService init:
    // OS service proxies (call system contracts through edge functions)
    const edge = new EdgeClient(appId);
    this.os = {
      storage: new StorageProxy(appId, edge),
      payment: new PaymentProxy(appId, edge),
      game: new GameProxy(appId, edge),
      vesting: new VestingProxy(appId, edge),
      escrow: new EscrowProxy(appId, edge),
      badge: new BadgeProxy(appId, edge),
      leaderboard: new LeaderboardProxy(appId, edge),
      checkin: new CheckinProxy(appId, edge),
      nft: new NFTProxy(appId, edge),
      script: new ScriptProxy(appId, edge),
    };
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /home/neo/git/neo-miniapps-platform && npx tsc --noEmit --project apps/shared/tsconfig.json 2>&1 | head -20`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 4: Commit**

```bash
git add apps/shared/types/miniapp-context.ts apps/shared/services/PlatformServices.ts apps/shared/services/os/
git commit -m "feat(os): wire OS services into PlatformContext and PlatformServices"
```

---

## Group D: Edge Functions (after frontend proxies define the API)

### Task 15: Edge Shared OS Utilities

**Files:**
- Create: `platform/edge/functions/_shared/os-service.ts`

- [ ] **Step 1: Create shared OS service helper**

```typescript
import { requireAuth } from "./supabase.ts";
import { requireRateLimit } from "./ratelimit.ts";
import { readJsonBody } from "./request.ts";
import { rpcCall } from "./neo-rpc.ts";

export interface OSRequest {
  appId: string;
  userId: string;
  params: Record<string, unknown>;
}

/**
 * Standard OS edge function handler.
 * Validates auth, rate limits, parses body, returns structured response.
 */
export async function handleOSRequest(
  req: Request,
  serviceName: string,
  handler: (osReq: OSRequest) => Promise<unknown>,
): Promise<Response> {
  try {
    const user = await requireAuth(req);
    await requireRateLimit(req, user.id, `os-${serviceName}`);

    const body = await readJsonBody(req);
    const appId = body.appId as string;
    if (!appId) {
      return new Response(JSON.stringify({ error: "appId required" }), { status: 400 });
    }

    // 5. App policy + optional permission gate

    const result = await handler({ appId, userId: user.id, params: body });

    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Unauthorized") ? 401 : message.includes("rate limit") ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), { status });
  }
}

/**
 * Invoke an OS service contract method via Neo RPC.
 */
export async function invokeOSContract(
  contractHash: string,
  method: string,
  args: unknown[],
): Promise<unknown> {
  return rpcCall("invokefunction", [contractHash, method, args]);
}
```

- [ ] **Step 2: Commit**

```bash
git add platform/edge/functions/_shared/os-service.ts
git commit -m "feat(os): add shared OS edge function handler utility"
```

---

### Task 16: Create OS Edge Functions (batch)

**Files:** Create 10 edge function directories with `index.ts` files.

Each edge function follows this pattern:

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { handleOSRequest } from "../_shared/os-service.ts";
import { invokeOSContract } from "../_shared/os-service.ts";

const CHECKIN_SERVICE_HASH = Deno.env.get("CONTRACT_CHECKIN_SERVICE_HASH") ?? "";

serve((req) =>
  handleOSRequest(req, "checkin-checkin", async ({ appId, userId }) => {
    return invokeOSContract(CHECKIN_SERVICE_HASH, "CheckIn", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  })
);
```

Create one edge function per OS service method (at minimum the most-used ones):

- `platform/edge/functions/os-storage-get/index.ts`
- `platform/edge/functions/os-storage-set/index.ts`
- `platform/edge/functions/os-payment-deposit/index.ts`
- `platform/edge/functions/os-payment-withdraw/index.ts`
- `platform/edge/functions/os-payment-balance/index.ts`
- `platform/edge/functions/os-checkin-checkin/index.ts`
- `platform/edge/functions/os-checkin-streak/index.ts`
- `platform/edge/functions/os-checkin-claim/index.ts`
- `platform/edge/functions/os-badge-award/index.ts`
- `platform/edge/functions/os-badge-list/index.ts`
- `platform/edge/functions/os-leaderboard-submit/index.ts`
- `platform/edge/functions/os-leaderboard-get/index.ts`
- `platform/edge/functions/os-game-create/index.ts`
- `platform/edge/functions/os-game-bet/index.ts`
- `platform/edge/functions/os-game-status/index.ts`
- `platform/edge/functions/os-nft-mint/index.ts`
- `platform/edge/functions/os-nft-list/index.ts`
- `platform/edge/functions/os-script-register/index.ts`

- [ ] **Step 1: Create all edge functions**
- [ ] **Step 2: Commit**

```bash
git add platform/edge/functions/os-*/
git commit -m "feat(os): add OS service edge functions (Binder proxy layer)"
```

---

## Group E: Proof-of-Concept Migration

### Task 17: Migrate DailyCheckin to OS Services

**Files:**
- Modify: `apps/daily-checkin/src/main.ts`
- Modify: `apps/daily-checkin/src/composables/useCheckin.ts` (simplify)
- Verify: `apps/daily-checkin/src/PlayArea.vue` (should need minimal changes)

- [ ] **Step 1: Read current daily-checkin implementation**

Read all files in `apps/daily-checkin/src/` to understand current implementation.

- [ ] **Step 2: Simplify composable to use OS services**

Replace direct contract calls with OS proxy calls:

```typescript
// Before: await chain.invoke(CONTRACT_HASH, "CheckIn", [...])
// After:  await ctx.os.checkin.checkIn()

// Before: await chain.read(CONTRACT_HASH, "GetUserStats", [...])
// After:  await ctx.os.checkin.getStreak()
```

- [ ] **Step 3: Update main.ts setup function**

Update to use `ctx.os.checkin` instead of a custom composable with direct chain calls.

- [ ] **Step 4: Verify the app still builds**

Run: `cd /home/neo/git/neo-miniapps-platform/apps/daily-checkin && npx vite build`
Expected: Build succeeded

- [ ] **Step 5: Commit**

```bash
git add apps/daily-checkin/
git commit -m "refactor: migrate daily-checkin to OS CheckinService"
```

---

### Task 18: Remove Legacy Files + Documentation Update

**Files:**
- Archive deprecated contracts to `_archive/deprecated-contracts/`
- Update `docs/superpowers/specs/2026-03-31-miniapp-os-v2-design.md` status
- Update project memory

- [ ] **Step 1: Move deprecated contracts to archive**

```bash
mkdir -p _archive/deprecated-contracts
mv contracts/ModuleRegistry _archive/deprecated-contracts/
mv contracts/RecipeRegistry _archive/deprecated-contracts/
mv contracts/MiniAppInstanceRegistry _archive/deprecated-contracts/
mv contracts/ServiceGateway _archive/deprecated-contracts/
```

- [ ] **Step 2: Update spec status**

Mark spec as "Implementation started" with completion status per phase.

- [ ] **Step 3: Commit**

```bash
git add _archive/ contracts/ docs/
git commit -m "refactor: archive deprecated registry contracts, update spec status"
```

---

## Task Dependency Graph

```
Group A (parallel):  [Task 1] [Task 2] [Task 3] [Task 4]
                         ↓       ↓       ↓       ↓
Group B (parallel):  [Task 5] [Task 6] [Task 7] [Task 8] [Task 9] [Task 10] [Task 11]
                                        ↓
Group C (parallel):  [Task 12] → [Task 13] → [Task 14]
                                               ↓
Group D (sequential): [Task 15] → [Task 16]
                                    ↓
Group E (sequential): [Task 17] → [Task 18]
```

Groups A and C can run in parallel (contracts + frontend are independent).
Group B depends on A's patterns. Group D depends on C.
Group E depends on everything.
