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
    // Event Delegates
    public delegate void EnvelopeCreatedHandler(BigInteger envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount);
    // Legacy RngRequested might be needed if other partials use it, but One-Phase removes it?
    // Methods.cs CreateEnvelope emits OnEnvelopeCreated.
    // Let's keep common delegates.
    public delegate void EnvelopeClaimedHandler(BigInteger envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining);
    public delegate void EnvelopeCompletedHandler(BigInteger envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount);
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
    public delegate void EnvelopeRefundedHandler(BigInteger envelopeId, UInt160 creator, BigInteger refundAmount);
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
    
    [DisplayName("MiniAppRedEnvelope")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. RedEnvelope is a social gifting application for random GAS distribution.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppRedEnvelope : MiniAppComputeBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-redenvelope";
        private const long MIN_AMOUNT = 10000000;
        private const int MAX_PACKETS = 100;
        private const long DEFAULT_EXPIRY_SECONDS = 86400;
        private const long BEST_LUCK_BONUS_RATE = 5;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with Bases)
        private static readonly byte[] PREFIX_ENVELOPE_ID = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_ENVELOPES = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_GRABBER = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_REQUEST_TO_ENVELOPE = new byte[] { 0x43 }; // Legacy/Unused in 1-phase
        private static readonly byte[] PREFIX_AMOUNTS = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x45 };
        // PREFIX_USER_BADGES collision? MiniAppBase uses 0x0C.
        // Let's use 0x46 for RedEnvelope specific badges if needed, or re-use base?
        // MiniAppBase handles badges generically. 
        // But RedEnvelope might want its own badge storage if it tracks specific badge data?
        // Actually Base handles PREFIX_USER_BADGES. 
        // RedEnvelope.cs in Step 475 had PREFIX_USER_BADGES = 0x46. 
        // If we inherit MiniAppBase, we should use Base's badge system OR override prefixes?
        // Base PREFIX_USER_BADGES is 0x0C.
        // Let's use Base's badges. Remove local definition or map it.
        // Use local definition for safety to match previous data layout if existing?
        // User rules: "Refine... existing codebase". If previous version used 0x46, we should stick to it 
        // OR migrate. Since we are refactoring, sticking to 0x46 is safer for data compatibility if we were upgrading.
        // But Base class uses 0x0C. 
        // Let's define it here as PREFIX_APP_USER_BADGES to avoid name collision with Base.PREFIX_USER_BADGES.
        // Stats.cs calls CheckUserBadges -> AwardBadge (Base method).
        // Base method uses PREFIX_USER_BADGES (0x0C).
        // If we want to use Base's system, we use 0x0C.
        // If we want to keep old data (0x46), we have a problem.
        // Assuming this is a new deployment or major upgrade where we accept data migration or loss (user said "Create a new codebase" in context of task, but likely maintaining).
        // Let's stick to Base for consistency.
        
        private static readonly byte[] PREFIX_TOTAL_ENVELOPES = new byte[] { 0x47 };
        private static readonly byte[] PREFIX_TOTAL_DISTRIBUTED = new byte[] { 0x48 };
        // PREFIX_TOTAL_USERS in Base is 0x0E.
        // RedEnvelope used 0x49.
        // Let's use Base's PREFIX_TOTAL_USERS (0x0E) by using IncrementTotalUsers().
        #endregion

        #region Data Structures
        public struct EnvelopeData
        {
            public UInt160 Creator;
            public BigInteger TotalAmount;
            public BigInteger PacketCount;
            public BigInteger ClaimedCount;
            public BigInteger RemainingAmount;
            public UInt160 BestLuckAddress;
            public BigInteger BestLuckAmount;
            public bool Ready;
            public BigInteger ExpiryTime;
            public string Message;
        }

        public struct UserStats
        {
            public BigInteger EnvelopesCreated;
            public BigInteger EnvelopesClaimed;
            public BigInteger TotalSent;
            public BigInteger TotalReceived;
            public BigInteger BestLuckWins;
            public BigInteger HighestSingleClaim;
            public BigInteger HighestEnvelopeCreated;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
        }
        #endregion

        #region App Events
        [DisplayName("EnvelopeCreated")]
        public static event EnvelopeCreatedHandler OnEnvelopeCreated;

        [DisplayName("EnvelopeClaimed")]
        public static event EnvelopeClaimedHandler OnEnvelopeClaimed;

        [DisplayName("EnvelopeCompleted")]
        public static event EnvelopeCompletedHandler OnEnvelopeCompleted;

        [DisplayName("PeriodicExecutionTriggered")]
        public static event PeriodicExecutionTriggeredHandler OnPeriodicExecutionTriggered;

        [DisplayName("EnvelopeRefunded")]
        public static event EnvelopeRefundedHandler OnEnvelopeRefunded;

        // Base class provides OnBadgeEarned, OnPaused etc.
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            // Initialize Core
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            
            // Initialize App
            Storage.Put(Storage.CurrentContext, PREFIX_ENVELOPE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED, 0);
            // PREFIX_TOTAL_USERS initialized in Base? Base doesn't have _deploy. 
            // We should init it if we use it.
            // Base uses PREFIX_TOTAL_USERS (0x0E).
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger GetEnvelopeCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID);

        [Safe]
        public static BigInteger GetTotalEnvelopes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES);

        [Safe]
        public static BigInteger GetTotalDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED);

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, (ByteString)user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static EnvelopeData GetEnvelope(BigInteger envelopeId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ENVELOPES, (ByteString)envelopeId.ToByteArray()));
            if (data == null) return new EnvelopeData();
            return (EnvelopeData)StdLib.Deserialize(data);
        }
        #endregion
    }
}
