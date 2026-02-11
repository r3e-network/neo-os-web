using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Event emitted when global pause state changes
    /// </summary>
    public delegate void GlobalPauseChangedHandler(bool paused, UInt160 changedBy);

    /// <summary>
    /// Event emitted when a specific app pause state changes
    /// </summary>
    public delegate void AppPauseChangedHandler(string appId, bool paused, UInt160 changedBy);

    /// <summary>
    /// PauseRegistry - Central pause control for all MiniApp contracts.
    /// Provides global pause/resume functionality with a single transaction.
    /// </summary>
    [DisplayName("PauseRegistry")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Central pause registry for MiniApp platform")]
    public class PauseRegistry : SmartContract
    {
        #region Storage Prefixes
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GLOBAL_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_OPERATOR = new byte[] { 0x04 };
        #endregion

        #region Events
        [DisplayName("GlobalPauseChanged")]
        public static event GlobalPauseChangedHandler OnGlobalPauseChanged;

        [DisplayName("AppPauseChanged")]
        public static event AppPauseChangedHandler OnAppPauseChanged;
        #endregion

        #region Getters
        /// <summary>Get admin address (null if not yet deployed)</summary>
        public static UInt160 Admin()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return raw != null ? (UInt160)raw : null;
        }

        /// <summary>Check if platform is globally paused</summary>
        public static bool IsGloballyPaused()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED);
            return data != null && (BigInteger)data == 1;
        }

        /// <summary>Check if a specific app is paused</summary>
        public static bool IsAppPaused(string appId)
        {
            byte[] key = Helper.Concat(PREFIX_APP_PAUSED, (ByteString)appId);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data == 1;
        }

        /// <summary>Check if an address is an operator</summary>
        public static bool IsOperator(UInt160 addr)
        {
            byte[] key = Helper.Concat(PREFIX_OPERATOR, (ByteString)addr);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data == 1;
        }

        /// <summary>
        /// Check if operations should be paused for an app.
        /// Returns true if globally paused OR app-specifically paused.
        /// </summary>
        public static bool IsPaused(string appId)
        {
            if (IsGloballyPaused()) return true;
            return IsAppPaused(appId);
        }
        #endregion

        #region Validation
        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        private static void ValidateOperator()
        {
            UInt160 caller = Runtime.Transaction.Sender;
            UInt160 admin = Admin();
            bool isAdmin = admin != null && Runtime.CheckWitness(admin);
            bool isOp = IsOperator(caller);
            ExecutionEngine.Assert(isAdmin || isOp, "not admin or operator");
        }
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (!update)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
                Storage.Put(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED, 0);
            }
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, null);
        }
        #endregion

        #region Admin Management
        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid, "invalid");
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, newAdmin);
        }

        public static void SetOperator(UInt160 addr, bool isOperator)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(addr != null && addr.IsValid, "invalid");
            byte[] key = Helper.Concat(PREFIX_OPERATOR, (ByteString)addr);
            Storage.Put(Storage.CurrentContext, key, isOperator ? 1 : 0);
        }
        #endregion

        #region Pause Control
        /// <summary>
        /// Pause or resume the entire platform with one transaction.
        /// Only admin or operators can call this.
        /// </summary>
        public static void SetGlobalPause(bool paused)
        {
            ValidateOperator();
            Storage.Put(Storage.CurrentContext, PREFIX_GLOBAL_PAUSED, paused ? 1 : 0);
            OnGlobalPauseChanged(paused, Runtime.Transaction.Sender);
        }

        /// <summary>
        /// Pause or resume a specific app.
        /// Only admin or operators can call this.
        /// </summary>
        public static void SetAppPause(string appId, bool paused)
        {
            ValidateOperator();
            ExecutionEngine.Assert(appId != null && appId.Length > 0, "invalid appId");
            byte[] key = Helper.Concat(PREFIX_APP_PAUSED, (ByteString)appId);
            Storage.Put(Storage.CurrentContext, key, paused ? 1 : 0);
            OnAppPauseChanged(appId, paused, Runtime.Transaction.Sender);
        }

        /// <summary>
        /// Batch pause/resume multiple apps.
        /// </summary>
        public static void SetAppsPause(string[] appIds, bool paused)
        {
            ValidateOperator();
            for (int i = 0; i < appIds.Length; i++)
            {
                string appId = appIds[i];
                if (appId != null && appId.Length > 0)
                {
                    byte[] key = Helper.Concat(PREFIX_APP_PAUSED, (ByteString)appId);
                    Storage.Put(Storage.CurrentContext, key, paused ? 1 : 0);
                    OnAppPauseChanged(appId, paused, Runtime.Transaction.Sender);
                }
            }
        }
        #endregion
    }
}
