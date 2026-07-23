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
    public partial class PlatformDeFiContract
    {
        #region Lifecycle

        public static void _deploy(object data, bool update)
        {
            if (update)
            {
                if (LegacyCreditRecoveryState() == LegacyRecoveryUninitialized)
                {
                    Put((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE,
                        LegacyRecoverySnapshotRequired);
                    Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, 1);
                }
                return;
            }
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Put((ByteString)PREFIX_LEGACY_CREDIT_RECOVERY_STATE,
                LegacyRecoveryComplete);
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

        private static void ValidateAppAuthority(string appId)
        {
            UInt160 admin = Admin();
            UInt160 appAdmin = GetAppAdmin(appId);
            bool isAdmin = admin != UInt160.Zero && Runtime.CheckWitness(admin);
            bool isAppAdmin = appAdmin != UInt160.Zero && Runtime.CheckWitness(appAdmin);
            ExecutionEngine.Assert(isAdmin || isAppAdmin, "unauthorized");
        }

        private static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "platform paused");
        }

        // Audit fix H-13: typed events for AdminChanged / PauseStateChanged /
        // ContractUpgraded should be added at the contract level — declare them in
        // PlatformDeFi.cs and raise via the standard `event` invocation pattern.
        // (Initial attempt used `Runtime.Notify(name, state)` but that overload is
        // not exposed in the current DevPack.)
        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            if (!paused)
            {
                BigInteger recoveryState = LegacyCreditRecoveryState();
                ExecutionEngine.Assert(
                    recoveryState == LegacyRecoveryActive ||
                    recoveryState == LegacyRecoveryComplete,
                    "legacy credit recovery not active");
                EnsureNeoCreditSolvent();
                EnsureGasCreditSolvent();
            }
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(IsPaused(), "pause before update");
            EnsureNeoCreditSolvent();
            EnsureGasCreditSolvent();
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
                PutAddress(AppKey(appId, PREFIX_PROFIT_ANCHOR_CONTRACT), UInt160.Zero);
                Put(AppKey(appId, PREFIX_PROFIT_ANCHOR_APP_ID), (ByteString)"");
                // Audit fix A10/A12: lending disburses only from this tracked pool.
                Put(AppKey(appId, PREFIX_LENDING_GAS_LIQUIDITY), 0);
            }
            else if (productType == ProductType_FlashLoan)
            {
                Put(AppKey(appId, PREFIX_FLASH_LOAN_ID), 0);
                Put(AppKey(appId, PREFIX_POOL_BALANCE), 0);
                Put(AppKey(appId, PREFIX_FLASH_TOTAL_BORROWED), 0);
                Put(AppKey(appId, PREFIX_FLASH_TOTAL_FEES), 0);
                // Audit fix C-1: initialize per-LP deposit accumulator.
                Put(AppKey(appId, PREFIX_FLASH_TOTAL_LP_DEPOSITS), 0);
            }
            else if (productType == ProductType_Capsule)
            {
                Put(AppKey(appId, PREFIX_CAPSULE_ID), 0);
                Put(AppKey(appId, PREFIX_TOTAL_LOCKED), 0);
                Put(AppKey(appId, PREFIX_TOTAL_COMPOUND), 0);
                Put(AppKey(appId, PREFIX_TOTAL_CAPSULE_USERS), 0);
                Put(AppKey(appId, PREFIX_TOTAL_WITHDRAWN), 0);
                Put(AppKey(appId, PREFIX_TOTAL_PENALTIES), 0);
                // Audit fix A9/A10: compound yield is paid only from this funded reserve.
                Put(AppKey(appId, PREFIX_CAPSULE_GAS_RESERVE), 0);
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
            ValidateAppAuthority(appId);

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
    }
}
