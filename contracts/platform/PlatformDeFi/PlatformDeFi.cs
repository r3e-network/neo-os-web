using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    // Event delegates
    public delegate void ProductRegisteredHandler(string appId, BigInteger productType, UInt160 appAdmin);
    public delegate void AppPausedHandler(string appId, bool paused);

    // Lending events
    public delegate void LoanCreatedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger collateral, BigInteger borrowed);
    public delegate void LoanRepaidHandler(string appId, BigInteger loanId, BigInteger repaid, BigInteger remaining);
    public delegate void LoanClosedHandler(string appId, BigInteger loanId, UInt160 borrower);
    public delegate void CollateralAddedHandler(string appId, BigInteger loanId, BigInteger amount, BigInteger newTotal);

    // FlashLoan events
    public delegate void FlashLoanExecutedHandler(string appId, BigInteger loanId, UInt160 borrower, BigInteger amount, BigInteger fee, bool success);
    public delegate void FlashLiquidityDepositedHandler(string appId, UInt160 provider, BigInteger amount);
    public delegate void FlashLiquidityWithdrawnHandler(string appId, UInt160 provider, BigInteger amount);

    // Capsule events
    public delegate void CapsuleCreatedHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger amount, BigInteger unlockTime);
    public delegate void CapsuleUnlockedHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger payout);
    public delegate void CompoundAddedHandler(string appId, BigInteger capsuleId, BigInteger yieldAmount, BigInteger totalCompound);
    public delegate void EarlyWithdrawHandler(string appId, BigInteger capsuleId, UInt160 owner, BigInteger penalty);

    /// <summary>
    /// PlatformDeFi - Multi-tenant DeFi engine consolidating SelfLoan,
    /// FlashLoan, and CompoundCapsule into one reusable contract.
    ///
    /// Each registered app (appId) gets its own isolated storage namespace
    /// via AppKey(appId, PREFIX_*). Product types: Lending(1), FlashLoan(2), Capsule(3).
    /// </summary>
    [DisplayName("PlatformDeFi")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant DeFi engine for Neo N3. Consolidates SelfLoan, FlashLoan, and CompoundCapsule products into a single reusable contract with per-app isolation.")]
    [ContractPermission("*", "*")]
    public partial class PlatformDeFiContract : SmartContract
    {
        #region Product Type Enum
        private const int ProductType_Lending = 1;
        private const int ProductType_FlashLoan = 2;
        private const int ProductType_Capsule = 3;
        #endregion

        #region Global Prefixes (0x01-0x0F reserved for platform admin)
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };

        // Per-app registration
        private static readonly byte[] PREFIX_APP_TYPE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_CONFIG = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x13 };

        // Per-app NEO collateral credit (for Lending + Capsule)
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x14 };
        // Per-app GAS credit (for Lending repay + FlashLoan deposit)
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x15 };
        #endregion

        #region Lending Prefixes (0x20-0x2F)
        private static readonly byte[] PREFIX_LOAN_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_LOANS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_LOANS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_LOAN_COUNT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTAL_COLLATERAL = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_DEBT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_REPAID = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_BORROWERS = new byte[] { 0x27 };
        #endregion

        #region FlashLoan Prefixes (0x30-0x3F)
        private static readonly byte[] PREFIX_FLASH_LOAN_ID = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_FLASH_LOANS = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_POOL_BALANCE = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_BORROWER_LAST_LOAN = new byte[] { 0x33 };
        private static readonly byte[] PREFIX_BORROWER_DAILY_COUNT = new byte[] { 0x34 };
        private static readonly byte[] PREFIX_FLASH_TOTAL_BORROWED = new byte[] { 0x35 };
        private static readonly byte[] PREFIX_FLASH_TOTAL_FEES = new byte[] { 0x36 };
        private static readonly byte[] PREFIX_FLASH_REENTRANCY = new byte[] { 0x3E };
        #endregion

        #region Capsule Prefixes (0x40-0x4F)
        private static readonly byte[] PREFIX_CAPSULE_ID = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_CAPSULES = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_USER_CAPSULES = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_USER_CAPSULE_COUNT = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_TOTAL_LOCKED = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_TOTAL_COMPOUND = new byte[] { 0x45 };
        private static readonly byte[] PREFIX_TOTAL_CAPSULE_USERS = new byte[] { 0x46 };
        private static readonly byte[] PREFIX_TOTAL_WITHDRAWN = new byte[] { 0x47 };
        private static readonly byte[] PREFIX_TOTAL_PENALTIES = new byte[] { 0x48 };
        #endregion

        #region Lending Constants
        private const long GAS_FIXED8 = 100_000_000;
        private const int LTV_TIER1_BPS = 2000;  // 20%
        private const int LTV_TIER2_BPS = 3000;  // 30%
        private const int LTV_TIER3_BPS = 4000;  // 40%
        private const int LIQUIDATION_THRESHOLD_BPS = 8000;
        private const int MIN_HEALTH_FACTOR = 100; // 1.0 scaled by 100
        private const long MIN_COLLATERAL = 1;     // 1 NEO
        private const int LENDING_FEE_BPS = 50;    // 0.5% origination
        #endregion

        #region FlashLoan Constants
        private const long FLASH_MIN_LOAN = 100_000_000;       // 1 GAS
        private const long FLASH_MAX_LOAN = 10_000_000_000_000; // 100,000 GAS
        private const int FLASH_FEE_BPS = 9;                    // 0.09%
        private const ulong FLASH_COOLDOWN_SECONDS = 300;       // 5 min
        private const int FLASH_MAX_DAILY = 10;
        #endregion

        #region Capsule Constants
        private const int CAPSULE_FEE_BPS = 100;              // 1%
        private const int CAPSULE_EARLY_PENALTY_BPS = 500;    // 5%
        private const long CAPSULE_MIN_DEPOSIT = 1;           // 1 NEO (whole units)
        private const int CAPSULE_MIN_LOCK_DAYS = 7;
        private const int CAPSULE_MAX_LOCK_DAYS = 365;
        private const int TIER1_DAYS = 7;
        private const int TIER1_APY_BPS = 300;   // 3%
        private const int TIER2_DAYS = 30;
        private const int TIER2_APY_BPS = 500;   // 5%
        private const int TIER3_DAYS = 90;
        private const int TIER3_APY_BPS = 800;   // 8%
        private const int TIER4_DAYS = 180;
        private const int TIER4_APY_BPS = 1200;  // 12%
        #endregion

        #region Data Structures

        public struct Loan
        {
            public UInt160 Borrower;
            public BigInteger Collateral;
            public BigInteger Debt;
            public BigInteger OriginalDebt;
            public BigInteger CreatedTime;
            public BigInteger LastYieldTime;
            public BigInteger LtvBps;
            public BigInteger TotalRepaid;
            public BigInteger YieldAccrued;
            public bool Active;
        }

        public struct FlashLoanData
        {
            public UInt160 Borrower;
            public BigInteger Amount;
            public BigInteger Fee;
            public UInt160 CallbackContract;
            public string CallbackMethod;
            public BigInteger Timestamp;
            public bool Executed;
            public bool Success;
        }

        public struct Capsule
        {
            public UInt160 Owner;
            public BigInteger Principal;
            public BigInteger Compound;
            public BigInteger CreatedTime;
            public BigInteger UnlockTime;
            public BigInteger LastCompoundTime;
            public BigInteger LockDays;
            public BigInteger ApyBps;
            public bool Active;
            public bool EarlyWithdrawn;
        }

        #endregion

        #region Platform Events

        [DisplayName("ProductRegistered")]
        public static event ProductRegisteredHandler OnProductRegistered;

        [DisplayName("AppPaused")]
        public static event AppPausedHandler OnAppPaused;

        // Lending events
        [DisplayName("LoanCreated")]
        public static event LoanCreatedHandler OnLoanCreated;

        [DisplayName("LoanRepaid")]
        public static event LoanRepaidHandler OnLoanRepaid;

        [DisplayName("LoanClosed")]
        public static event LoanClosedHandler OnLoanClosed;

        [DisplayName("CollateralAdded")]
        public static event CollateralAddedHandler OnCollateralAdded;

        // FlashLoan events
        [DisplayName("FlashLoanExecuted")]
        public static event FlashLoanExecutedHandler OnFlashLoanExecuted;

        [DisplayName("FlashLiquidityDeposited")]
        public static event FlashLiquidityDepositedHandler OnFlashLiquidityDeposited;

        [DisplayName("FlashLiquidityWithdrawn")]
        public static event FlashLiquidityWithdrawnHandler OnFlashLiquidityWithdrawn;

        // Capsule events
        [DisplayName("CapsuleCreated")]
        public static event CapsuleCreatedHandler OnCapsuleCreated;

        [DisplayName("CapsuleUnlocked")]
        public static event CapsuleUnlockedHandler OnCapsuleUnlocked;

        [DisplayName("CompoundAdded")]
        public static event CompoundAddedHandler OnCompoundAdded;

        [DisplayName("EarlyWithdraw")]
        public static event EarlyWithdrawHandler OnEarlyWithdraw;

        #endregion

        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        #endregion

        #region Admin Management

        [Safe]
        public static UInt160 Admin() => ReadAddress(PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused()
        {
            ByteString value = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return value != null && (BigInteger)value == 1;
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        private static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "platform paused");
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        #endregion

        #region Product Registration

        /// <summary>
        /// Register a DeFi product for an app.
        /// productType: 1=Lending, 2=FlashLoan, 3=Capsule
        /// </summary>
        public static void RegisterProduct(string appId, BigInteger productType, UInt160 appAdmin, ByteString config)
        {
            ValidateAdmin();
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "appId required");
            ExecutionEngine.Assert(productType >= 1 && productType <= 3, "invalid product type (1-3)");

            // Prevent re-registration
            ByteString existing = GetRaw(AppKey(appId, PREFIX_APP_TYPE));
            ExecutionEngine.Assert(existing == null, "app already registered");

            Put(AppKey(appId, PREFIX_APP_TYPE), productType);
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_APP_ADMIN), appAdmin);
            if (config != null && config.Length > 0)
            {
                Put(AppKey(appId, PREFIX_APP_CONFIG), config);
            }

            // Initialize product-specific counters
            if (productType == ProductType_Lending)
            {
                Put(AppKey(appId, PREFIX_LOAN_ID), 0);
                Put(AppKey(appId, PREFIX_TOTAL_COLLATERAL), 0);
                Put(AppKey(appId, PREFIX_TOTAL_DEBT), 0);
                Put(AppKey(appId, PREFIX_TOTAL_REPAID), 0);
                Put(AppKey(appId, PREFIX_TOTAL_BORROWERS), 0);
            }
            else if (productType == ProductType_FlashLoan)
            {
                Put(AppKey(appId, PREFIX_FLASH_LOAN_ID), 0);
                Put(AppKey(appId, PREFIX_POOL_BALANCE), 0);
                Put(AppKey(appId, PREFIX_FLASH_TOTAL_BORROWED), 0);
                Put(AppKey(appId, PREFIX_FLASH_TOTAL_FEES), 0);
            }
            else if (productType == ProductType_Capsule)
            {
                Put(AppKey(appId, PREFIX_CAPSULE_ID), 0);
                Put(AppKey(appId, PREFIX_TOTAL_LOCKED), 0);
                Put(AppKey(appId, PREFIX_TOTAL_COMPOUND), 0);
                Put(AppKey(appId, PREFIX_TOTAL_CAPSULE_USERS), 0);
                Put(AppKey(appId, PREFIX_TOTAL_WITHDRAWN), 0);
                Put(AppKey(appId, PREFIX_TOTAL_PENALTIES), 0);
            }

            OnProductRegistered(appId, productType, appAdmin);
        }

        [Safe]
        public static BigInteger GetProductType(string appId) =>
            GetBigInteger(AppKey(appId, PREFIX_APP_TYPE));

        [Safe]
        public static UInt160 GetAppAdmin(string appId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_APP_ADMIN));
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        #endregion

        #region Per-App Pause/Unpause

        public static void SetAppPaused(string appId, bool paused)
        {
            // Only platform admin or app admin can pause
            UInt160 admin = Admin();
            UInt160 appAdmin = GetAppAdmin(appId);
            bool isAdmin = admin != UInt160.Zero && Runtime.CheckWitness(admin);
            bool isAppAdmin = appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin);
            ExecutionEngine.Assert(isAdmin || isAppAdmin, "unauthorized");

            Put(AppKey(appId, PREFIX_APP_PAUSED), paused ? 1 : 0);
            OnAppPaused(appId, paused);
        }

        [Safe]
        public static bool IsAppPaused(string appId)
        {
            BigInteger val = GetBigInteger(AppKey(appId, PREFIX_APP_PAUSED));
            return val == 1;
        }

        private static void ValidateApp(string appId, int expectedType)
        {
            ValidateNotPaused();
            ExecutionEngine.Assert(!IsAppPaused(appId), "app paused");
            BigInteger productType = GetBigInteger(AppKey(appId, PREFIX_APP_TYPE));
            ExecutionEngine.Assert(productType == expectedType, "wrong product type");
        }

        #endregion

        #region NEP-17 Payment Handler

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                ValidateAddress(from);
                // Credit NEO for the sender; appId resolved at consume-time
                StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
                ByteString key = (ByteString)(byte[])from;
                ByteString existing = credits.Get(key);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                credits.Put(key, balance + amount);
                return;
            }

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                ValidateAddress(from);
                StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
                ByteString key = (ByteString)(byte[])from;
                ByteString existing = credits.Get(key);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                credits.Put(key, balance + amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }

        #endregion

        #region Credit Consumption Helpers

        private static void ConsumeNeoCredit(UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid NEO");

            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        private static void ConsumeGasCredit(UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid GAS");

            BigInteger next = balance - amount;
            if (next == 0) credits.Delete(key);
            else credits.Put(key, next);
        }

        #endregion
    }
}
