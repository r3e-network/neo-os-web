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
    // Event delegates for governance mercenary lifecycle
    public delegate void MercDepositHandler(UInt160 depositor, BigInteger amount, BigInteger newTotal);
    public delegate void MercWithdrawHandler(UInt160 depositor, BigInteger amount, BigInteger reward);
    public delegate void BidPlacedHandler(BigInteger epoch, UInt160 candidate, BigInteger bidAmount);
    public delegate void EpochStartedHandler(BigInteger epoch, BigInteger startTime, BigInteger endTime);
    public delegate void EpochSettledHandler(BigInteger epoch, UInt160 winner, BigInteger totalBid);
    public delegate void RewardClaimedHandler(UInt160 depositor, BigInteger epoch, BigInteger reward);
    public delegate void DelegationActiveHandler(BigInteger epoch, UInt160 winner, BigInteger votingPower);
    public delegate void DepositorBadgeEarnedHandler(UInt160 depositor, BigInteger badgeType, string badgeName);

    /// <summary>
    /// GovMerc MiniApp - Complete governance voting power marketplace.
    ///
    /// FEATURES:
    /// - Deposit NEO to contribute voting power
    /// - Weekly epochs for bidding cycles
    /// - Competitive bidding for delegation rights
    /// - Proportional reward distribution to depositors
    /// - Epoch history and statistics
    /// - Automatic epoch transitions
    ///
    /// MECHANICS:
    /// - Depositors stake NEO, earn share of winning bids
    /// - Bidders compete for voting power delegation
    /// - Highest bidder wins epoch's voting rights
    /// - Bid proceeds distributed to depositors
    /// </summary>
    [DisplayName("MiniAppGovMerc")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. GovMerc is a complete governance voting power marketplace with epoch-based bidding, proportional rewards, and automated delegation management.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppGovMerc : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-gov-merc";
        private const int EPOCH_DURATION_SECONDS = 604800;  // 7 days
        private const long MIN_DEPOSIT = 100000000;       // 1 NEO minimum
        private const long MIN_BID = 10000000;            // 0.1 GAS minimum
        private const int PLATFORM_FEE_BPS = 500;         // 5% platform fee
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        private static readonly byte[] PREFIX_DEPOSITS = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOTAL_POOL = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_CURRENT_EPOCH = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_EPOCHS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_EPOCH_BIDS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_REWARDS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_DISTRIBUTED = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_DEPOSITOR_STATS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_DEPOSITOR_BADGES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_DEPOSITORS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_BIDDERS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        public struct Deposit
        {
            public BigInteger Amount;
            public BigInteger DepositTime;
            public BigInteger LastClaimEpoch;
        }

        public struct Epoch
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger TotalBids;
            public BigInteger HighestBid;
            public UInt160 Winner;
            public BigInteger VotingPower;
            public bool Settled;
        }

        public struct DepositorStats
        {
            public BigInteger TotalDeposited;
            public BigInteger TotalWithdrawn;
            public BigInteger TotalRewardsClaimed;
            public BigInteger EpochsParticipated;
            public BigInteger HighestDeposit;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger BidsPlaced;
            public BigInteger BidsWon;
            public BigInteger TotalBidAmount;
        }
        #endregion

        #region App Events
        [DisplayName("MercDeposit")]
        public static event MercDepositHandler OnMercDeposit;

        [DisplayName("MercWithdraw")]
        public static event MercWithdrawHandler OnMercWithdraw;

        [DisplayName("BidPlaced")]
        public static event BidPlacedHandler OnBidPlaced;

        [DisplayName("EpochStarted")]
        public static event EpochStartedHandler OnEpochStarted;

        [DisplayName("EpochSettled")]
        public static event EpochSettledHandler OnEpochSettled;

        [DisplayName("RewardClaimed")]
        public static event RewardClaimedHandler OnRewardClaimed;

        [DisplayName("DelegationActive")]
        public static event DelegationActiveHandler OnDelegationActive;

        [DisplayName("DepositorBadgeEarned")]
        public static event DepositorBadgeEarnedHandler OnDepositorBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_CURRENT_EPOCH, 1);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DEPOSITORS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BIDDERS, 0);

            // Initialize first epoch
            Epoch firstEpoch = new Epoch
            {
                Id = 1,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + EPOCH_DURATION_SECONDS,
                TotalBids = 0,
                HighestBid = 0,
                Winner = UInt160.Zero,
                VotingPower = 0,
                Settled = false
            };
            StoreEpoch(1, firstEpoch);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POOL);

        [Safe]
        public static BigInteger GetCurrentEpochId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_CURRENT_EPOCH);

        [Safe]
        public static BigInteger TotalDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED);

        [Safe]
        public static Deposit GetDeposit(UInt160 depositor)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DEPOSITS, depositor));
            if (data == null) return new Deposit();
            return (Deposit)StdLib.Deserialize(data);
        }

        [Safe]
        public static Epoch GetEpoch(BigInteger epochId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_EPOCHS, (ByteString)epochId.ToByteArray()));
            if (data == null) return new Epoch();
            return (Epoch)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetUserBid(BigInteger epochId, UInt160 bidder)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_EPOCH_BIDS, (ByteString)epochId.ToByteArray()),
                bidder);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetPendingRewards(UInt160 depositor)
        {
            byte[] key = Helper.Concat(PREFIX_USER_REWARDS, depositor);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger TotalDepositors() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_DEPOSITORS);

        [Safe]
        public static BigInteger TotalBidders() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BIDDERS);

        [Safe]
        public static DepositorStats GetDepositorStats(UInt160 depositor)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_DEPOSITOR_STATS, depositor));
            if (data == null) return new DepositorStats();
            return (DepositorStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static bool HasDepositorBadge(UInt160 depositor, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_DEPOSITOR_BADGES, depositor),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
