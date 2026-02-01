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
    /// DoomsdayClock MiniApp - FOMO3D-style countdown game with dividends.
    ///
    /// KEY FEATURES:
    /// - Buy keys to extend the countdown timer
    /// - Winner takes pot when timer reaches zero
    /// - Dividends for key holders from new purchases
    /// - Referral rewards for bringing new players
    /// - Multiple rounds with increasing difficulty
    /// - Badge system for achievements
    ///
    /// SECURITY:
    /// - Key price increases dynamically
    /// - Time extensions per key capped
    /// - Maximum duration limits
    /// - Secure fund distribution
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for purchases and rewards
    /// </summary>
    [DisplayName("MiniAppDoomsdayClock")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "DoomsdayClock is a complete FOMO3D style countdown game with keys, dividends, referrals, and escalating rounds.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppDoomsdayClock : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the DoomsdayClock miniapp.</summary>
        /// <summary>Unique application identifier for the doomsday-clock miniapp.</summary>
        private const string APP_ID = "miniapp-doomsday-clock";
        
        /// <summary>Platform fee 5% (500 bps).</summary>
        private const int PLATFORM_FEE_BPS = 500;
        
        /// <summary>Winner share 48% (4800 bps).</summary>
        private const int WINNER_SHARE_BPS = 4800;
        
        /// <summary>Dividend share 30% (3000 bps) distributed to key holders.</summary>
        private const int DIVIDEND_SHARE_BPS = 3000;
        
        /// <summary>Next round seed 10% (1000 bps).</summary>
        private const int NEXT_ROUND_SHARE_BPS = 1000;
        
        /// <summary>Referral share 7% (700 bps).</summary>
        private const int REFERRAL_SHARE_BPS = 700;
        
        /// <summary>Base key price 0.1 GAS (10,000,000).</summary>
        private const long BASE_KEY_PRICE = 10000000;
        
        /// <summary>Key price increment per key sold 0.1% (10 bps).</summary>
        private const int KEY_PRICE_INCREMENT_BPS = 10;
        
        /// <summary>Seconds added per key purchase (30 seconds).</summary>
        private const long TIME_ADDED_PER_KEY_SECONDS = 30;
        
        /// <summary>Initial round duration 1 hour (3600 seconds).</summary>
        private const long INITIAL_DURATION_SECONDS = 3600;
        
        /// <summary>Maximum round duration 24 hours (86400 seconds).</summary>
        private const long MAX_DURATION_SECONDS = 86400;
        
        /// <summary>Minimum keys per purchase.</summary>
        /// <summary>Minimum value for operation.</summary>
        /// <summary>Configuration constant .</summary>
        private const long MIN_KEYS = 1;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: Current round ID counter.</summary>
        /// <summary>Storage prefix for round id.</summary>
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Round data storage.</summary>
        /// <summary>Storage prefix for rounds.</summary>
        private static readonly byte[] PREFIX_ROUNDS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Player keys per round.</summary>
        /// <summary>Storage prefix for player keys.</summary>
        private static readonly byte[] PREFIX_PLAYER_KEYS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Player statistics.</summary>
        /// <summary>Storage prefix for player stats.</summary>
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Total keys sold across all rounds.</summary>
        /// <summary>Storage prefix for total keys sold.</summary>
        private static readonly byte[] PREFIX_TOTAL_KEYS_SOLD = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Total pot distributed.</summary>
        /// <summary>Storage prefix for total pot distributed.</summary>
        private static readonly byte[] PREFIX_TOTAL_POT_DISTRIBUTED = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: Referral tracking.</summary>
        /// <summary>Storage prefix for referrals.</summary>
        private static readonly byte[] PREFIX_REFERRALS = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: Dividends claimed tracking.</summary>
        /// <summary>Storage prefix for dividends claimed.</summary>
        private static readonly byte[] PREFIX_DIVIDENDS_CLAIMED = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: Player badges.</summary>
        /// <summary>Storage prefix for player badges.</summary>
        private static readonly byte[] PREFIX_PLAYER_BADGES = new byte[] { 0x28 };
        
        /// <summary>Prefix 0x29: Total unique players.</summary>
        /// <summary>Storage prefix for total players.</summary>
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x29 };
        
        /// <summary>Prefix 0x2A: Total rounds completed.</summary>
        /// <summary>Storage prefix for total rounds.</summary>
        private static readonly byte[] PREFIX_TOTAL_ROUNDS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a game round.
        /// FIELDS:
        /// - Id: Round number
        /// - StartTime: Round start timestamp
        /// - EndTime: Current end time (extends with keys)
        /// - Pot: Total GAS in pot
        /// - TotalKeys: Keys sold this round
        /// - LastBuyer: Address of most recent key buyer
        /// - Winner: Round winner address
        /// - WinnerPrize: Prize amount awarded
        /// - Active: Whether round is ongoing
        /// - Settled: Whether prizes distributed
        /// </summary>
        public struct Round
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger Pot;
            public BigInteger TotalKeys;
            public UInt160 LastBuyer;
            public UInt160 Winner;
            public BigInteger WinnerPrize;
            public bool Active;
            public bool Settled;
        }

        /// <summary>
        /// Player statistics across all rounds.
        /// FIELDS:
        /// - TotalKeysOwned: Total keys held
        /// - TotalSpent: Total GAS spent on keys
        /// - TotalWon: Total GAS won
        /// - RoundsPlayed: Number of rounds participated
        /// - RoundsWon: Number of rounds won
        /// - ReferralEarnings: GAS earned from referrals
        /// - BadgeCount: Number of badges earned
        /// - JoinTime: First play timestamp
        /// - LastActivityTime: Most recent activity
        /// - HighestSinglePurchase: Largest key purchase
        /// - DividendsClaimed: Total dividends withdrawn
        /// </summary>
        public struct PlayerStats
        {
            public BigInteger TotalKeysOwned;
            public BigInteger TotalSpent;
            public BigInteger TotalWon;
            public BigInteger RoundsPlayed;
            public BigInteger RoundsWon;
            public BigInteger ReferralEarnings;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger HighestSinglePurchase;
            public BigInteger DividendsClaimed;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when keys are purchased.</summary>
        /// <param name="player">Buyer address.</param>
        /// <param name="keys">Number of keys purchased.</param>
        /// <param name="potContribution">Amount added to pot.</param>
        /// <param name="roundId">Round identifier.</param>
        /// <summary>Event emitted when keys purchased.</summary>
    public delegate void KeysPurchasedHandler(UInt160 player, BigInteger keys, BigInteger potContribution, BigInteger roundId);
        
        /// <summary>Event emitted when round ends with winner.</summary>
        /// <param name="winner">Winner address.</param>
        /// <param name="prize">Prize amount won.</param>
        /// <param name="roundId">Round identifier.</param>
        /// <summary>Event emitted when doomsday winner.</summary>
    public delegate void DoomsdayWinnerHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
        
        /// <summary>Event emitted when new round starts.</summary>
        /// <param name="roundId">New round identifier.</param>
        /// <param name="endTime">Initial end time.</param>
        /// <param name="initialPot">Starting pot from previous round.</param>
        /// <summary>Event emitted when round started.</summary>
    public delegate void RoundStartedHandler(BigInteger roundId, BigInteger endTime, BigInteger initialPot);
        
        /// <summary>Event emitted when timer is extended.</summary>
        /// <param name="roundId">Round identifier.</param>
        /// <param name="newEndTime">Updated end time.</param>
        /// <param name="keysAdded">Keys that caused extension.</param>
        /// <summary>Event emitted when time extended.</summary>
    public delegate void TimeExtendedHandler(BigInteger roundId, BigInteger newEndTime, BigInteger keysAdded);
        
        /// <summary>Event emitted when dividends are claimed.</summary>
        /// <param name="player">Claimant address.</param>
        /// <param name="roundId">Round identifier.</param>
        /// <param name="amount">Dividend amount claimed.</param>
        /// <summary>Event emitted when dividend claimed.</summary>
    public delegate void DividendClaimedHandler(UInt160 player, BigInteger roundId, BigInteger amount);
        
        /// <summary>Event emitted when referral reward is paid.</summary>
        /// <param name="referrer">Referrer address.</param>
        /// <param name="player">Referred player.</param>
        /// <param name="reward">Reward amount.</param>
        /// <summary>Event emitted when referral reward.</summary>
    public delegate void ReferralRewardHandler(UInt160 referrer, UInt160 player, BigInteger reward);
        
        /// <summary>Event emitted when player earns a badge.</summary>
        /// <param name="player">Badge recipient.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <param name="badgeName">Badge name.</param>
        /// <summary>Event emitted when player badge earned.</summary>
    public delegate void PlayerBadgeEarnedHandler(UInt160 player, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("KeysPurchased")]
        public static event KeysPurchasedHandler OnKeysPurchased;

        [DisplayName("DoomsdayWinner")]
        public static event DoomsdayWinnerHandler OnDoomsdayWinner;

        [DisplayName("RoundStarted")]
        public static event RoundStartedHandler OnRoundStarted;

        [DisplayName("TimeExtended")]
        public static event TimeExtendedHandler OnTimeExtended;

        [DisplayName("DividendClaimed")]
        public static event DividendClaimedHandler OnDividendClaimed;

        [DisplayName("ReferralReward")]
        public static event ReferralRewardHandler OnReferralReward;

        [DisplayName("PlayerBadgeEarned")]
        public static event PlayerBadgeEarnedHandler OnPlayerBadgeEarned;
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
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_KEYS_SOLD, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_POT_DISTRIBUTED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_ROUNDS, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets current round ID.
        /// </summary>
        /// <returns>Current round number.</returns>
        [Safe]
        public static BigInteger CurrentRoundId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        /// <summary>
        /// Gets total keys sold across all rounds.
        /// </summary>
        /// <returns>Total keys sold.</returns>
        [Safe]
        public static BigInteger TotalKeysSold() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_KEYS_SOLD);

        /// <summary>
        /// Gets total pot distributed to winners.
        /// </summary>
        /// <returns>Total pot distributed.</returns>
        [Safe]
        public static BigInteger TotalPotDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POT_DISTRIBUTED);

        /// <summary>
        /// Gets total unique players.
        /// </summary>
        /// <returns>Total player count.</returns>
        [Safe]
        public static BigInteger TotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        /// <summary>
        /// Gets total completed rounds.
        /// </summary>
        /// <returns>Total rounds completed.</returns>
        [Safe]
        public static BigInteger TotalRounds() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ROUNDS);

        /// <summary>
        /// Checks if player has a specific badge.
        /// </summary>
        /// <param name="player">Player address.</param>
        /// <param name="badgeType">Badge identifier.</param>
        /// <returns>True if player has badge.</returns>
        [Safe]
        public static bool HasPlayerBadge(UInt160 player, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_BADGES, player),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        /// <summary>
        /// Gets round data by ID.
        /// </summary>
        /// <param name="roundId">Round identifier.</param>
        /// <returns>Round data struct.</returns>
        [Safe]
        public static Round GetRound(BigInteger roundId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ROUNDS, (ByteString)roundId.ToByteArray()));
            if (data == null) return new Round();
            return (Round)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets player statistics.
        /// </summary>
        /// <param name="player">Player address.</param>
        /// <returns>Player stats struct.</returns>
        [Safe]
        public static PlayerStats GetPlayerStats(UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLAYER_STATS, player));
            if (data == null) return new PlayerStats();
            return (PlayerStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets keys owned by player in a round.
        /// </summary>
        /// <param name="player">Player address.</param>
        /// <param name="roundId">Round identifier.</param>
        /// <returns>Number of keys owned.</returns>
        [Safe]
        public static BigInteger GetPlayerKeys(UInt160 player, BigInteger roundId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_KEYS, player),
                (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Gets current key price based on keys sold.
        /// </summary>
        /// <returns>Current key price in GAS.</returns>
        [Safe]
        public static BigInteger GetCurrentKeyPrice()
        {
            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            return BASE_KEY_PRICE + (round.TotalKeys * BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000);
        }

        /// <summary>
        /// Gets remaining time in current round.
        /// </summary>
        /// <returns>Seconds remaining (0 if ended).</returns>
        [Safe]
        public static BigInteger TimeRemaining()
        {
            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            if (!round.Active) return 0;
            BigInteger remaining = round.EndTime - Runtime.Time;
            return remaining > 0 ? remaining : 0;
        }
        #endregion
    }
}
