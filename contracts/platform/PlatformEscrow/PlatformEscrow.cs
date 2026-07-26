using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void AppActivatedHandler(string appId, UInt160 appAdmin);
    public delegate void AppPausedChangedHandler(string appId, bool paused);
    public delegate void EscrowCreatedHandler(string appId, BigInteger escrowId, UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount, BigInteger milestoneCount);
    public delegate void MilestoneApprovedHandler(string appId, BigInteger escrowId, BigInteger milestoneIndex, UInt160 approver);
    public delegate void MilestoneClaimedHandler(string appId, BigInteger escrowId, BigInteger milestoneIndex, UInt160 beneficiary, BigInteger amount);
    public delegate void EscrowCancelledHandler(string appId, BigInteger escrowId, UInt160 creator, BigInteger refundAmount);
    public delegate void ApprovedMilestoneReclaimedHandler(string appId, BigInteger escrowId, BigInteger milestoneIndex, UInt160 creator, BigInteger amount);
    public delegate void GasCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void NeoCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void CreditWithdrawnHandler(string appId, UInt160 payer, UInt160 asset, BigInteger amount);

    [DisplayName("PlatformEscrow")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant native-asset milestone escrow with approval, claim, refund, and timeout recovery.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "balanceOf")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer", "balanceOf")]
    [ContractPermission("*", "isPaused")]
    public partial class PlatformEscrowContract : MiniAppEngineBase
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x09 };
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x0A };
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x0B };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MAX_MILESTONES = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APPROVAL_GRACE = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_GAS_CREDIT_LIABILITY = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_NEO_CREDIT_LIABILITY = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_GAS_ESCROW_LIABILITY = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_NEO_ESCROW_LIABILITY = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_ESCROW_COUNT = new byte[] { 0x19 };
        private static readonly byte[] PREFIX_ESCROW = new byte[] { 0x1A };
        private static readonly byte[] PREFIX_CREATOR_COUNT = new byte[] { 0x1B };
        private static readonly byte[] PREFIX_CREATOR_INDEX = new byte[] { 0x1C };
        private static readonly byte[] PREFIX_BENEFICIARY_COUNT = new byte[] { 0x1D };
        private static readonly byte[] PREFIX_BENEFICIARY_INDEX = new byte[] { 0x1E };
        private static readonly byte[] PREFIX_MILESTONE = new byte[] { 0x1F };
        private static readonly byte[] PREFIX_TOTAL_GAS_CREDIT_LIABILITY = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOTAL_NEO_CREDIT_LIABILITY = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_TOTAL_GAS_ESCROW_LIABILITY = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_TOTAL_NEO_ESCROW_LIABILITY = new byte[] { 0x23 };

        private const long DEFAULT_MAX_MILESTONES = 12;
        private const long DEFAULT_APPROVAL_GRACE_MS = 2_592_000_000L;
        private const long MAX_INDEX_ENTRIES = 500;
        private const long MAX_PAGE_SIZE = 100;
        private const long MAX_APPROVERS = 16;
        private const long MAX_TITLE_LENGTH = 60;
        private const long MAX_NOTES_LENGTH = 240;
        private const long TIMELOCK_DELAY_MS = 86_400_000L;

        [DisplayName("AppActivated")]
        public static event AppActivatedHandler OnAppActivated;
        [DisplayName("AppPausedChanged")]
        public static event AppPausedChangedHandler OnAppPausedChanged;
        [DisplayName("EscrowCreated")]
        public static event EscrowCreatedHandler OnEscrowCreated;
        [DisplayName("MilestoneApproved")]
        public static event MilestoneApprovedHandler OnMilestoneApproved;
        [DisplayName("MilestoneClaimed")]
        public static event MilestoneClaimedHandler OnMilestoneClaimed;
        [DisplayName("EscrowCancelled")]
        public static event EscrowCancelledHandler OnEscrowCancelled;
        [DisplayName("ApprovedMilestoneReclaimed")]
        public static event ApprovedMilestoneReclaimedHandler OnApprovedMilestoneReclaimed;
        [DisplayName("GasCredited")]
        public static event GasCreditedHandler OnGasCredited;
        [DisplayName("NeoCredited")]
        public static event NeoCreditedHandler OnNeoCredited;
        [DisplayName("CreditWithdrawn")]
        public static event CreditWithdrawnHandler OnCreditWithdrawn;

        public static void _deploy(object data, bool update)
        {
            if (!update) Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [Safe]
        public static UInt160 Registry() => RegistryHash();

        [Safe]
        public static bool IsPaused()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_PAUSED);
            return raw != null && (BigInteger)raw == 1;
        }

        [Safe]
        public static UInt160 AppAdminOf(string appId) => TenantAdminOf(appId);

        [Safe]
        public static bool IsAppRegistered(string appId) => IsTenantRegistered(appId);

        [Safe]
        public static bool IsAppPaused(string appId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(appId, PREFIX_APP_PAUSED));
            return raw != null && (BigInteger)raw == 1;
        }

        [Safe]
        public static BigInteger MaxMilestonesOf(string appId) => ReadInteger(AppKey(appId, PREFIX_MAX_MILESTONES)) == 0
            ? DEFAULT_MAX_MILESTONES
            : ReadInteger(AppKey(appId, PREFIX_MAX_MILESTONES));

        [Safe]
        public static BigInteger ApprovalGracePeriodOf(string appId) => ReadInteger(AppKey(appId, PREFIX_APPROVAL_GRACE)) == 0
            ? DEFAULT_APPROVAL_GRACE_MS
            : ReadInteger(AppKey(appId, PREFIX_APPROVAL_GRACE));

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ByteString eta = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            ExecutionEngine.Assert(eta != null && Runtime.Time >= (BigInteger)eta, "upgrade timelock active");
            ByteString expected = Storage.Get(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ExecutionEngine.Assert(expected == CryptoLib.Sha256(Helper.Concat(nef, (ByteString)manifest)), "upgrade data mismatch");
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        public static void ScheduleUpdate(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(nef != null && nef.Length > 0 && manifest != null && manifest.Length > 0, "invalid upgrade artifact");
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_TIME, Runtime.Time + TIMELOCK_DELAY_MS);
            Storage.Put(Storage.CurrentContext, PREFIX_UPGRADE_HASH, CryptoLib.Sha256(Helper.Concat(nef, (ByteString)manifest)));
        }

        public static void CancelUpdate()
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_TIME);
            Storage.Delete(Storage.CurrentContext, PREFIX_UPGRADE_HASH);
        }

        public static void SetRegistry(UInt160 registry)
        {
            ValidateAdmin();
            ValidateAddress(registry);
            StoreRegistryHash(registry);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void RegisterApp(string appId, UInt160 appAdmin)
        {
            ValidateAdmin();
            ActivateLocalApp(appId, appAdmin);
        }

        public static void ActivateApp(string appId, UInt160 appAdmin, Map<string, object> descriptor)
        {
            RequireRegistryCaller();
            ExecutionEngine.Assert(!IsTenantRegistered(appId), "app already registered");
            ActivateTenant(appId, appAdmin);
            ApplyDescriptorMap(appId, descriptor);
            OnAppActivated(appId, appAdmin);
        }

        public static void ValidateAndApplyDescriptor(string appId, string key, object value)
        {
            RequireRegistryCaller();
            RequireRegistered(appId);
            ApplyDescriptor(appId, key, value);
        }

        public static void SetDescriptor(string appId, string key, object value)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId, Admin());
            ApplyDescriptor(appId, key, value);
        }

        public static void SetAppPaused(string appId, bool paused)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId, Admin());
            Storage.Put(Storage.CurrentContext, AppKey(appId, PREFIX_APP_PAUSED), paused ? 1 : 0);
            OnAppPausedChanged(appId, paused);
        }
    }
}
