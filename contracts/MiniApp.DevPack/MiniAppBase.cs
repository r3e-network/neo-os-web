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
    /// - Gateway validation
    /// - Pause mechanism (local + global)
    /// - Payment receipt validation
    /// - Contract lifecycle (Update/Destroy)
    ///
    /// SECURITY MODEL:
    /// - Admin: Human operator with TimeLock-protected control
    /// - Gateway: TEE-attested service layer (required for callbacks; optional for user flows)
    /// - Users: End users may call directly when CheckWitness is allowed; PaymentHub receipts still apply
    ///
    /// INHERITANCE HIERARCHY:
    /// - MiniAppBase (this) → Core functionality only
    /// - MiniAppGameBase → Gaming/betting limits, RNG
    /// - MiniAppServiceBase → Service callbacks, automation
    /// - MiniAppTimeLockBase → Time-locked operations
    ///
    /// STORAGE LAYOUT:
    /// - 0x01-0x09: Core (Admin, Gateway, PaymentHub, Pause, TimeLock)
    /// - 0x0A-0x0E: Optional core (Automation, Badges, TotalUsers)
    /// - 0x10-0x17: Game base (bet limits, player tracking, request data)
    /// - 0x18-0x1B: Service base (service request data)
    /// - 0x1C-0x1F: TimeLock base (unlock state)
    /// - 0x20+: Available for app-specific storage
    /// </summary>
    public class MiniAppBase : SmartContract
    {
        #region Framework Version

        public const string DEVPACK_VERSION = "3.0.0";

        #endregion

        #region Core Storage Prefixes (0x01-0x09)

        protected static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        protected static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
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
        // Badge system (optional, for contracts with achievement tracking)
        protected static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x0C };
        protected static readonly byte[] PREFIX_USER_BADGE_COUNT = new byte[] { 0x0D };
        // Total users tracking (optional)
        protected static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x0E };

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

        public delegate void BadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

        [DisplayName("BadgeEarned")]
        public static event BadgeEarnedHandler OnBadgeEarned;

        #endregion

        #region Core Getters

        [Safe]
        public static UInt160 Admin() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        [Safe]
        public static UInt160 Gateway() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        [Safe]
        public static UInt160 PaymentHub() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAYMENTHUB);

        [Safe]
        public static UInt160 PauseRegistry() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PAUSE_REGISTRY);

        [Safe]
        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) == 1;

        [Safe]
        public static UInt160 PendingAdmin() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_PENDING_ADMIN);

        [Safe]
        public static BigInteger AdminChangeTime() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN_CHANGE_TIME);

        [Safe]
        public static BigInteger TimeLockDelay()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_TIMELOCK_DELAY);
            return data == null ? DEFAULT_TIMELOCK_DELAY_SECONDS : (BigInteger)data;
        }

        [Safe]
        public static UInt160 AutomationAnchor() =>
            (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);

        [Safe]
        public static BigInteger GetAutomationTaskId()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            return data != null ? (BigInteger)data : 0;
        }

        #endregion

        #region Badge System (Optional)

        [Safe]
        public static bool HasBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static BigInteger GetUserBadgeCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BADGE_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger TotalUsers()
        {
            return (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);
        }

        protected static void AwardBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            IncrementUserBadgeCount(user);
            OnBadgeEarned(user, badgeType, badgeName);
        }

        protected static void IncrementUserBadgeCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_BADGE_COUNT, user);
            BigInteger current = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, current + 1);
        }

        protected static void IncrementTotalUsers()
        {
            BigInteger current = TotalUsers();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, current + 1);
        }

        #endregion

        #region Core Validation Methods

        protected static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        protected static void ValidateGateway()
        {
            UInt160 gw = Gateway();
            ExecutionEngine.Assert(gw != null && gw.IsValid, "gateway not set");
            ExecutionEngine.Assert(Runtime.CallingScriptHash == gw, "only gateway");
        }

        protected static void ValidateAddress(UInt160 addr)
        {
            ExecutionEngine.Assert(addr != null && addr.IsValid, "invalid address");
        }

        protected static void ValidateNotPaused()
        {
            ExecutionEngine.Assert(!IsPaused(), "paused");
        }

        protected static void ValidateNotGloballyPaused(string appId)
        {
            ValidateNotPaused();
            UInt160 registry = PauseRegistry();
            if (registry != null && registry.IsValid)
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
            ExecutionEngine.Assert(pending != null && pending.IsValid, "no pending admin");

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
            ExecutionEngine.Assert(pending != null && pending.IsValid, "no pending admin");

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

        #region Gateway & PaymentHub Management

        public static void SetGateway(UInt160 gw)
        {
            ValidateAdmin();
            ValidateAddress(gw);
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gw);
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

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
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

        #region Periodic Automation

        /// <summary>
        /// Periodic execution callback invoked by AutomationAnchor.
        /// SECURITY: Only AutomationAnchor can invoke this method.
        /// </summary>
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            if (anchor == UInt160.Zero || Runtime.CallingScriptHash != anchor) return;

            // No-op by default in Base. Derived classes should hide/override if needed.
        }

        public static BigInteger RegisterAutomation(string triggerType, string schedule)
        {
            ValidateAdmin();
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero, "automation anchor not set");

            // Call AutomationAnchor.RegisterPeriodicTask
            BigInteger taskId = (BigInteger)Contract.Call(anchor, "registerPeriodicTask", CallFlags.All,
                Runtime.ExecutingScriptHash, "onPeriodicExecution", triggerType, schedule, 1000000);

            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_TASK, taskId);
            return taskId;
        }

        public static void CancelAutomation()
        {
            ValidateAdmin();
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
            ExecutionEngine.Assert(data != null, "no automation registered");

            BigInteger taskId = (BigInteger)data;
            UInt160 anchor = AutomationAnchor();
            Contract.Call(anchor, "cancelPeriodicTask", CallFlags.All, taskId);

            Storage.Delete(Storage.CurrentContext, PREFIX_AUTOMATION_TASK);
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
            ExecutionEngine.Assert(hub != null && hub.IsValid, "payment hub not set");

            StorageMap used = new StorageMap(Storage.CurrentContext, PREFIX_RECEIPT_USED);
            ByteString receiptKey = (ByteString)receiptId.ToByteArray();
            ExecutionEngine.Assert(used.Get(receiptKey) == null, "receipt already used");

            object receiptObj = Contract.Call(hub, "getReceipt", CallFlags.ReadOnly, receiptId);
            ExecutionEngine.Assert(receiptObj != null, "receipt not found");

            object[] receipt = (object[])receiptObj;
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
    }
}
