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
    /// StreamVault MiniApp - Time-based release vaults for payrolls and subscriptions.
    ///
    /// KEY FEATURES:
    /// - Create streams with NEO or GAS deposits
    /// - Fixed interval releases (daily, weekly, monthly)
    /// - Beneficiary claims on schedule
    /// - Creator can cancel and reclaim remaining
    /// - Transparent release schedule
    /// - Multiple active streams per user
    ///
    /// SECURITY:
    /// - Minimum/maximum interval limits
    /// - Only beneficiary can claim
        /// - Creator cancellation rights
        /// - Anti-manipulation time checks
    ///
    /// PERMISSIONS:
    /// - NEO token transfers
    /// - GAS token transfers
    /// </summary>
    [DisplayName("MiniAppStreamVault")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "StreamVault creates time-based release vaults for payrolls and subscriptions.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    [ContractPermission("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5", "*")]  // NEO token
    public partial class MiniAppStreamVault : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the StreamVault miniapp.</summary>
        /// <summary>Unique application identifier for the stream-vault miniapp.</summary>
        private const string APP_ID = "miniapp-stream-vault";
        
        /// <summary>Minimum NEO amount (1 NEO).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_NEO = 1;
        
        /// <summary>Minimum GAS amount (0.1 GAS).</summary>
        /// <summary>Minimum value for operation.</summary>
        private const long MIN_GAS = 10000000;
        
        /// <summary>Minimum interval 1 day (86,400 seconds).</summary>
        private const int MIN_INTERVAL_SECONDS = 86400;
        
        /// <summary>Maximum interval 365 days (31,536,000 seconds).</summary>
        private const int MAX_INTERVAL_SECONDS = 31536000;
        
        /// <summary>Maximum title length.</summary>
        private const int MAX_TITLE_LENGTH = 60;
        
        /// <summary>Maximum notes length.</summary>
        private const int MAX_NOTES_LENGTH = 240;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: Current stream ID counter.</summary>
        /// <summary>Storage prefix for stream id.</summary>
        private static readonly byte[] PREFIX_STREAM_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Stream data storage.</summary>
        /// <summary>Storage prefix for streams.</summary>
        private static readonly byte[] PREFIX_STREAMS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: User stream list (as creator).</summary>
        /// <summary>Storage prefix for user streams.</summary>
        private static readonly byte[] PREFIX_USER_STREAMS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: User stream count (as creator).</summary>
        /// <summary>Storage prefix for user stream count.</summary>
        private static readonly byte[] PREFIX_USER_STREAM_COUNT = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Beneficiary stream list.</summary>
        /// <summary>Storage prefix for beneficiary streams.</summary>
        private static readonly byte[] PREFIX_BENEFICIARY_STREAMS = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Beneficiary stream count.</summary>
        /// <summary>Storage prefix for beneficiary stream count.</summary>
        private static readonly byte[] PREFIX_BENEFICIARY_STREAM_COUNT = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Total value locked.</summary>
        /// <summary>Storage prefix for total locked.</summary>
        private static readonly byte[] PREFIX_TOTAL_LOCKED = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Total value released.</summary>
        /// <summary>Storage prefix for total released.</summary>
        private static readonly byte[] PREFIX_TOTAL_RELEASED = new byte[] { 0x27 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Stream vault data structure.
        /// FIELDS:
        /// - Creator: Stream creator address
        /// - Beneficiary: Payment recipient
        /// - Asset: Token contract hash (NEO or GAS)
        /// - TotalAmount: Total deposited amount
        /// - ReleasedAmount: Amount already released
        /// - RateAmount: Amount per interval
        /// - IntervalSeconds: Time between releases
        /// - StartTime: Stream start timestamp
        /// - LastClaimTime: Last successful claim
        /// - CreatedTime: Creation timestamp
        /// - Active: Whether stream is active
        /// - Cancelled: Whether cancelled by creator
        /// - Title: Stream title
        /// - Notes: Additional notes
        /// </summary>
        public struct StreamData
        {
            public UInt160 Creator;
            public UInt160 Beneficiary;
            public UInt160 Asset;
            public BigInteger TotalAmount;
            public BigInteger ReleasedAmount;
            public BigInteger RateAmount;
            public BigInteger IntervalSeconds;
            public BigInteger StartTime;
            public BigInteger LastClaimTime;
            public BigInteger CreatedTime;
            public bool Active;
            public bool Cancelled;
            public string Title;
            public string Notes;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when stream is created.</summary>
        /// <param name="streamId">New stream identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="beneficiary">Beneficiary address.</param>
        /// <param name="asset">Asset contract hash.</param>
        /// <param name="totalAmount">Total deposited amount.</param>
        /// <param name="rateAmount">Amount per interval.</param>
        /// <param name="intervalSeconds">Seconds between releases.</param>
        /// <summary>Event emitted when stream created.</summary>
    public delegate void StreamCreatedHandler(BigInteger streamId, UInt160 creator, UInt160 beneficiary, UInt160 asset, BigInteger totalAmount, BigInteger rateAmount, BigInteger intervalSeconds);
        
        /// <summary>Event emitted when beneficiary claims.</summary>
        /// <param name="streamId">Stream identifier.</param>
        /// <param name="beneficiary">Claiming beneficiary.</param>
        /// <param name="amount">Amount claimed.</param>
        /// <param name="totalReleased">Total released to date.</param>
        /// <summary>Event emitted when stream claimed.</summary>
    public delegate void StreamClaimedHandler(BigInteger streamId, UInt160 beneficiary, BigInteger amount, BigInteger totalReleased);
        
        /// <summary>Event emitted when stream is cancelled.</summary>
        /// <param name="streamId">Stream identifier.</param>
        /// <param name="creator">Cancelling creator.</param>
        /// <param name="refundAmount">Refund amount.</param>
        /// <summary>Event emitted when stream cancelled.</summary>
    public delegate void StreamCancelledHandler(BigInteger streamId, UInt160 creator, BigInteger refundAmount);
        
        /// <summary>Event emitted when stream completes.</summary>
        /// <param name="streamId">Stream identifier.</param>
        /// <param name="beneficiary">Final beneficiary.</param>
        /// <summary>Event emitted when stream completed.</summary>
    public delegate void StreamCompletedHandler(BigInteger streamId, UInt160 beneficiary);
        #endregion

        #region Events
        [DisplayName("StreamCreated")]
        public static event StreamCreatedHandler OnStreamCreated;

        [DisplayName("StreamClaimed")]
        public static event StreamClaimedHandler OnStreamClaimed;

        [DisplayName("StreamCancelled")]
        public static event StreamCancelledHandler OnStreamCancelled;

        [DisplayName("StreamCompleted")]
        public static event StreamCompletedHandler OnStreamCompleted;
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
            Storage.Put(Storage.CurrentContext, PREFIX_STREAM_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_RELEASED, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets total streams created.
        /// </summary>
        /// <returns>Total stream count.</returns>
        [Safe]
        public static BigInteger TotalStreams() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_STREAM_ID);

        /// <summary>
        /// Gets total value locked across all streams.
        /// </summary>
        /// <returns>Total locked amount.</returns>
        [Safe]
        public static BigInteger TotalLocked() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_LOCKED);

        /// <summary>
        /// Gets total value released to beneficiaries.
        /// </summary>
        /// <returns>Total released amount.</returns>
        [Safe]
        public static BigInteger TotalReleased() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_RELEASED);

        /// <summary>
        /// Gets stream data by ID.
        /// </summary>
        /// <param name="streamId">Stream identifier.</param>
        /// <returns>Stream data struct.</returns>
        [Safe]
        public static StreamData GetStream(BigInteger streamId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_STREAMS, (ByteString)streamId.ToByteArray()));
            if (data == null) return new StreamData();
            return (StreamData)StdLib.Deserialize(data);
        }
        #endregion
    }
}
