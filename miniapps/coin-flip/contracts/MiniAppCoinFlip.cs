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
    /// Event emitted when a player places a new bet.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="betId">Unique identifier for the bet</param>
    /// <param name="amount">Bet amount in GAS</param>
    /// <param name="choice">Player's choice (true = heads, false = tails)</param>
    public delegate void BetPlacedHandler(UInt160 player, BigInteger betId, BigInteger amount, bool choice);
    
    /// <summary>
    /// Event emitted when a bet is initiated in hybrid mode.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="betId">Unique identifier for the bet</param>
    /// <param name="amount">Bet amount in GAS</param>
    /// <param name="choice">Player's choice</param>
    /// <param name="seed">Deterministic seed for result calculation</param>
    public delegate void BetInitiatedHandler(UInt160 player, BigInteger betId, BigInteger amount, bool choice, string seed);
    
    /// <summary>
    /// Event emitted when a bet is resolved.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="betId">Unique identifier for the bet</param>
    /// <param name="won">Whether the player won</param>
    /// <param name="payout">Payout amount in GAS (0 if lost)</param>
    public delegate void BetResolvedHandler(UInt160 player, BigInteger betId, bool won, BigInteger payout);
    
    /// <summary>
    /// Event emitted when a player wins the jackpot.
    /// </summary>
    /// <param name="player">The winning player's address</param>
    /// <param name="amount">Jackpot amount won</param>
    public delegate void JackpotWonHandler(UInt160 player, BigInteger amount);
    
    /// <summary>
    /// Event emitted when a player unlocks an achievement.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="achievementId">Unique achievement identifier</param>
    /// <param name="name">Achievement name</param>
    public delegate void AchievementUnlockedHandler(UInt160 player, BigInteger achievementId, string name);
    
    /// <summary>
    /// Event emitted when a player's streak is updated.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="streakType">0 = loss streak, 1 = win streak</param>
    /// <param name="streakCount">Current streak count</param>
    public delegate void StreakUpdatedHandler(UInt160 player, BigInteger streakType, BigInteger streakCount);

    /// <summary>
    /// CoinFlip MiniApp - A provably fair coin flip gambling game.
    /// 
    /// FEATURES:
    /// - Fair 50/50 coin flips with 1.94x payout (3% house edge)
    /// - Progressive jackpot system
    /// - Achievement system for milestones
    /// - Win/loss streak tracking with bonuses
    /// - Provably fair seed-based resolution
    /// 
    /// GAME MECHANICS:
    /// - Player bets GAS and chooses heads or tails
    /// - Result is determined by RNG callback or hybrid seed
    /// - Winner receives 1.94x bet amount (minus 3% platform fee)
    /// - Small chance (0.5%) to win the progressive jackpot
    /// - Streak bonuses up to 5% for consecutive wins
    /// 
    /// SECURITY:
    /// - Min/Max bet limits enforced
    /// - Reentrancy protection via state updates before transfers
    /// - Provably fair with published seeds
    /// 
    /// PERMISSIONS:
    /// - GAS token transfers only (0xd2a4cff31913016155e38e474a2c06d08be276cf)
    /// </summary>
    [DisplayName("MiniAppCoinFlip")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Provably fair coin flip game with jackpot and achievements")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppCoinFlip : MiniAppGameComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the CoinFlip miniapp.</summary>
        private const string APP_ID = "miniapp-coinflip";
        
        /// <summary>Platform fee percentage taken from each bet (3%).</summary>
        private const int PLATFORM_FEE_PERCENT = 3;
        
        /// <summary>Minimum bet amount in GAS (0.1 GAS = 10,000,000). Prevents spam bets.</summary>
        private const long MIN_BET = 10000000;
        
        /// <summary>Maximum bet amount in GAS (50 GAS = 5,000,000,000). Limits exposure.</summary>
        private const long MAX_BET = 5000000000;
        
        /// <summary>Jackpot contribution in basis points (1% = 100 bps). Part of house edge goes to jackpot.</summary>
        private const int JACKPOT_CONTRIBUTION_BPS = 100;
        
        /// <summary>Chance to win jackpot in basis points (0.5% = 50 bps).</summary>
        private const int JACKPOT_CHANCE_BPS = 50;
        
        /// <summary>Minimum jackpot size before it can be won (1 GAS).</summary>
        private const long JACKPOT_THRESHOLD = 100000000;
        
        /// <summary>High roller threshold in GAS (10 GAS). Used for achievements.</summary>
        private const long HIGH_ROLLER_THRESHOLD = 1000000000;
        
        /// <summary>Streak bonus per win in basis points (0.5% = 50 bps).</summary>
        private const int STREAK_BONUS_BPS = 50;
        
        /// <summary>Maximum streak bonus in basis points (5% = 500 bps).</summary>
        private const int MAX_STREAK_BONUS = 500;
        #endregion

        #region Storage Prefixes
        /// <summary>Prefix for bet ID counter (0x40).</summary>
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x40 };
        /// <summary>Prefix for bet data storage (0x41).</summary>
        private static readonly byte[] PREFIX_BETS = new byte[] { 0x41 };
        /// <summary>Prefix for player statistics (0x42).</summary>
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x42 };
        /// <summary>Prefix for total wagered amount tracking (0x43).</summary>
        private static readonly byte[] PREFIX_TOTAL_WAGERED = new byte[] { 0x43 };
        /// <summary>Prefix for total paid out tracking (0x44).</summary>
        private static readonly byte[] PREFIX_TOTAL_PAID = new byte[] { 0x44 };
        /// <summary>Prefix for jackpot pool balance (0x45).</summary>
        private static readonly byte[] PREFIX_JACKPOT_POOL = new byte[] { 0x45 };
        /// <summary>Prefix for player achievements (0x46).</summary>
        private static readonly byte[] PREFIX_ACHIEVEMENTS = new byte[] { 0x46 };
        /// <summary>Prefix for user's bet history (0x47).</summary>
        private static readonly byte[] PREFIX_USER_BETS = new byte[] { 0x47 };
        /// <summary>Prefix for user's bet count (0x48).</summary>
        private static readonly byte[] PREFIX_USER_BET_COUNT = new byte[] { 0x48 };
        /// <summary>Prefix for total unique players (0x49).</summary>
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x49 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Represents a single coin flip bet.
        /// 
        /// Storage: Serialized and stored with PREFIX_BETS + betId key
        /// </summary>
        public struct BetData
        {
            /// <summary>The player who placed the bet.</summary>
            public UInt160 Player;
            /// <summary>Bet amount in GAS.</summary>
            public BigInteger Amount;
            /// <summary>Player's choice: true = heads, false = tails.</summary>
            public bool Choice;
            /// <summary>Unix timestamp when bet was placed.</summary>
            public BigInteger Timestamp;
            /// <summary>Whether the bet has been resolved.</summary>
            public bool Resolved;
            /// <summary>Whether the player won (only valid if Resolved = true).</summary>
            public bool Won;
            /// <summary>Payout amount in GAS (0 if lost).</summary>
            public BigInteger Payout;
            /// <summary>Bonus percentage applied from win streak (in basis points).</summary>
            public BigInteger StreakBonus;
            /// <summary>Deterministic seed for hybrid mode resolution (SHA256 hash).</summary>
            public ByteString Seed;
            /// <summary>True if using hybrid (seed-based) resolution instead of oracle RNG.</summary>
            public bool HybridMode;
        }

        /// <summary>
        /// Player statistics tracked across all their bets.
        /// 
        /// Storage: Serialized and stored with PREFIX_PLAYER_STATS + player address key
        /// Updated: After each bet resolution
        /// </summary>
        public struct PlayerStats
        {
            /// <summary>Total number of bets placed.</summary>
            public BigInteger TotalBets;
            /// <summary>Total number of wins.</summary>
            public BigInteger TotalWins;
            /// <summary>Total number of losses.</summary>
            public BigInteger TotalLosses;
            /// <summary>Total amount wagered in GAS.</summary>
            public BigInteger TotalWagered;
            /// <summary>Total amount won in GAS.</summary>
            public BigInteger TotalWon;
            /// <summary>Total amount lost in GAS.</summary>
            public BigInteger TotalLost;
            /// <summary>Current consecutive win streak.</summary>
            public BigInteger CurrentWinStreak;
            /// <summary>Current consecutive loss streak.</summary>
            public BigInteger CurrentLossStreak;
            /// <summary>Best win streak ever achieved.</summary>
            public BigInteger BestWinStreak;
            /// <summary>Worst loss streak ever experienced.</summary>
            public BigInteger WorstLossStreak;
            /// <summary>Largest single win amount in GAS.</summary>
            public BigInteger HighestWin;
            /// <summary>Largest single bet amount in GAS.</summary>
            public BigInteger HighestBet;
            /// <summary>Number of achievements unlocked.</summary>
            public BigInteger AchievementCount;
            /// <summary>Number of jackpots won.</summary>
            public BigInteger JackpotsWon;
            /// <summary>Unix timestamp of first bet (player join time).</summary>
            public BigInteger JoinTime;
            /// <summary>Unix timestamp of most recent bet.</summary>
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
        /// <summary>
        /// Gets the total number of bets placed.
        /// </summary>
        /// <returns>Total bet count</returns>
        [Safe]
        public static BigInteger GetBetCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_BET_ID);

        /// <summary>
        /// Gets the total amount wagered across all bets.
        /// </summary>
        /// <returns>Total wagered amount in GAS</returns>
        [Safe]
        public static BigInteger GetTotalWagered() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_WAGERED);

        /// <summary>
        /// Gets the total amount paid out to winners.
        /// </summary>
        /// <returns>Total paid amount in GAS</returns>
        [Safe]
        public static BigInteger GetTotalPaid() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PAID);

        /// <summary>
        /// Gets the current jackpot pool amount.
        /// </summary>
        /// <returns>Jackpot pool amount in GAS</returns>
        [Safe]
        public static BigInteger GetJackpotPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_JACKPOT_POOL);

        /// <summary>
        /// Gets the total number of unique players.
        /// </summary>
        /// <returns>Total unique player count</returns>
        [Safe]
        public static BigInteger GetTotalPlayers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PLAYERS);

        /// <summary>
        /// Gets detailed information about a specific bet.
        /// </summary>
        /// <param name="betId">The unique bet identifier</param>
        /// <returns>BetData struct with all bet details, or empty struct if not found</returns>
        [Safe]
        public static BetData GetBet(BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BETS, (ByteString)betId.ToByteArray()));
            if (data == null) return new BetData();
            return (BetData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets statistics for a specific player.
        /// </summary>
        /// <param name="player">The player's address</param>
        /// <returns>PlayerStats struct with all player statistics, or empty struct if new player</returns>
        [Safe]
        public static PlayerStats GetPlayerStats(UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PLAYER_STATS, player));
            if (data == null) return new PlayerStats();
            return (PlayerStats)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Checks if a player has unlocked a specific achievement.
        /// </summary>
        /// <param name="player">The player's address</param>
        /// <param name="achievementId">The achievement identifier to check</param>
        /// <returns>True if the player has unlocked the achievement</returns>
        [Safe]
        public static bool HasAchievement(UInt160 player, BigInteger achievementId)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_ACHIEVEMENTS, player),
                (ByteString)achievementId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }

        /// <summary>
        /// Gets the contract script hash for a given script name.
        /// Used for compute service integration.
        /// </summary>
        /// <param name="scriptName">Name of the script</param>
        /// <returns>Script hash if found, empty string otherwise</returns>
        [Safe]
        public static string GetScriptHash(string scriptName)
        {
            if (scriptName == "flip-coin")
            {
                return Runtime.CallingScriptHash.ToString();
            }
            return "";
        }
        #endregion
    }
}
