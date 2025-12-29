using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Anti-Martingale protection module for gaming MiniApps.
    ///
    /// SECURITY MEASURES:
    /// 1. MAX_BET: Prevents single large bets
    /// 2. DAILY_LIMIT: Caps total daily wagering per player
    /// 3. COOLDOWN: Enforces minimum time between bets
    /// 4. CONSECUTIVE_LIMIT: Prevents rapid-fire betting
    ///
    /// WHY THIS MATTERS:
    /// Martingale strategy (doubling bets after loss) guarantees profit
    /// if player has unlimited capital. These limits make it unprofitable.
    /// </summary>
    public partial class MiniAppContract
    {
        #region Bet Limit Storage Prefixes (0x07-0x0A)

        protected static readonly byte[] PREFIX_PLAYER_DAILY_BET = new byte[] { 0x07 };
        protected static readonly byte[] PREFIX_PLAYER_LAST_BET = new byte[] { 0x08 };
        protected static readonly byte[] PREFIX_PLAYER_BET_COUNT = new byte[] { 0x09 };
        protected static readonly byte[] PREFIX_BET_LIMITS_CONFIG = new byte[] { 0x0A };

        #endregion

        #region Default Bet Limits (can be overridden per-app)

        // Default limits - apps can override via SetBetLimits
        private const long DEFAULT_MAX_BET = 10000000000;      // 100 GAS
        private const long DEFAULT_DAILY_LIMIT = 100000000000; // 1000 GAS
        private const long DEFAULT_COOLDOWN_MS = 30000;        // 30 seconds
        private const int DEFAULT_MAX_CONSECUTIVE = 20;        // 20 bets per session

        #endregion

        #region Bet Limits Configuration

        /// <summary>
        /// Bet limits configuration structure.
        /// </summary>
        public struct BetLimitsConfig
        {
            public BigInteger MaxBet;
            public BigInteger DailyLimit;
            public BigInteger CooldownMs;
            public BigInteger MaxConsecutive;
        }

        /// <summary>
        /// Gets the current bet limits configuration.
        /// Returns defaults if not configured.
        /// </summary>
        [Safe]
        public static BetLimitsConfig GetBetLimits()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_BET_LIMITS_CONFIG);
            if (data == null)
            {
                return new BetLimitsConfig
                {
                    MaxBet = DEFAULT_MAX_BET,
                    DailyLimit = DEFAULT_DAILY_LIMIT,
                    CooldownMs = DEFAULT_COOLDOWN_MS,
                    MaxConsecutive = DEFAULT_MAX_CONSECUTIVE
                };
            }
            return (BetLimitsConfig)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Sets bet limits configuration.
        /// SECURITY: Only admin can modify limits.
        /// </summary>
        public static void SetBetLimits(
            BigInteger maxBet,
            BigInteger dailyLimit,
            BigInteger cooldownMs,
            BigInteger maxConsecutive)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(maxBet > 0, "maxBet must be > 0");
            ExecutionEngine.Assert(dailyLimit >= maxBet, "dailyLimit must be >= maxBet");
            ExecutionEngine.Assert(cooldownMs >= 0, "cooldownMs must be >= 0");
            ExecutionEngine.Assert(maxConsecutive > 0, "maxConsecutive must be > 0");

            BetLimitsConfig config = new BetLimitsConfig
            {
                MaxBet = maxBet,
                DailyLimit = dailyLimit,
                CooldownMs = cooldownMs,
                MaxConsecutive = maxConsecutive
            };
            Storage.Put(Storage.CurrentContext, PREFIX_BET_LIMITS_CONFIG,
                StdLib.Serialize(config));
        }

        #endregion

        #region Player Bet Tracking

        /// <summary>
        /// Gets player's total bets for current day (UTC).
        /// Resets at midnight UTC.
        /// </summary>
        [Safe]
        public static BigInteger GetPlayerDailyBet(UInt160 player)
        {
            byte[] key = GetDailyBetKey(player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400000; // ms to days

            // Reset if new day
            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        /// <summary>
        /// Gets player's last bet timestamp.
        /// </summary>
        [Safe]
        public static BigInteger GetPlayerLastBetTime(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_LAST_BET, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>
        /// Gets player's consecutive bet count (resets after cooldown).
        /// </summary>
        [Safe]
        public static BigInteger GetPlayerBetCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_BET_COUNT, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        #endregion

        #region Bet Validation (Anti-Martingale)

        /// <summary>
        /// Validates bet against all anti-Martingale limits.
        /// MUST be called by all gaming contracts before accepting bets.
        ///
        /// CHECKS:
        /// 1. Amount <= MaxBet (prevents large single bets)
        /// 2. DailyTotal + Amount <= DailyLimit (caps daily exposure)
        /// 3. TimeSinceLastBet >= Cooldown (prevents rapid betting)
        /// 4. ConsecutiveBets < MaxConsecutive (limits betting sessions)
        /// </summary>
        protected static void ValidateBetLimits(UInt160 player, BigInteger amount)
        {
            ValidateAddress(player);
            BetLimitsConfig limits = GetBetLimits();

            // 1. Check max bet per transaction
            ExecutionEngine.Assert(amount <= limits.MaxBet,
                "bet exceeds maximum allowed");

            // 2. Check daily limit
            BigInteger dailyTotal = GetPlayerDailyBet(player);
            ExecutionEngine.Assert(dailyTotal + amount <= limits.DailyLimit,
                "daily betting limit exceeded");

            // 3. Check cooldown
            BigInteger lastBet = GetPlayerLastBetTime(player);
            BigInteger elapsed = Runtime.Time - lastBet;
            ExecutionEngine.Assert(elapsed >= limits.CooldownMs,
                "please wait before placing another bet");

            // 4. Check consecutive bets (reset if cooldown passed)
            BigInteger betCount = GetPlayerBetCount(player);
            if (elapsed >= limits.CooldownMs * 5) // Reset after 5x cooldown
            {
                betCount = 0;
            }
            ExecutionEngine.Assert(betCount < limits.MaxConsecutive,
                "maximum consecutive bets reached, take a break");
        }

        /// <summary>
        /// Records a bet for tracking purposes.
        /// MUST be called after successful bet placement.
        /// </summary>
        protected static void RecordBet(UInt160 player, BigInteger amount)
        {
            BigInteger currentTime = Runtime.Time;
            BigInteger currentDay = currentTime / 86400000;
            BetLimitsConfig limits = GetBetLimits();

            // Update daily total
            BigInteger dailyTotal = GetPlayerDailyBet(player);
            byte[] dailyKey = GetDailyBetKey(player);
            Storage.Put(Storage.CurrentContext, dailyKey,
                StdLib.Serialize(new object[] { currentDay, dailyTotal + amount }));

            // Update last bet time
            byte[] lastBetKey = Helper.Concat(PREFIX_PLAYER_LAST_BET, (ByteString)player);
            Storage.Put(Storage.CurrentContext, lastBetKey, currentTime);

            // Update consecutive count
            BigInteger lastBet = GetPlayerLastBetTime(player);
            BigInteger elapsed = currentTime - lastBet;
            BigInteger betCount = GetPlayerBetCount(player);

            if (elapsed >= limits.CooldownMs * 5)
            {
                betCount = 1; // Reset
            }
            else
            {
                betCount += 1;
            }

            byte[] countKey = Helper.Concat(PREFIX_PLAYER_BET_COUNT, (ByteString)player);
            Storage.Put(Storage.CurrentContext, countKey, betCount);
        }

        #endregion

        #region Helper Methods

        private static byte[] GetDailyBetKey(UInt160 player)
        {
            return Helper.Concat(PREFIX_PLAYER_DAILY_BET, (ByteString)player);
        }

        #endregion
    }
}
