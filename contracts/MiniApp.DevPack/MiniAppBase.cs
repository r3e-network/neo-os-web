#pragma warning disable CS8618
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
    /// MiniApp DevPack - Core Abstract Base Class
    ///
    /// Provides ONLY essential functionality that ALL MiniApps need:
    /// - Admin management with TimeLock security
    /// - Oracle / callback-authority validation
    /// - Pause mechanism (local + global)
    /// - Payment receipt validation
    /// - Contract lifecycle (Update/Destroy)
    ///
    /// SECURITY MODEL:
    /// - Admin: Human operator with TimeLock-protected control
    /// - Oracle: Morpheus Oracle contract (for async callback-based flows)
    /// - AbstractAccount: optional AA core allowed to call user actions on behalf of users
    /// - Users: End users may call directly when CheckWitness is allowed and may
    ///   prepay GAS to the MiniApp contract for two-step flows
    ///
    /// INHERITANCE HIERARCHY:
    /// - MiniAppBase (this) → Core functionality only
    /// - MiniAppGameBase → Gaming/betting limits, RNG
    /// - MiniAppServiceBase → Service callbacks, automation
    /// - MiniAppTimeLockBase → Time-locked operations
    ///
    /// STORAGE LAYOUT:
    /// - 0x01-0x09: Core (Admin, Oracle, PaymentHub, Pause, TimeLock)
    /// - 0x0A-0x0E: Optional core (Automation, Badges, TotalUsers)
    /// - 0x10-0x17: Game base (bet limits, player tracking, request data)
    /// - 0x18-0x1B: Service base (service request data)
    /// - 0x1C-0x1F: TimeLock base (unlock state)
    /// - 0x20+: Available for app-specific storage
    /// </summary>
    public partial class MiniAppContract : SmartContract
    {
        #region Framework Version

        public const string DEVPACK_VERSION = "3.0.0";

        #endregion

        #region Core Storage Prefixes (0x01-0x09)

        protected static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        protected static readonly byte[] PREFIX_ORACLE = new byte[] { 0x02 };
        protected static readonly byte[] PREFIX_PAYMENTHUB = new byte[] { 0x03 };
        protected static readonly byte[] PREFIX_PAUSED = new byte[] { 0x04 };
        protected static readonly byte[] PREFIX_PAUSE_REGISTRY = new byte[] { 0x05 };
        protected static readonly byte[] PREFIX_RECEIPT_USED = new byte[] { 0x06 };
        // TimeLock storage (P0 security fix)
        protected static readonly byte[] PREFIX_PENDING_ADMIN = new byte[] { 0x07 };
        protected static readonly byte[] PREFIX_ADMIN_CHANGE_TIME = new byte[] { 0x08 };
        protected static readonly byte[] PREFIX_TIMELOCK_DELAY = new byte[] { 0x09 };
        // Automation anchor (optional, for contracts needing periodic execution)
        protected static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x0A };
        protected static readonly byte[] PREFIX_AUTOMATION_TASK = new byte[] { 0x0B };
        protected static readonly byte[] PREFIX_ABSTRACT_ACCOUNT = new byte[] { 0x0C };
        protected static readonly byte[] PREFIX_DIRECT_GAS_CREDIT = new byte[] { 0x70 };
        protected static readonly byte[] PREFIX_DIRECT_ASSET_CREDIT = new byte[] { 0x71 };

        #endregion

        #region TimeLock Constants

        private const long DEFAULT_TIMELOCK_DELAY_SECONDS = 86400; // 24 hours
        private const long MIN_TIMELOCK_DELAY_SECONDS = 3600;      // 1 hour minimum

        #endregion

        #region Events

        public delegate void AdminChangeProposedHandler(UInt160 currentAdmin, UInt160 proposedAdmin, BigInteger executeAfter);
        public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);
        public delegate void AdminChangeCancelledHandler(UInt160 cancelledAdmin);
        public delegate void PausedHandler(string appId, bool paused);

        [DisplayName("AdminChangeProposed")]
        public static event AdminChangeProposedHandler OnAdminChangeProposed;

        [DisplayName("AdminChanged")]
        public static event AdminChangedHandler OnAdminChanged;

        [DisplayName("AdminChangeCancelled")]
        public static event AdminChangeCancelledHandler OnAdminChangeCancelled;

        [DisplayName("Paused")]
        public static event PausedHandler OnPaused;

        #endregion

        #region Storage Helpers

        protected static ByteString? GetStorageValue(byte[] key) =>
            Storage.Get(Storage.CurrentContext, key);

        protected static UInt160 GetStoredHashOrZero(byte[] key)
        {
            ByteString? data = GetStorageValue(key);
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        protected static BigInteger GetStoredIntegerOrZero(byte[] key)
        {
            ByteString? data = GetStorageValue(key);
            return data == null ? 0 : (BigInteger)data;
        }

        protected static BigInteger GetStoredIntegerOrDefault(byte[] key, BigInteger defaultValue)
        {
            ByteString? data = GetStorageValue(key);
            return data == null ? defaultValue : (BigInteger)data;
        }

        protected static ByteString RequireByteString(ByteString? value, string errorMessage)
        {
            if (value != null)
            {
                return value;
            }

            ExecutionEngine.Assert(false, errorMessage);
            return (ByteString)"";
        }

        protected static object[] RequireObjectArray(object? value, string errorMessage)
        {
            object[] array = (object[])value;
            if (array != null)
            {
                return array;
            }

            ExecutionEngine.Assert(false, errorMessage);
            return new object[0];
        }

        #endregion

        #region Core Getters

        [Safe]
        public static UInt160 Admin() =>
            GetStoredHashOrZero(PREFIX_ADMIN);

        [Safe]
        public static UInt160 Oracle() =>
            GetStoredHashOrZero(PREFIX_ORACLE);

        [Safe]
        public static UInt160 PaymentHub() =>
            GetStoredHashOrZero(PREFIX_PAYMENTHUB);

        [Safe]
        public static UInt160 PauseRegistry() =>
            GetStoredHashOrZero(PREFIX_PAUSE_REGISTRY);

        [Safe]
        public static bool IsPaused() =>
            GetStoredIntegerOrZero(PREFIX_PAUSED) == 1;

        [Safe]
        public static UInt160 PendingAdmin() =>
            GetStoredHashOrZero(PREFIX_PENDING_ADMIN);

        [Safe]
        public static BigInteger AdminChangeTime() =>
            GetStoredIntegerOrZero(PREFIX_ADMIN_CHANGE_TIME);

        [Safe]
        public static BigInteger TimeLockDelay() =>
            GetStoredIntegerOrDefault(PREFIX_TIMELOCK_DELAY, DEFAULT_TIMELOCK_DELAY_SECONDS);

        [Safe]
        public static UInt160 AutomationAnchor() =>
            GetStoredHashOrZero(PREFIX_AUTOMATION_ANCHOR);

        [Safe]
        public static BigInteger GetAutomationTaskId() =>
            GetStoredIntegerOrZero(PREFIX_AUTOMATION_TASK);

        [Safe]
        public static UInt160 AbstractAccount() =>
            GetStoredHashOrZero(PREFIX_ABSTRACT_ACCOUNT);

        #endregion

        #region Core Validation Methods

        protected static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != UInt160.Zero && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        protected static void ValidateOracle()
        {
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == oracle, "only oracle");
        }

        protected static bool IsUserOrAbstractAccountAuthorized(UInt160 user)
        {
            if (user == UInt160.Zero || !user.IsValid)
            {
                return false;
            }

            if (Runtime.CheckWitness(user))
            {
                return true;
            }

            UInt160 aa = AbstractAccount();
            return aa != UInt160.Zero && aa.IsValid && Runtime.CallingScriptHash == aa;
        }

        protected static void ValidateUserOrAbstractAccount(UInt160 user)
        {
            ValidateAddress(user);
            ExecutionEngine.Assert(IsUserOrAbstractAccountAuthorized(user), "unauthorized");
        }

        protected static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != UInt160.Zero && addr.IsValid, "invalid address");
        }

        protected static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "paused");
        }

        protected static void ValidateNotGloballyPaused(string appId)
        {
            ValidateNotPaused();
            UInt160 registry = PauseRegistry();
            if (registry != UInt160.Zero && registry.IsValid)
            {
                bool globalPaused = (bool)Contract.Call(
                    registry, "isPaused", CallFlags.ReadOnly,
                    new object[] { appId });
                ExecutionEngine.Assert(!globalPaused, "globally paused");
            }
        }

        #endregion

        #region TimeLock Admin Management (P0 Security Fix)

        /// <summary>
        /// Proposes a new admin. Change takes effect after TimeLock delay.
        /// </summary>
        public static void ProposeAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            ExecutionEngine.Assert(newAdmin != Admin(), "same admin");

            BigInteger executeAfter = Runtime.Time + TimeLockDelay();
            Storage.Put(Storage.CurrentContext, PREFIX_PENDING_ADMIN, newAdmin);
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN_CHANGE_TIME, executeAfter);

            OnAdminChangeProposed(Admin(), newAdmin, executeAfter);
        }

        /// <summary>
        /// Executes pending admin change after TimeLock delay has passed.
        /// Can be called by anyone after delay expires.
        /// </summary>
        public static void ExecuteAdminChange()
        {
            UInt160 pending = PendingAdmin();
            ExecutionEngine.Assert(pending != UInt160.Zero && pending.IsValid, "no pending admin");

            BigInteger changeTime = AdminChangeTime();
            ExecutionEngine.Assert(Runtime.Time >= changeTime, "timelock active");

            UInt160 oldAdmin = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, pending);
            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_ADMIN_CHANGE_TIME);

            OnAdminChanged(oldAdmin, pending);
        }

        /// <summary>
        /// Cancels pending admin change. Only current admin can cancel.
        /// </summary>
        public static void CancelAdminChange()
        {
            ValidateAdmin();
            UInt160 pending = PendingAdmin();
            ExecutionEngine.Assert(pending != UInt160.Zero && pending.IsValid, "no pending admin");

            Storage.Delete(Storage.CurrentContext, PREFIX_PENDING_ADMIN);
            Storage.Delete(Storage.CurrentContext, PREFIX_ADMIN_CHANGE_TIME);

            OnAdminChangeCancelled(pending);
        }

        /// <summary>
        /// Sets TimeLock delay in seconds. Minimum 1 hour.
        /// </summary>
        public static void SetTimeLockDelay(BigInteger delaySeconds)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(delaySeconds >= MIN_TIMELOCK_DELAY_SECONDS, "min delay 1 hour");
            Storage.Put(Storage.CurrentContext, PREFIX_TIMELOCK_DELAY, delaySeconds);
        }

        #endregion

        #region Oracle & PaymentHub Management

        public static void SetOracle(UInt160 oracle)
        {
            ValidateAdmin();
            ValidateAddress(oracle);
            Storage.Put(Storage.CurrentContext, PREFIX_ORACLE, oracle);
        }

        public static void SetPaymentHub(UInt160 hub)
        {
            ValidateAdmin();
            ValidateAddress(hub);
            Storage.Put(Storage.CurrentContext, PREFIX_PAYMENTHUB, hub);
        }

        public static void SetPauseRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY, registry);
        }

        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            Storage.Put(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
        }

        

        #endregion

        #region Pause Management

        public static void SetPaused(bool paused, string appId)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
            OnPaused(appId, paused);
        }

        #endregion

        #region Contract Lifecycle

        public static void Update(ByteString nef, string manifest, object data)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, data);
        }

        /// <summary>
        /// Destroys the contract permanently.
        /// WARNING: This is irreversible. Use with extreme caution.
        /// </summary>
        public static void Destroy()
        {
            ValidateAdmin();
            ContractManagement.Destroy();
        }

        #endregion

        #region Payment Receipt Validation

        protected static void ValidatePaymentReceipt(
            string appId, UInt160 payer, BigInteger minAmount, BigInteger receiptId)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(minAmount > 0, "amount must be > 0");
            ExecutionEngine.Assert(receiptId > 0, "receiptId required");

            UInt160 hub = PaymentHub();
            ExecutionEngine.Assert(hub != UInt160.Zero && hub.IsValid, "payment hub not set");

            StorageMap used = new StorageMap(Storage.CurrentContext, PREFIX_RECEIPT_USED);
            ByteString receiptKey = (ByteString)receiptId.ToByteArray();
            ExecutionEngine.Assert(used.Get(receiptKey) == null, "receipt already used");

            object receiptObj = Contract.Call(hub, "getReceipt", CallFlags.ReadOnly, receiptId);
            ExecutionEngine.Assert(receiptObj != null, "receipt not found");

            object[] receipt = RequireObjectArray(receiptObj, "invalid receipt");
            ExecutionEngine.Assert(receipt.Length >= 6, "invalid receipt");

            string receiptAppId = (string)receipt[1];
            UInt160 receiptPayer = (UInt160)receipt[2];
            BigInteger receiptAmount = (BigInteger)receipt[3];

            ExecutionEngine.Assert(receiptAppId == appId, "receipt app mismatch");
            ExecutionEngine.Assert(receiptPayer == payer, "receipt payer mismatch");
            ExecutionEngine.Assert(receiptAmount >= minAmount, "insufficient payment");

            used.Put(receiptKey, 1);
        }

        #endregion

        #region Direct GAS Credit Flow

        protected static string ReadPaymentMemo(object data)
        {
            if (data == null) return "";
            if (data is string text) return text ?? "";
            if (data is ByteString byteString) return (string)byteString;
            return data.ToString();
        }

        protected static void CreditDirectGasPayment(string appId, UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "unsupported asset");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo.StartsWith(appId + ":"), "invalid payment memo");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])from;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        protected static BigInteger GetDirectGasCredit(UInt160 payer)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString existing = credits.Get((ByteString)(byte[])payer);
            return existing == null ? 0 : (BigInteger)existing;
        }

        protected static void ConsumeDirectGasCredit(UInt160 payer, BigInteger amount)
        {
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
            ByteString key = (ByteString)(byte[])payer;
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid gas");

            BigInteger next = balance - amount;
            if (next == 0)
            {
                credits.Delete(key);
            }
            else
            {
                credits.Put(key, next);
            }
        }

        private static ByteString GetDirectAssetCreditKey(UInt160 asset, UInt160 payer) =>
            (ByteString)Helper.Concat((ByteString)(byte[])asset, (ByteString)(byte[])payer);

        protected static void CreditDirectAssetPayment(string appId, UInt160 expectedAsset, UInt160 from, BigInteger amount, object data)
        {
            if (from == Runtime.ExecutingScriptHash) return;
            ValidateAddress(expectedAsset);
            ExecutionEngine.Assert(Runtime.CallingScriptHash == expectedAsset, "unsupported asset");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            string memo = ReadPaymentMemo(data);
            ExecutionEngine.Assert(memo.StartsWith(appId + ":"), "invalid payment memo");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = GetDirectAssetCreditKey(expectedAsset, from);
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            credits.Put(key, balance + amount);
        }

        protected static BigInteger GetDirectAssetCredit(UInt160 asset, UInt160 payer)
        {
            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString existing = credits.Get(GetDirectAssetCreditKey(asset, payer));
            return existing == null ? 0 : (BigInteger)existing;
        }

        protected static void ConsumeDirectAssetCredit(UInt160 asset, UInt160 payer, BigInteger amount)
        {
            ValidateAddress(asset);
            ValidateAddress(payer);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
            ByteString key = GetDirectAssetCreditKey(asset, payer);
            ByteString existing = credits.Get(key);
            BigInteger balance = existing == null ? 0 : (BigInteger)existing;
            ExecutionEngine.Assert(balance >= amount, "insufficient prepaid asset");

            BigInteger next = balance - amount;
            if (next == 0)
            {
                credits.Delete(key);
            }
            else
            {
                credits.Put(key, next);
            }
        }

        #endregion

        #region Oracle Request Helpers

        protected static BigInteger RequestOracleForCallback(UInt160 requester, string requestType, ByteString payload)
        {
            ValidateAddress(requester);
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");

            return (BigInteger)Contract.Call(
                oracle,
                "requestFromCallback",
                CallFlags.All,
                requester,
                requestType,
                payload,
                Runtime.ExecutingScriptHash,
                "onOracleResult"
            );
        }

        #endregion
    }
}
