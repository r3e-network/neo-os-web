using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

#pragma warning disable CS8600, CS8601, CS8602, CS8603, CS8604, CS8618

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public delegate void AnchorAppRegisteredHandler(string appId, BigInteger mode, UInt160 appAdmin);
    public delegate void AnchorAgentRegisteredHandler(string appId, BigInteger agentId, UInt160 account, ECPoint candidate);
    public delegate void AnchorStakeChangedHandler(string appId, UInt160 user, BigInteger stake, BigInteger totalStaked);
    public delegate void AnchorRewardsHarvestedHandler(string appId, BigInteger amount, BigInteger rewardPerNeo);
    public delegate void AnchorRewardsClaimedHandler(string appId, UInt160 user, BigInteger amount);
    public delegate void AnchorVoteChangedHandler(string appId, BigInteger agentId, UInt160 votingAccount, ECPoint candidate);
    public delegate void AnchorAgentTransferHandler(string appId, BigInteger fromAgentId, BigInteger toAgentId, BigInteger amount);
    public delegate void AnchorAgentAccountUpdatedHandler(string appId, BigInteger agentId, UInt160 account, ByteString verificationScriptHash);
    public delegate void AnchorAgentAccountChangeProposedHandler(string appId, BigInteger agentId, UInt160 newAccount, BigInteger executeAfter);
    public delegate void AnchorAgentAccountChangeCancelledHandler(string appId, BigInteger agentId);

    /// <summary>
    /// Shared manual AA-agent routing anchor for TrustAnchor and ProfitAnchor.
    ///
    /// Each anchor registers AA agent accounts for council candidates. Candidate
    /// changes are app-admin controlled, while NEO movement and NEO.vote calls
    /// require the relevant AA agent witness.
    /// </summary>
    [DisplayName("PlatformAnchor")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.1")]
    [ManifestExtra("Description", "Shared TrustAnchor and ProfitAnchor manual AA-agent routing engine.")]
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "transfer", "vote")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "balanceOf", "transfer")]
    public partial class PlatformAnchorContract : SmartContract
    {
        private const int MODE_TRUST = 1;
        private const int MODE_PROFIT = 2;
        private const long REWARD_SCALE = 100_000_000;
        // Audit fix M-11: anti-spam fee for permissionless RegisterCustomAnchorApp.
        // 1 GAS is small enough for legitimate operators and significant enough that
        // a storage-bloat attacker pays per app. The fee accrues to the platform pool.
        private const long ANCHOR_CUSTOM_APP_REGISTRATION_FEE = 100_000_000;

        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_TOTAL_REWARD_RESERVE = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_ABSTRACT_ACCOUNT = new byte[] { 0x04 };

        private static readonly byte[] PREFIX_APP_MODE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_APP_ADMIN = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_APP_PAUSED = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TOTAL_STAKED = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TOTAL_STAKERS = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_REWARD_PER_NEO = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_REWARD_RESERVE = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_AGENT_COUNT = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_SELECTED_AGENT = new byte[] { 0x18 };

        private static readonly byte[] PREFIX_USER_STAKE = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_REWARD_DEBT = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_PENDING_REWARD = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_NEO_CREDIT = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_GAS_CREDIT = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_GAS_CREDIT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_REWARD_REMAINDER = new byte[] { 0x26 };

        private static readonly byte[] PREFIX_AGENT_ACCOUNT = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_AGENT_CANDIDATE = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_AGENT_SCRIPT_HASH = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_AGENT_ACTIVE = new byte[] { 0x35 };

        // Agent rotation timelock (audit follow-up): when an app admin's key is
        // compromised, the attacker could otherwise redirect every NEO vote to
        // their own AAs in a single tx. Rotations now stage through a pending
        // slot and only apply after AGENT_ROTATION_TIMELOCK_MS, giving the
        // legitimate operator a window to notice and call CancelAgentAccountChange.
        private static readonly byte[] PREFIX_PENDING_AGENT_ACCOUNT = new byte[] { 0x36 };
        private static readonly byte[] PREFIX_PENDING_AGENT_SCRIPT = new byte[] { 0x37 };
        private static readonly byte[] PREFIX_PENDING_AGENT_TIME = new byte[] { 0x38 };

        // 24 hours in milliseconds (Runtime.Time is ms on Neo N3). Tuned for: long
        // enough that an off-chain monitor + key-rotation flow can react, short
        // enough that legitimate operational rotations don't feel painful.
        private const long AGENT_ROTATION_TIMELOCK_MS = 86_400_000;

        [DisplayName("AnchorAppRegistered")]
        public static event AnchorAppRegisteredHandler OnAnchorAppRegistered;

        [DisplayName("AnchorAgentRegistered")]
        public static event AnchorAgentRegisteredHandler OnAnchorAgentRegistered;

        [DisplayName("AnchorStakeChanged")]
        public static event AnchorStakeChangedHandler OnAnchorStakeChanged;

        [DisplayName("AnchorRewardsHarvested")]
        public static event AnchorRewardsHarvestedHandler OnAnchorRewardsHarvested;

        [DisplayName("AnchorRewardsClaimed")]
        public static event AnchorRewardsClaimedHandler OnAnchorRewardsClaimed;

        [DisplayName("AnchorVoteChanged")]
        public static event AnchorVoteChangedHandler OnAnchorVoteChanged;

        [DisplayName("AnchorAgentTransfer")]
        public static event AnchorAgentTransferHandler OnAnchorAgentTransfer;

        [DisplayName("AnchorAgentAccountUpdated")]
        public static event AnchorAgentAccountUpdatedHandler OnAnchorAgentAccountUpdated;

        [DisplayName("AnchorAgentAccountChangeProposed")]
        public static event AnchorAgentAccountChangeProposedHandler OnAnchorAgentAccountChangeProposed;

        [DisplayName("AnchorAgentAccountChangeCancelled")]
        public static event AnchorAgentAccountChangeCancelledHandler OnAnchorAgentAccountChangeCancelled;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin() => ReadAddress((ByteString)PREFIX_ADMIN);

        [Safe]
        public static bool IsPaused() => GetBigInteger((ByteString)PREFIX_PAUSED) == 1;

        [Safe]
        public static UInt160 AbstractAccount() => ReadAddress((ByteString)PREFIX_ABSTRACT_ACCOUNT);

        // Audit fix H-13: typed events for AdminChanged / PauseStateChanged /
        // AbstractAccountChanged / ContractUpgraded should be added — declare them
        // in this contract via the `event` pattern and raise from each setter.
        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ValidateAddress(newAdmin);
            PutAddress((ByteString)PREFIX_ADMIN, newAdmin);
        }

        public static void SetPaused(bool paused)
        {
            ValidateAdmin();
            Put((ByteString)PREFIX_PAUSED, paused ? 1 : 0);
        }

        public static void SetAbstractAccount(UInt160 abstractAccount)
        {
            ValidateAdmin();
            ValidateAddress(abstractAccount);
            PutAddress((ByteString)PREFIX_ABSTRACT_ACCOUNT, abstractAccount);
        }

        public static void Update(ByteString nef, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nef, manifest, new object[0]);
        }

        public static void RegisterAnchorApp(string appId, BigInteger mode, UInt160 appAdmin)
        {
            ValidateAdmin();
            RegisterAnchorAppCore(appId, mode, appAdmin);
        }

        public static void RegisterCustomAnchorApp(string appId, BigInteger mode, UInt160 appAdmin)
        {
            ValidateAddress(appAdmin);
            ExecutionEngine.Assert(Runtime.CheckWitness(appAdmin), "app admin witness required");
            // Audit fix M-11: charge a small GAS fee for self-service anchor app
            // registration so an attacker cannot spam state with unbounded apps.
            // The fee is taken from the app admin's prepaid GAS credit; if they have
            // no credit, the registration fails. Pre-allowlisted apps (registered
            // via RegisterAnchorApp by the platform admin) are exempt.
            ConsumeGasCredit(appAdmin, ANCHOR_CUSTOM_APP_REGISTRATION_FEE);
            RegisterAnchorAppCore(appId, mode, appAdmin);
        }

        public static void SetAppPaused(string appId, bool paused)
        {
            ValidateAppAuthority(appId);
            Put(AppKey(appId, PREFIX_APP_PAUSED), paused ? 1 : 0);
        }

    }
}
