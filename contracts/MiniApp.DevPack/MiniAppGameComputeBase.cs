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
    /// MiniApp DevPack - Game Compute Base Class
    ///
    /// Combines MiniAppComputeBase (hybrid on-chain/off-chain computation) with
    /// gaming/betting specific functionality from MiniAppGameBase.
    ///
    /// INHERITANCE:
    /// MiniAppBase -> MiniAppServiceBase -> MiniAppComputeBase -> MiniAppGameComputeBase
    ///
    /// FEATURES:
    /// - All hybrid compute features (script registration, seed generation, verification)
    /// - Bet limits (max bet, daily limit, cooldown, consecutive)
    /// - Player tracking (daily bets, last bet time, bet count)
    /// - Anti-Martingale protection
    ///
    /// STORAGE LAYOUT (0x30-0x3F reserved for game compute):
    /// - 0x30: Player daily bet
    /// - 0x31: Player last bet time
    /// - 0x32: Player bet count
    /// - 0x33: Bet limits config
    /// - 0x34: Game request to data mapping
    /// - 0x35-0x3F: Reserved for game extensions
    ///
    /// USE FOR:
    /// - MiniAppCoinFlip
    /// - MiniAppLottery
    /// - MiniAppNeoGacha
    /// - MiniAppDoomsdayClock
    /// - Any betting/gambling MiniApp needing hybrid compute
    /// </summary>
    public abstract class MiniAppGameComputeBase : MiniAppComputeBase
    {
        #region Gaming Storage Prefixes (0x30-0x3F)

        protected static readonly byte[] PREFIX_GAME_PLAYER_DAILY_BET = new byte[] { 0x30 };
        protected static readonly byte[] PREFIX_GAME_PLAYER_LAST_BET = new byte[] { 0x31 };
        protected static readonly byte[] PREFIX_GAME_PLAYER_BET_COUNT = new byte[] { 0x32 };
        protected static readonly byte[] PREFIX_GAME_BET_LIMITS_CONFIG = new byte[] { 0x33 };
        protected static readonly byte[] PREFIX_GAME_REQUEST_TO_DATA = new byte[] { 0x34 };

        #endregion

        #region Default Bet Limits

        private const long DEFAULT_MAX_BET = 10000000000;      // 100 GAS
        private const long DEFAULT_DAILY_LIMIT = 100000000000; // 1000 GAS
        private const long DEFAULT_COOLDOWN_SECONDS = 30;      // 30 seconds
        private const int DEFAULT_MAX_CONSECUTIVE = 20;        // 20 bets per session

        #endregion

        #region Structs

        public struct GameBetLimitsConfig
        {
            public BigInteger MaxBet;
            public BigInteger DailyLimit;
            public BigInteger CooldownSeconds;
            public BigInteger MaxConsecutive;
        }

        #endregion

        #region Events

        public delegate void GameBetLimitsChangedHandler(
            BigInteger maxBet, BigInteger dailyLimit,
            BigInteger cooldownSeconds, BigInteger maxConsecutive);

        [DisplayName("GameBetLimitsChanged")]
        public static event GameBetLimitsChangedHandler OnGameBetLimitsChanged;

        #endregion

        #region Bet Limits Getters

        [Safe]
        public static GameBetLimitsConfig GetGameBetLimits()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_GAME_BET_LIMITS_CONFIG);
            if (data == null)
            {
                return new GameBetLimitsConfig
                {
                    MaxBet = DEFAULT_MAX_BET,
                    DailyLimit = DEFAULT_DAILY_LIMIT,
                    CooldownSeconds = DEFAULT_COOLDOWN_SECONDS,
                    MaxConsecutive = DEFAULT_MAX_CONSECUTIVE
                };
            }
            return (GameBetLimitsConfig)StdLib.Deserialize(data);
        }

        [Safe]
        public static BigInteger GetGamePlayerDailyBet(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_GAME_PLAYER_DAILY_BET, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        [Safe]
        public static BigInteger GetGamePlayerLastBetTime(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_GAME_PLAYER_LAST_BET, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger GetGamePlayerBetCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_GAME_PLAYER_BET_COUNT, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        #endregion

        #region Bet Limits Management

        public static void SetGameBetLimits(
            BigInteger maxBet, BigInteger dailyLimit,
            BigInteger cooldownSeconds, BigInteger maxConsecutive)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(maxBet > 0, "maxBet must be > 0");
            ExecutionEngine.Assert(dailyLimit >= maxBet, "dailyLimit >= maxBet");
            ExecutionEngine.Assert(cooldownSeconds >= 0, "cooldownSeconds >= 0");
            ExecutionEngine.Assert(maxConsecutive > 0, "maxConsecutive > 0");

            GameBetLimitsConfig config = new GameBetLimitsConfig
            {
                MaxBet = maxBet,
                DailyLimit = dailyLimit,
                CooldownSeconds = cooldownSeconds,
                MaxConsecutive = maxConsecutive
            };
            Storage.Put(Storage.CurrentContext, PREFIX_GAME_BET_LIMITS_CONFIG,
                StdLib.Serialize(config));

            OnGameBetLimitsChanged(maxBet, dailyLimit, cooldownSeconds, maxConsecutive);
        }

        #endregion

        #region Bet Validation & Recording

        protected static void ValidateGameBetLimits(UInt160 player, BigInteger amount)
        {
            ValidateAddress(player);
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");

            GameBetLimitsConfig limits = GetGameBetLimits();

            ExecutionEngine.Assert(amount <= limits.MaxBet, "bet exceeds maximum");

            BigInteger dailyTotal = GetGamePlayerDailyBet(player);
            ExecutionEngine.Assert(dailyTotal + amount <= limits.DailyLimit,
                "daily limit exceeded");

            BigInteger lastBet = GetGamePlayerLastBetTime(player);
            BigInteger elapsed = Runtime.Time - lastBet;
            ExecutionEngine.Assert(elapsed >= limits.CooldownSeconds, "cooldown active");

            BigInteger betCount = GetGamePlayerBetCount(player);
            if (elapsed >= limits.CooldownSeconds * 5) betCount = 0;
            ExecutionEngine.Assert(betCount < limits.MaxConsecutive,
                "max consecutive bets reached");
        }

        protected static void RecordGameBet(UInt160 player, BigInteger amount)
        {
            BigInteger currentTime = Runtime.Time;
            BigInteger currentDay = currentTime / 86400;
            GameBetLimitsConfig limits = GetGameBetLimits();

            BigInteger lastBet = GetGamePlayerLastBetTime(player);
            BigInteger elapsed = currentTime - lastBet;
            BigInteger betCount = GetGamePlayerBetCount(player);

            // Update daily total
            BigInteger dailyTotal = GetGamePlayerDailyBet(player);
            byte[] dailyKey = Helper.Concat(PREFIX_GAME_PLAYER_DAILY_BET, (ByteString)player);
            Storage.Put(Storage.CurrentContext, dailyKey,
                StdLib.Serialize(new object[] { currentDay, dailyTotal + amount }));

            // Update last bet time
            byte[] lastBetKey = Helper.Concat(PREFIX_GAME_PLAYER_LAST_BET, (ByteString)player);
            Storage.Put(Storage.CurrentContext, lastBetKey, currentTime);

            // Update bet count (reset if cooldown * 5 elapsed)
            betCount = (elapsed >= limits.CooldownSeconds * 5) ? 1 : betCount + 1;
            byte[] countKey = Helper.Concat(PREFIX_GAME_PLAYER_BET_COUNT, (ByteString)player);
            Storage.Put(Storage.CurrentContext, countKey, betCount);
        }

        #endregion

        #region Game Request Data Storage

        protected static void StoreGameRequestData(BigInteger requestId, ByteString data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_GAME_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()),
                data);
        }

        protected static ByteString GetGameRequestData(BigInteger requestId)
        {
            return Storage.Get(Storage.CurrentContext,
                Helper.Concat(PREFIX_GAME_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()));
        }

        protected static void DeleteGameRequestData(BigInteger requestId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(PREFIX_GAME_REQUEST_TO_DATA, (ByteString)requestId.ToByteArray()));
        }

        #endregion

        #region Hybrid Game Operations

        /// <summary>
        /// Initiate a hybrid game operation.
        /// Generates seed and stores operation data for later settlement.
        /// </summary>
        protected static (BigInteger operationId, ByteString seed) InitiateGameOperation(
            UInt160 player,
            string scriptName,
            BigInteger betAmount,
            ByteString operationData)
        {
            // Validate bet limits
            ValidateGameBetLimits(player, betAmount);

            // Generate operation ID
            BigInteger operationId = Runtime.Time * 1000000 + Runtime.InvocationCounter;

            // Generate deterministic seed
            ByteString seed = GenerateOperationSeed(operationId, player, scriptName);

            // Store operation data
            StoreGameRequestData(operationId, operationData);

            // Record bet
            RecordGameBet(player, betAmount);

            return (operationId, seed);
        }

        /// <summary>
        /// Settle a hybrid game operation.
        /// Verifies script hash and cleans up operation data.
        /// </summary>
        protected static ByteString SettleGameOperation(
            BigInteger operationId,
            string scriptName,
            ByteString scriptHash)
        {
            // Verify script is valid
            ValidateScriptHash(scriptName, scriptHash);

            // Get and delete operation data
            ByteString data = GetGameRequestData(operationId);
            ExecutionEngine.Assert(data != null, "operation not found");

            DeleteGameRequestData(operationId);
            DeleteOperationSeed(operationId);

            return data;
        }

        #endregion
    }
}
