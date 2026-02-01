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
    /// RedEnvelope MiniApp - Social gifting with random GAS distribution.
    ///
    /// KEY FEATURES:
    /// - Create red envelopes with random distribution
    /// - Lucky draw mechanism for recipients
    /// - Best luck bonus for highest draw
    /// - Refund unclaimed amounts after expiry
    /// - Social sharing with envelope links
    /// - Badge system for creators and claimers
    ///
    /// SECURITY:
    /// - Minimum amount requirements
    /// - Maximum packet limits
    /// - Expiration enforcement
    /// - Replay protection
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for envelopes and claims
    /// </summary>
    [DisplayName("MiniAppRedEnvelope")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "RedEnvelope is a social gifting application for random GAS distribution with lucky draw mechanics.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppRedEnvelope : MiniAppComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the RedEnvelope miniapp.</summary>
        /// <summary>Unique application identifier for the red-envelope miniapp.</summary>
        private const string APP_ID = "miniapp-redenvelope";
        
        /// <summary>Minimum envelope amount 0.1 GAS (10,000,000).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_AMOUNT = 10000000;
        
        /// <summary>Maximum packets per envelope.</summary>
        private const int MAX_PACKETS = 100;
        
        /// <summary>Default expiration time 24 hours (86,400 seconds).</summary>
        private const long DEFAULT_EXPIRY_SECONDS = 86400;
        
        /// <summary>Best luck bonus rate 0.05% (5 bps).</summary>
        /// <summary>Bonus amount .</summary>
        private const long BEST_LUCK_BONUS_RATE = 5;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppComputeBase)
        /// <summary>Prefix 0x40: Current envelope ID counter.</summary>
        /// <summary>Storage prefix for envelope id.</summary>
        private static readonly byte[] PREFIX_ENVELOPE_ID = new byte[] { 0x40 };
        
        /// <summary>Prefix 0x41: Envelope data storage.</summary>
        /// <summary>Storage prefix for envelopes.</summary>
        private static readonly byte[] PREFIX_ENVELOPES = new byte[] { 0x41 };
        
        /// <summary>Prefix 0x42: Grabber tracking per envelope.</summary>
        /// <summary>Storage prefix for grabber.</summary>
        private static readonly byte[] PREFIX_GRABBER = new byte[] { 0x42 };
        
        /// <summary>Prefix 0x43: Request to envelope mapping.</summary>
        /// <summary>Storage prefix for request to envelope.</summary>
        private static readonly byte[] PREFIX_REQUEST_TO_ENVELOPE = new byte[] { 0x43 };
        
        /// <summary>Prefix 0x44: Pre-generated random amounts.</summary>
        /// <summary>Storage prefix for amounts.</summary>
        private static readonly byte[] PREFIX_AMOUNTS = new byte[] { 0x44 };
        
        /// <summary>Prefix 0x45: User statistics.</summary>
        /// <summary>Storage prefix for user stats.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x45 };
        
        /// <summary>Prefix 0x47: Total envelopes created.</summary>
        /// <summary>Storage prefix for total envelopes.</summary>
        private static readonly byte[] PREFIX_TOTAL_ENVELOPES = new byte[] { 0x47 };
        
        /// <summary>Prefix 0x48: Total GAS distributed.</summary>
        /// <summary>Storage prefix for total distributed.</summary>
        private static readonly byte[] PREFIX_TOTAL_DISTRIBUTED = new byte[] { 0x48 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Red envelope data.
        /// FIELDS:
        /// - Creator: Envelope creator address
        /// - TotalAmount: Total GAS in envelope
        /// - PacketCount: Number of packets to distribute
        /// - ClaimedCount: Number of packets claimed
        /// - RemainingAmount: Unclaimed GAS remaining
        /// - BestLuckAddress: Address with highest claim
        /// - BestLuckAmount: Highest claim amount
        /// - Ready: Whether envelope is ready for claiming
        /// - ExpiryTime: Expiration timestamp
        /// - Message: Optional message from creator
        /// </summary>
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

        /// <summary>
        /// User statistics.
        /// FIELDS:
        /// - EnvelopesCreated: Count of envelopes created
        /// - EnvelopesClaimed: Count of envelopes claimed
        /// - TotalSent: Total GAS sent in envelopes
        /// - TotalReceived: Total GAS received from claims
        /// - BestLuckWins: Count of best luck wins
        /// - HighestSingleClaim: Largest single claim
        /// - HighestEnvelopeCreated: Largest envelope created
        /// - BadgeCount: Badges earned
        /// - JoinTime: First activity timestamp
        /// - LastActivityTime: Most recent activity
        /// </summary>
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

        #region Event Delegates
        /// <summary>Event emitted when envelope is created.</summary>
        /// <param name="envelopeId">New envelope identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="totalAmount">Total GAS in envelope.</param>
        /// <param name="packetCount">Number of packets.</param>
        /// <summary>Event emitted when envelope created.</summary>
    public delegate void EnvelopeCreatedHandler(BigInteger envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount);
        
        /// <summary>Event emitted when packet is claimed.</summary>
        /// <param name="envelopeId">Envelope identifier.</param>
        /// <param name="claimer">Claimer address.</param>
        /// <param name="amount">Amount claimed.</param>
        /// <param name="remaining">Packets remaining.</param>
        /// <summary>Event emitted when envelope claimed.</summary>
    public delegate void EnvelopeClaimedHandler(BigInteger envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining);
        
        /// <summary>Event emitted when envelope is fully claimed.</summary>
        /// <param name="envelopeId">Envelope identifier.</param>
        /// <param name="bestLuckWinner">Best luck winner address.</param>
        /// <param name="bestLuckAmount">Best luck amount.</param>
        /// <summary>Event emitted when envelope completed.</summary>
    public delegate void EnvelopeCompletedHandler(BigInteger envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount);
        
        /// <summary>Event emitted on periodic execution.</summary>
        /// <param name="taskId">Task identifier.</param>
        /// <summary>Event emitted when periodic execution triggered.</summary>
    public delegate void PeriodicExecutionTriggeredHandler(BigInteger taskId);
        
        /// <summary>Event emitted when unclaimed envelope is refunded.</summary>
        /// <param name="envelopeId">Envelope identifier.</param>
        /// <param name="creator">Creator receiving refund.</param>
        /// <param name="refundAmount">Refund amount.</param>
        /// <summary>Event emitted when envelope refunded.</summary>
    public delegate void EnvelopeRefundedHandler(BigInteger envelopeId, UInt160 creator, BigInteger refundAmount);
        
        /// <summary>Event emitted when user earns a badge.</summary>
        /// <param name="user">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        /// <summary>Event emitted when user badge earned.</summary>
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
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
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_ENVELOPE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets current envelope count.
        /// </summary>
        /// <returns>Total envelopes created.</returns>
        [Safe]
        public static BigInteger GetEnvelopeCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ENVELOPE_ID);

        /// <summary>
        /// Gets total envelopes (same as count).
        /// </summary>
        /// <returns>Total envelopes.</returns>
        [Safe]
        public static BigInteger GetTotalEnvelopes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ENVELOPES);

        /// <summary>
        /// Gets total GAS distributed.
        /// </summary>
        /// <returns>Total distributed amount.</returns>
        [Safe]
        public static BigInteger GetTotalDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED);

        /// <summary>
        /// Gets user statistics.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>User stats struct.</returns>
        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_USER_STATS, (ByteString)user));
            if (data == null) return new UserStats();
            return (UserStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets envelope data by ID.
        /// </summary>
        /// <param name="envelopeId">Envelope identifier.</param>
        /// <returns>Envelope data struct.</returns>
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
