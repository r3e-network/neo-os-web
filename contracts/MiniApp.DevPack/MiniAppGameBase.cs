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
    /// MiniApp DevPack - Game Base Class
    ///
    /// Extends MiniAppBase with gaming/betting specific functionality:
    /// - Bet limits (max bet, daily limit, cooldown, consecutive)
    /// - Player tracking (daily bets, last bet time, bet count)
    /// - RNG service requests
    /// - Anti-Martingale protection
    ///
    /// STORAGE LAYOUT (0x10-0x17):
    /// - 0x10: Player daily bet
    /// - 0x11: Player last bet time
    /// - 0x12: Player bet count
    /// - 0x13: Bet limits config
    /// - 0x14: Request to data mapping
    /// - 0x15-0x17: Reserved for game extensions
    ///
    /// USE FOR:
    /// - MiniAppCoinFlip
    /// - MiniAppLottery
    /// - MiniAppNeoGacha
    /// - Any betting/gambling MiniApp
    /// </summary>
    public abstract class MiniAppGameBase : MiniAppBase
    {
        #region Gaming Storage Prefixes (0x10-0x17)

        protected static readonly byte[] PREFIX_PLAYER_DAILY_BET = new byte[] { 0x10 };
        protected static readonly byte[] PREFIX_PLAYER_LAST_BET = new byte[] { 0x11 };
        protected static readonly byte[] PREFIX_PLAYER_BET_COUNT = new byte[] { 0x12 };
        protected static readonly byte[] PREFIX_BET_LIMITS_CONFIG = new byte[] { 0x13 };
        protected static readonly byte[] PREFIX_REQUEST_TO_DATA = new byte[] { 0x14 };

        #endregion

        #region Default Bet Limits

        private const long DEFAULT_MAX_BET = 10000000000;      // 100 GAS
        private const long DEFAULT_DAILY_LIMIT = 100000000000; // 1000 GAS
        private const long DEFAULT_COOLDOWN_SECONDS = 30;      // 30 seconds
        private const int DEFAULT_MAX_CONSECUTIVE = 20;        // 20 bets per session

        #endregion

        #region Structs

        public struct BetLimitsConfig
        {
            public BigInteger MaxBet;
            public BigInteger DailyLimit;
            public BigInteger CooldownSeconds;
            public BigInteger MaxConsecutive;
        }

        #endregion

        #region Events

        public delegate void BetLimitsChangedHandler(
            BigInteger maxBet, BigInteger dailyLimit,
            BigInteger cooldownSeconds, BigInteger maxConsecutive);

        [DisplayName("BetLimitsChanged")]
        public static event BetLimitsChangedHandler OnBetLimitsChanged;

        #endregion

        #region Bet Limits Getters

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
                    CooldownSeconds = DEFAULT_COOLDOWN_SECONDS,
                    MaxConsecutive = DEFAULT_MAX_CONSECUTIVE
                };
            }
            return (BetLimitsConfig)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetPlayerDailyBet(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_DAILY_BET, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        [Safe]
        public static BigInteger GetPlayerLastBetTime(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_LAST_BET, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger GetPlayerBetCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_BET_COUNT, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        #endregion

        #region Bet Limits Management

        public static void SetBetLimits(
            BigInteger maxBet, BigInteger dailyLimit,
            BigInteger cooldownSeconds, BigInteger maxConsecutive)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(maxBet > 0, "maxBet must be > 0");
            ExecutionEngine.Assert(dailyLimit >= maxBet, "dailyLimit >= maxBet");
            ExecutionEngine.Assert(cooldownSeconds >= 0, "cooldownSeconds >= 0");
            ExecutionEngine.Assert(maxConsecutive > 0, "maxConsecutive > 0");

            BetLimitsConfig config = new BetLimitsConfig
            {
                MaxBet = maxBet,
                DailyLimit = dailyLimit,
                CooldownSeconds = cooldownSeconds,
                MaxConsecutive = maxConsecutive
            };
            Storage.Put(Storage.CurrentContext, PREFIX_BET_LIMITS_CONFIG,
                StdLib.Serialize(config));

            OnBetLimitsChanged(maxBet, dailyLimit, cooldownSeconds, maxConsecutive);
        }

        #endregion

        #region Bet Validation & Recording

        protected static void ValidateBetLimits(UInt160 player, BigInteger amount)
        {
            ValidateAddress(player);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            BetLimitsConfig limits = GetBetLimits();

            ExecutionEngine.Assert(amount <= limits.MaxBet, "bet exceeds maximum");

            BigInteger dailyTotal = GetPlayerDailyBet(player);
            ExecutionEngine.Assert(dailyTotal + amount <= limits.DailyLimit,
                "daily limit exceeded");

            BigInteger lastBet = GetPlayerLastBetTime(player);
            BigInteger elapsed = Runtime.Time - lastBet;
            ExecutionEngine.Assert(elapsed >= limits.CooldownSeconds, "cooldown active");

            BigInteger betCount = GetPlayerBetCount(player);
            if (elapsed >= limits.CooldownSeconds * 5) betCount = 0;
            ExecutionEngine.Assert(betCount < limits.MaxConsecutive,
                "max consecutive bets reached");
        }

        protected static void RecordBet(UInt160 player, BigInteger amount)
        {
            BigInteger currentTime = Runtime.Time;
            BigInteger currentDay = currentTime / 86400;
            BetLimitsConfig limits = GetBetLimits();

            // Read lastBet BEFORE updating
            BigInteger lastBet = GetPlayerLastBetTime(player);
            BigInteger elapsed = currentTime - lastBet;
            BigInteger betCount = GetPlayerBetCount(player);

            // Update daily total
            BigInteger dailyTotal = GetPlayerDailyBet(player);
            byte[] dailyKey = Helper.Concat(PREFIX_PLAYER_DAILY_BET, (ByteString)player);
            Storage.Put(Storage.CurrentContext, dailyKey,
                StdLib.Serialize(new object[] { currentDay, dailyTotal + amount }));

            // Update last bet time
            byte[] lastBetKey = Helper.Concat(PREFIX_PLAYER_LAST_BET, (ByteString)player);
            Storage.Put(Storage.CurrentContext, lastBetKey, currentTime);

            // Update bet count (reset if cooldown * 5 elapsed)
            betCount = (elapsed >= limits.CooldownSeconds * 5) ? 1 : betCount + 1;
            byte[] countKey = Helper.Concat(PREFIX_PLAYER_BET_COUNT, (ByteString)player);
            Storage.Put(Storage.CurrentContext, countKey, betCount);
        }

        #endregion

        #region RNG Service Request

        protected static BigInteger RequestRng(string appId, ByteString payload)
        {
            UInt160 gateway = Gateway();
            ExecutionEngine.Assert(gateway != null && gateway.IsValid, "gateway not set");

            return (BigInteger)Contract.Call(
                gateway,
                "requestService",
                CallFlags.All,
                appId,
                ServiceTypes.RNG,
                payload,
                Runtime.ExecutingScriptHash,
                "onServiceCallback"
            );
        }

        #endregion

        #region Request Data Storage

        protected static void StoreRequestData(BigInteger requestId, ByteString data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()),
                data);
        }

        protected static ByteString GetRequestData(BigInteger requestId)
        {
            return Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()));
        }

        protected static void DeleteRequestData(BigInteger requestId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()));
        }

        #endregion
    }
}
