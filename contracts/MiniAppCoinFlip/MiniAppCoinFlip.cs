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
    public delegate void BetPlacedHandler(UInt160 player, BigInteger betId, BigInteger amount, bool choice);
    public delegate void BetInitiatedHandler(UInt160 player, BigInteger betId, BigInteger amount, bool choice, string seed);
    public delegate void BetResolvedHandler(UInt160 player, BigInteger betId, bool won, BigInteger payout);
    public delegate void JackpotWonHandler(UInt160 player, BigInteger amount);
    public delegate void AchievementUnlockedHandler(UInt160 player, BigInteger achievementId, string name);
    public delegate void StreakUpdatedHandler(UInt160 player, BigInteger streakType, BigInteger streakCount);

    [DisplayName("MiniAppCoinFlip")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Provably fair coin flip game with jackpot and achievements")]
    [ContractPermission("*", "*")]
    public partial class MiniAppCoinFlip : MiniAppGameComputeBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-coinflip";
        private const int PLATFORM_FEE_PERCENT = 3;
        private const long MIN_BET = 10000000;
        private const long MAX_BET = 5000000000;
        private const int JACKPOT_CONTRIBUTION_BPS = 100;
        private const int JACKPOT_CHANCE_BPS = 50;
        private const long JACKPOT_THRESHOLD = 100000000;
        private const long HIGH_ROLLER_THRESHOLD = 1000000000;
        private const int STREAK_BONUS_BPS = 50;
        private const int MAX_STREAK_BONUS = 500;
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase)
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_TOTAL_WAGERED = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_TOTAL_PAID = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_JACKPOT_POOL = new byte[] { 0x45 };
        private static readonly byte[] PREFIX_ACHIEVEMENTS = new byte[] { 0x46 };
        private static readonly byte[] PREFIX_USER_BETS = new byte[] { 0x47 };
        private static readonly byte[] PREFIX_USER_BET_COUNT = new byte[] { 0x48 };
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x49 };
        #endregion

        #region Data Structures
        public struct BetData
        {
            public UInt160 Player;
            public BigInteger Amount;
            public bool Choice;
            public BigInteger Timestamp;
            public bool Resolved;
            public bool Won;
            public BigInteger Payout;
            public BigInteger StreakBonus;
            public ByteString Seed;        // Deterministic seed for hybrid mode
            public bool HybridMode;        // True if using hybrid (seed-based) resolution
        }

        public struct PlayerStats
        {
            public BigInteger TotalBets;
            public BigInteger TotalWins;
            public BigInteger TotalLosses;
            public BigInteger TotalWagered;
            public BigInteger TotalWon;
            public BigInteger TotalLost;
            public BigInteger CurrentWinStreak;
            public BigInteger CurrentLossStreak;
            public BigInteger BestWinStreak;
            public BigInteger WorstLossStreak;
            public BigInteger HighestWin;
            public BigInteger HighestBet;
            public BigInteger AchievementCount;
            public BigInteger JackpotsWon;
            public BigInteger JoinTime;
            public BigInteger LastBetTime;
        }
        #endregion

        #region Events
        [DisplayName("BetPlaced")]
        public static event BetPlacedHandler OnBetPlaced;

        [DisplayName("BetInitiated")]
        public static event BetInitiatedHandler OnBetInitiated;

        [DisplayName("BetResolved")]
        public static event BetResolvedHandler OnBetResolved;

        [DisplayName("JackpotWon")]
        public static event JackpotWonHandler OnJackpotWon;

        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;

        [DisplayName("StreakUpdated")]
        public static event StreakUpdatedHandler OnStreakUpdated;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_WAGERED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT_POOL, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger GetBetCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);

        [Safe]
        public static BigInteger GetTotalWagered() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_WAGERED);

        [Safe]
        public static BigInteger GetTotalPaid() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PAID);

        [Safe]
        public static BigInteger GetJackpotPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_JACKPOT_POOL);

        [Safe]
        public static BigInteger GetTotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        [Safe]
        public static BetData GetBet(BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BETS, (ByteString)betId.ToByteArray()));
            if (data == null) return new BetData();
            return (BetData)StdLib.Deserialize(data);
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
        public static bool HasAchievement(UInt160 player, BigInteger achievementId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_ACHIEVEMENTS, player),
                (ByteString)achievementId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
