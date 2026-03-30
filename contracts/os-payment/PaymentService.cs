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

    [DisplayName("PaymentService")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Centralized payment service for MiniApp OS: deposit, withdraw, transfer, fee management")]
    [ContractPermission("*", "*")]
    public class PaymentService : SmartContract
    {
        // ── Storage Prefixes ──────────────────────────────────────────────
        private static readonly byte[] PREFIX_ADMIN         = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_APP_REGISTRY  = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_SCRIPT_ENGINE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_USER_BALANCE  = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_POOL      = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_FEE_CONFIG    = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_PLATFORM_FEES = new byte[] { 0x40 };

        // ── Constants ─────────────────────────────────────────────────────
        private const int MAX_BPS          = 10000;
        private const int MAX_PLATFORM_BPS = 2000;
        private const int MAX_DEV_BPS      = 5000;

        // ── Structs ───────────────────────────────────────────────────────
        public struct FeeConfig
        {
            public int PlatformBps;
            public int DevBps;
            public UInt160 DevAddress;
        }

        // ── Events ────────────────────────────────────────────────────────
        [DisplayName("Deposited")]
        public static event DepositedHandler OnDeposited = delegate { };

        [DisplayName("Withdrawn")]
        public static event WithdrawnHandler OnWithdrawn = delegate { };

        [DisplayName("Transferred")]
        public static event TransferredHandler OnTransferred = delegate { };

        [DisplayName("PrizeDistributed")]
        public static event PrizeDistributedHandler OnPrizeDistributed = delegate { };

        [DisplayName("FeeConfigSet")]
        public static event FeeConfigSetHandler OnFeeConfigSet = delegate { };

        [DisplayName("PlatformFeesClaimed")]
        public static event PlatformFeesClaimedHandler OnPlatformFeesClaimed = delegate { };

        [DisplayName("AdminChanged")]
        public static event PaymentAdminChangedHandler OnAdminChanged = delegate { };

        // ── Lifecycle ─────────────────────────────────────────────────────

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Transaction tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, new object[0]);
        }

        // ── Admin Management ──────────────────────────────────────────────

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != UInt160.Zero && newAdmin.IsValid, "invalid admin");
            UInt160 oldAdmin = GetAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(oldAdmin, newAdmin);
        }

        [Safe]
        public static UInt160 GetAdmin()
        {
            return ReadAddress(PREFIX_ADMIN);
        }

        // ── Admin Configuration ───────────────────────────────────────────

        public static void SetAppRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(registry != UInt160.Zero && registry.IsValid, "invalid registry");
            Storage.Put(Storage.CurrentContext, PREFIX_APP_REGISTRY, (ByteString)registry);
        }

        public static void SetScriptEngine(UInt160 engine)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(engine != UInt160.Zero && engine.IsValid, "invalid engine");
            Storage.Put(Storage.CurrentContext, PREFIX_SCRIPT_ENGINE, (ByteString)engine);
        }

        // ── Fee Configuration ─────────────────────────────────────────────

        public static void SetFeeConfig(string appId, int platformBps, int devBps, UInt160 devAddress)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            ExecutionEngine.Assert(platformBps >= 0 && platformBps <= MAX_PLATFORM_BPS, "platformBps out of range");
            ExecutionEngine.Assert(devBps >= 0 && devBps <= MAX_DEV_BPS, "devBps out of range");
            ExecutionEngine.Assert(platformBps + devBps <= MAX_BPS, "total bps exceeds max");

            if (devBps > 0)
            {
                ExecutionEngine.Assert(devAddress != UInt160.Zero && devAddress.IsValid, "dev address required when devBps > 0");
            }

            FeeConfig config = new FeeConfig
            {
                PlatformBps = platformBps,
                DevBps      = devBps,
                DevAddress  = devAddress ?? UInt160.Zero
            };

            byte[] key = Helper.Concat(PREFIX_FEE_CONFIG, (ByteString)(appId ?? ""));
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(config));
            string normalizedAppId = appId ?? "";
            OnFeeConfigSet(normalizedAppId, platformBps, devBps, devAddress ?? UInt160.Zero);
        }

        [Safe]
        public static FeeConfig GetFeeConfig(string appId)
        {
            byte[] key = Helper.Concat(PREFIX_FEE_CONFIG, (ByteString)(appId ?? ""));
            ByteString? raw = Storage.Get(Storage.CurrentContext, key);
            if (raw == null)
            {
                return new FeeConfig
                {
                    PlatformBps = 200,
                    DevBps      = 0,
                    DevAddress  = UInt160.Zero
                };
            }
            return (FeeConfig)StdLib.Deserialize(raw);
        }

        // ── NEP-17 Deposit ────────────────────────────────────────────────

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Guard: NEP-17 fires callbacks on both sides of a transfer.
            // When this contract sends GAS (withdrawals, prizes), ignore the outbound callback
            // to prevent re-entry accounting.
            if (from == Runtime.ExecutingScriptHash) return;

            // Only accept GAS
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(from != UInt160.Zero && from.IsValid, "invalid sender");

            // Parse appId from data
            ExecutionEngine.Assert(data != null, "appId required in data");
            string appId;
            if (data is string text)
            {
                appId = text ?? "";
            }
            else if (data is ByteString bs)
            {
                appId = (string)bs;
            }
            else
            {
                appId = "";
            }
            ExecutionEngine.Assert(appId.Length > 0, "appId required");

            // Retrieve fee configuration
            FeeConfig fees = GetFeeConfig(appId);

            // Calculate fees
            BigInteger platformFee = amount * fees.PlatformBps / MAX_BPS;
            BigInteger devFee      = amount * fees.DevBps / MAX_BPS;
            BigInteger netAmount   = amount - platformFee - devFee;
            ExecutionEngine.Assert(netAmount > 0, "net amount must be > 0");

            // Credit net amount to user balance
            AddUserBalance(appId, from, netAmount);

            // Credit platform fee pool
            if (platformFee > 0)
            {
                BigInteger currentPlatformFees = ReadBigInteger(PREFIX_PLATFORM_FEES);
                WriteBigInteger(PREFIX_PLATFORM_FEES, currentPlatformFees + platformFee);
            }

            // Transfer dev fee directly to dev address
            if (devFee > 0 && fees.DevAddress != UInt160.Zero && fees.DevAddress.IsValid)
            {
                bool transferred = (bool)Contract.Call(
                    GAS.Hash, "transfer", CallFlags.All,
                    Runtime.ExecutingScriptHash, fees.DevAddress, devFee, null);
                ExecutionEngine.Assert(transferred, "dev fee transfer failed");
            }

            // Update app pool total
            AddAppPool(appId, netAmount);

            OnDeposited(appId, from, netAmount);

            // Call ScriptEngine hook (non-blocking)
            TriggerScriptHook(appId, "onPaymentReceived", from, netAmount);
        }

        // ── Withdraw ──────────────────────────────────────────────────────

        public static void Withdraw(string appId, UInt160 user, BigInteger amount)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            string normalizedAppId = appId ?? "";
            ExecutionEngine.Assert(user != UInt160.Zero && user.IsValid, "invalid user");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "unauthorized");

            SubtractUserBalance(normalizedAppId, user, amount);
            SubtractAppPool(normalizedAppId, amount);

            // Transfer GAS to user
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, user, amount, null);
            ExecutionEngine.Assert(transferred, "withdraw transfer failed");

            OnWithdrawn(normalizedAppId, user, amount);
        }

        // ── Transfer ──────────────────────────────────────────────────────

        public static void Transfer(string appId, UInt160 from, UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            string normalizedAppId = appId ?? "";
            ExecutionEngine.Assert(from != UInt160.Zero && from.IsValid, "invalid from");
            ExecutionEngine.Assert(to != UInt160.Zero && to.IsValid, "invalid to");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ValidateAppOperator(normalizedAppId);

            SubtractUserBalance(normalizedAppId, from, amount);
            AddUserBalance(normalizedAppId, to, amount);

            OnTransferred(normalizedAppId, from, to, amount);
        }

        // ── Distribute Prize ──────────────────────────────────────────────

        public static void DistributePrize(string appId, UInt160[] recipients, BigInteger[] amounts)
        {
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "app id required");
            string normalizedAppId = appId ?? "";
            ExecutionEngine.Assert(recipients != null && recipients!.Length > 0, "recipients required");
            ExecutionEngine.Assert(amounts != null && amounts!.Length > 0, "amounts required");
            ExecutionEngine.Assert(recipients!.Length == amounts!.Length, "recipients/amounts length mismatch");
            ExecutionEngine.Assert(recipients.Length <= 50, "max 50 recipients");
            ValidateAppOperator(normalizedAppId);

            BigInteger totalAmount = 0;
            for (int i = 0; i < recipients.Length; i++)
            {
                ExecutionEngine.Assert(recipients[i] != UInt160.Zero && recipients[i].IsValid, "invalid recipient");
                ExecutionEngine.Assert(amounts[i] > 0, "amount must be > 0");
                totalAmount += amounts[i];
            }

            // Verify pool has sufficient funds
            BigInteger pool = GetAppPool(normalizedAppId);
            ExecutionEngine.Assert(pool >= totalAmount, "insufficient app pool");

            // Distribute: credit each recipient, deduct from pool
            for (int i = 0; i < recipients.Length; i++)
            {
                AddUserBalance(normalizedAppId, recipients[i], amounts[i]);
            }
            SubtractAppPool(normalizedAppId, totalAmount);

            OnPrizeDistributed(normalizedAppId, recipients.Length, totalAmount);
        }

        // ── Read-Only Queries ─────────────────────────────────────────────

        [Safe]
        public static BigInteger GetBalance(string appId, UInt160 user)
        {
            byte[] key = UserBalanceKey(appId, user);
            return ReadBigInteger(key);
        }

        [Safe]
        public static BigInteger GetAppPool(string appId)
        {
            byte[] key = AppPoolKey(appId);
            return ReadBigInteger(key);
        }

        [Safe]
        public static BigInteger GetPlatformFees()
        {
            return ReadBigInteger(PREFIX_PLATFORM_FEES);
        }

        // ── Claim Platform Fees ───────────────────────────────────────────

        public static void ClaimPlatformFees()
        {
            ValidateAdmin();
            BigInteger fees = ReadBigInteger(PREFIX_PLATFORM_FEES);
            ExecutionEngine.Assert(fees > 0, "no fees to claim");

            WriteBigInteger(PREFIX_PLATFORM_FEES, 0);

            UInt160 admin = GetAdmin();
            bool transferred = (bool)Contract.Call(
                GAS.Hash, "transfer", CallFlags.All,
                Runtime.ExecutingScriptHash, admin, fees, null);
            ExecutionEngine.Assert(transferred, "fee claim transfer failed");

            OnPlatformFeesClaimed(admin, fees);
        }

        // ── Internal: Storage Key Builders ────────────────────────────────

        private static byte[] UserBalanceKey(string appId, UInt160 user)
        {
            return Helper.Concat(PREFIX_USER_BALANCE,
                (ByteString)((appId ?? "") + "|" + (string)(ByteString)(byte[])user));
        }

        private static byte[] AppPoolKey(string appId)
        {
            return Helper.Concat(PREFIX_APP_POOL, (ByteString)(appId ?? ""));
        }

        // ── Internal: Balance Helpers ─────────────────────────────────────

        private static void AddUserBalance(string appId, UInt160 user, BigInteger amount)
        {
            byte[] key = UserBalanceKey(appId, user);
            BigInteger current = ReadBigInteger(key);
            WriteBigInteger(key, current + amount);
        }

        private static void SubtractUserBalance(string appId, UInt160 user, BigInteger amount)
        {
            byte[] key = UserBalanceKey(appId, user);
            BigInteger current = ReadBigInteger(key);
            ExecutionEngine.Assert(current >= amount, "insufficient balance");
            WriteBigInteger(key, current - amount);
        }

        private static void AddAppPool(string appId, BigInteger amount)
        {
            byte[] key = AppPoolKey(appId);
            BigInteger current = ReadBigInteger(key);
            WriteBigInteger(key, current + amount);
        }

        private static void SubtractAppPool(string appId, BigInteger amount)
        {
            byte[] key = AppPoolKey(appId);
            BigInteger current = ReadBigInteger(key);
            ExecutionEngine.Assert(current >= amount, "insufficient app pool");
            WriteBigInteger(key, current - amount);
        }

        // ── Internal: Storage Read/Write ──────────────────────────────────

        private static BigInteger ReadBigInteger(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? 0 : (BigInteger)value;
        }

        private static void WriteBigInteger(byte[] key, BigInteger value)
        {
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString? value = Storage.Get(Storage.CurrentContext, key);
            return value == null ? UInt160.Zero : (UInt160)value;
        }

        // ── Internal: Auth ────────────────────────────────────────────────

        private static void ValidateAdmin()
        {
            UInt160 admin = GetAdmin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAppOperator(string appId)
        {
            // Admin always has operator rights
            UInt160 admin = GetAdmin();
            if (admin != UInt160.Zero && admin.IsValid && Runtime.CheckWitness(admin)) return;

            // Check if caller is the AppRegistry
            UInt160 registry = ReadAddress(PREFIX_APP_REGISTRY);
            if (registry != UInt160.Zero && registry.IsValid && Runtime.CallingScriptHash == registry) return;

            // Check if caller is the app's registered developer via AppRegistry
            if (registry != UInt160.Zero && registry.IsValid)
            {
                try
                {
                    object[] result = (object[])Contract.Call(registry, "getApp", CallFlags.ReadOnly, appId);
                    // AppInfo struct: [0]=AppId, [1]=Developer
                    if (result != null && result.Length >= 2)
                    {
                        UInt160 developer = (UInt160)result[1];
                        if (developer != UInt160.Zero && developer.IsValid && Runtime.CheckWitness(developer)) return;
                    }
                }
                catch
                {
                    // Registry call failed -- fall through to unauthorized
                }
            }

            ExecutionEngine.Assert(false, "unauthorized: not app operator");
        }

        // ── Internal: Script Engine Hook ──────────────────────────────────

        private static void TriggerScriptHook(string appId, string hookName, UInt160 user, BigInteger amount)
        {
            UInt160 engine = ReadAddress(PREFIX_SCRIPT_ENGINE);
            if (engine == UInt160.Zero || !engine.IsValid) return;

            try
            {
                Contract.Call(engine, "execute", CallFlags.All, appId, hookName, user, amount);
            }
            catch
            {
                // Script failure must not block payment processing
            }
        }
    }
}
