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
    public delegate void ProposalCreatedHandler(string appId, BigInteger proposalId, UInt160 creator, BigInteger endTime);
    public delegate void VoteCastHandler(string appId, BigInteger proposalId, UInt160 voter, bool support, BigInteger amount);
    public delegate void ProposalFinalizedHandler(string appId, BigInteger proposalId, BigInteger status);
    public delegate void ProposalExecutedHandler(string appId, BigInteger proposalId, UInt160 executor);
    public delegate void ProposalRevokedHandler(string appId, BigInteger proposalId, UInt160 revoker);
    public delegate void NeoCreditedHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void CreditWithdrawnHandler(string appId, UInt160 payer, BigInteger amount);
    public delegate void VoteWithdrawnHandler(string appId, BigInteger proposalId, UInt160 voter, BigInteger amount);

    [DisplayName("PlatformGovernance")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tenant NEO-backed proposal, voting, quorum, execution receipt, and refund engine.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "balanceOf")]
    [ContractPermission("*", "isPaused")]
    public partial class PlatformGovernanceContract : MiniAppEngineBase
    {
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x09 };
        private static readonly byte[] PREFIX_UPGRADE_TIME = new byte[] { 0x0A };
        private static readonly byte[] PREFIX_UPGRADE_HASH = new byte[] { 0x0B };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_MIN_DURATION = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_MAX_DURATION = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_QUORUM = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_THRESHOLD_BPS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_PROPOSAL_COUNT = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_PROPOSAL = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_VOTE = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x18 };
        private static readonly byte[] PREFIX_NEO_CREDIT_LIABILITY = new byte[] { 0x19 };
        private static readonly byte[] PREFIX_VOTE_LIABILITY = new byte[] { 0x1A };
        private static readonly byte[] PREFIX_TOTAL_VOTE_LIABILITY = new byte[] { 0x1B };

        private const long DEFAULT_MIN_DURATION_SECONDS = 60;
        private const long DEFAULT_MAX_DURATION_SECONDS = 2_592_000;
        private const long DEFAULT_QUORUM = 1;
        private const long DEFAULT_THRESHOLD_BPS = 5_000;
        private const long MAX_TITLE_LENGTH = 80;
        private const long MAX_DESCRIPTION_LENGTH = 512;
        private const long MAX_ACTION_BYTES = 4_096;
        private const long MAX_DURATION_SECONDS = 31_536_000;
        private const long MAX_PROPOSALS = 10_000;
        private const long MAX_THRESHOLD_BPS = 10_000;
        private const long TIMELOCK_DELAY_MS = 86_400_000L;

        [DisplayName("AppActivated")]
        public static event AppActivatedHandler OnAppActivated;
        [DisplayName("AppPausedChanged")]
        public static event AppPausedChangedHandler OnAppPausedChanged;
        [DisplayName("ProposalCreated")]
        public static event ProposalCreatedHandler OnProposalCreated;
        [DisplayName("VoteCast")]
        public static event VoteCastHandler OnVoteCast;
        [DisplayName("ProposalFinalized")]
        public static event ProposalFinalizedHandler OnProposalFinalized;
        [DisplayName("ProposalExecuted")]
        public static event ProposalExecutedHandler OnProposalExecuted;
        [DisplayName("ProposalRevoked")]
        public static event ProposalRevokedHandler OnProposalRevoked;
        [DisplayName("NeoCredited")]
        public static event NeoCreditedHandler OnNeoCredited;
        [DisplayName("CreditWithdrawn")]
        public static event CreditWithdrawnHandler OnCreditWithdrawn;
        [DisplayName("VoteWithdrawn")]
        public static event VoteWithdrawnHandler OnVoteWithdrawn;

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
        public static BigInteger MinimumDurationOf(string appId) => ReadConfig(appId, PREFIX_MIN_DURATION, DEFAULT_MIN_DURATION_SECONDS);

        [Safe]
        public static BigInteger MaximumDurationOf(string appId) => ReadConfig(appId, PREFIX_MAX_DURATION, DEFAULT_MAX_DURATION_SECONDS);

        [Safe]
        public static BigInteger QuorumOf(string appId) => ReadConfig(appId, PREFIX_QUORUM, DEFAULT_QUORUM);

        [Safe]
        public static BigInteger ThresholdBpsOf(string appId) => ReadConfig(appId, PREFIX_THRESHOLD_BPS, DEFAULT_THRESHOLD_BPS);

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
