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
    public delegate void KeysPurchasedHandler(UInt160 player, BigInteger keys, BigInteger potContribution, BigInteger roundId);
    public delegate void DoomsdayWinnerHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
    public delegate void RoundStartedHandler(BigInteger roundId, BigInteger endTime, BigInteger initialPot);
    public delegate void TimeExtendedHandler(BigInteger roundId, BigInteger newEndTime, BigInteger keysAdded);
    public delegate void DividendClaimedHandler(UInt160 player, BigInteger roundId, BigInteger amount);
    public delegate void ReferralRewardHandler(UInt160 referrer, UInt160 player, BigInteger reward);
    public delegate void PlayerBadgeEarnedHandler(UInt160 player, BigInteger badgeType, string badgeName);

    [DisplayName("MiniAppDoomsdayClock")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. DoomsdayClock is a complete FOMO3D style countdown game.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppDoomsdayClock : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-doomsday-clock";
        private const int PLATFORM_FEE_BPS = 500;
        private const int WINNER_SHARE_BPS = 4800;
        private const int DIVIDEND_SHARE_BPS = 3000;
        private const int NEXT_ROUND_SHARE_BPS = 1000;
        private const int REFERRAL_SHARE_BPS = 700;
        private const long BASE_KEY_PRICE = 10000000;
        private const int KEY_PRICE_INCREMENT_BPS = 10;
        private const long TIME_ADDED_PER_KEY_SECONDS = 30;
        private const long INITIAL_DURATION_SECONDS = 3600;
        private const long MAX_DURATION_SECONDS = 86400;
        private const long MIN_KEYS = 1;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_ROUND_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_ROUNDS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_PLAYER_KEYS = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_TOTAL_KEYS_SOLD = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_TOTAL_POT_DISTRIBUTED = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_REFERRALS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_DIVIDENDS_CLAIMED = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_PLAYER_BADGES = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_ROUNDS = new byte[] { 0x2A };
        #endregion

        #region Data Structures
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
        [Safe]
        public static BigInteger CurrentRoundId() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND_ID);

        [Safe]
        public static BigInteger TotalKeysSold() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_KEYS_SOLD);

        [Safe]
        public static BigInteger TotalPotDistributed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_POT_DISTRIBUTED);

        [Safe]
        public static BigInteger TotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        [Safe]
        public static BigInteger TotalRounds() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_ROUNDS);

        [Safe]
        public static bool HasPlayerBadge(UInt160 player, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_BADGES, player),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        [Safe]
        public static Round GetRound(BigInteger roundId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_ROUNDS, (ByteString)roundId.ToByteArray()));
            if (data == null) return new Round();
            return (Round)StdLib.Deserialize(data);
        }

        [Safe]
        public static PlayerStats GetPlayerStats(UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLAYER_STATS, player));
            if (data == null) return new PlayerStats();
            return (PlayerStats)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetPlayerKeys(UInt160 player, BigInteger roundId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_KEYS, player),
                (ByteString)roundId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetCurrentKeyPrice()
        {
            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            return BASE_KEY_PRICE + (round.TotalKeys * BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000);
        }

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
