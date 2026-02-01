using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Lottery Type Price Constants (in GAS decimals, 8 decimals)

        // 福彩刮刮乐 - 0.05 GAS
        private const long PRICE_SCRATCH_WIN = 5000000;
        // 双色球 - 0.2 GAS
        private const long PRICE_DOUBLE_COLOR = 20000000;
        // 快乐8 - 0.1 GAS
        private const long PRICE_HAPPY8 = 10000000;
        // 七乐彩 - 0.3 GAS
        private const long PRICE_LUCKY7 = 30000000;
        // 大乐透 - 0.5 GAS
        private const long PRICE_SUPER_LOTTO = 50000000;
        // 至尊彩 - 1 GAS
        private const long PRICE_SUPREME = 100000000;

        #endregion

        #region Max Jackpot Constants (in GAS decimals)

        private const long MAX_JACKPOT_SCRATCH_WIN = 500000000;      // 5 GAS
        private const long MAX_JACKPOT_DOUBLE_COLOR = 10000000000;   // 100 GAS
        private const long MAX_JACKPOT_HAPPY8 = 1000000000;          // 10 GAS
        private const long MAX_JACKPOT_LUCKY7 = 20000000000;         // 200 GAS
        private const long MAX_JACKPOT_SUPER_LOTTO = 50000000000;    // 500 GAS
        private const long MAX_JACKPOT_SUPREME = 100000000000;       // 1000 GAS

        #endregion

        #region Prize Tier Odds (in basis points, 10000 = 100%)

        // Scratch card prize tiers (instant)
        // Tier 1: 10% chance - 1x multiplier
        // Tier 2: 5% chance - 2x multiplier
        // Tier 3: 1% chance - 5x multiplier
        // Tier 4: 0.1% chance - 20x multiplier
        // Tier 5: 0.01% chance - 100x multiplier
        private const int TIER1_ODDS_BPS = 1000;   // 10%
        private const int TIER2_ODDS_BPS = 500;    // 5%
        private const int TIER3_ODDS_BPS = 100;    // 1%
        private const int TIER4_ODDS_BPS = 10;     // 0.1%
        private const int TIER5_ODDS_BPS = 1;      // 0.01%

        private const int TIER1_MULTIPLIER = 1;
        private const int TIER2_MULTIPLIER = 2;
        private const int TIER3_MULTIPLIER = 5;
        private const int TIER4_MULTIPLIER = 20;
        private const int TIER5_MULTIPLIER = 100;

        #endregion

        #region Lottery Config Query Methods

        [Safe]
        public static LotteryConfig GetLotteryConfig(byte lotteryType)
        {
            byte[] key = Helper.Concat(PREFIX_LOTTERY_CONFIG, new byte[] { lotteryType });
            ByteString data = Storage.Get(Storage.CurrentContext, key);

            if (data != null)
            {
                return (LotteryConfig)StdLib.Deserialize(data);
            }

            return GetDefaultConfig(lotteryType);
        }

        [Safe]
        public static LotteryConfig[] GetAllLotteryConfigs()
        {
            LotteryConfig[] configs = new LotteryConfig[6];
            for (byte i = 0; i < 6; i++)
            {
                configs[i] = GetLotteryConfig(i);
            }
            return configs;
        }

        [Safe]
        public static bool IsLotteryTypeEnabled(byte lotteryType)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            return config.Enabled;
        }

        [Safe]
        public static BigInteger GetLotteryPrice(byte lotteryType)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            return config.TicketPrice;
        }

        [Safe]
        public static bool IsInstantLottery(byte lotteryType)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            return config.IsInstant;
        }

        #endregion

        #region Default Config Factory

        private static LotteryConfig GetDefaultConfig(byte lotteryType)
        {
            LotteryType type = (LotteryType)lotteryType;

            switch (type)
            {
                case LotteryType.ScratchWin:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.ScratchWin,
                        TicketPrice = PRICE_SCRATCH_WIN,
                        IsInstant = true,
                        MaxJackpot = MAX_JACKPOT_SCRATCH_WIN,
                        Enabled = true
                    };

                case LotteryType.DoubleColor:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.DoubleColor,
                        TicketPrice = PRICE_DOUBLE_COLOR,
                        IsInstant = false,
                        MaxJackpot = MAX_JACKPOT_DOUBLE_COLOR,
                        Enabled = true
                    };

                case LotteryType.Happy8:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.Happy8,
                        TicketPrice = PRICE_HAPPY8,
                        IsInstant = true,
                        MaxJackpot = MAX_JACKPOT_HAPPY8,
                        Enabled = true
                    };

                case LotteryType.Lucky7:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.Lucky7,
                        TicketPrice = PRICE_LUCKY7,
                        IsInstant = false,
                        MaxJackpot = MAX_JACKPOT_LUCKY7,
                        Enabled = true
                    };

                case LotteryType.SuperLotto:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.SuperLotto,
                        TicketPrice = PRICE_SUPER_LOTTO,
                        IsInstant = false,
                        MaxJackpot = MAX_JACKPOT_SUPER_LOTTO,
                        Enabled = true
                    };

                case LotteryType.Supreme:
                    return new LotteryConfig
                    {
                        Type = (byte)LotteryType.Supreme,
                        TicketPrice = PRICE_SUPREME,
                        IsInstant = false,
                        MaxJackpot = MAX_JACKPOT_SUPREME,
                        Enabled = true
                    };

                default:
                    ExecutionEngine.Assert(false, "invalid lottery type");
                    return new LotteryConfig();
            }
        }

        #endregion

        #region Prize Tier Calculation

        [Safe]
        public static Map<string, object> GetPrizeTiers(byte lotteryType)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            BigInteger basePrice = config.TicketPrice;

            Map<string, object> tiers = new Map<string, object>();

            // Tier 1: 10% - 1x
            tiers["tier1_odds"] = TIER1_ODDS_BPS;
            tiers["tier1_prize"] = basePrice * TIER1_MULTIPLIER;

            // Tier 2: 5% - 2x
            tiers["tier2_odds"] = TIER2_ODDS_BPS;
            tiers["tier2_prize"] = basePrice * TIER2_MULTIPLIER;

            // Tier 3: 1% - 5x
            tiers["tier3_odds"] = TIER3_ODDS_BPS;
            tiers["tier3_prize"] = basePrice * TIER3_MULTIPLIER;

            // Tier 4: 0.1% - 20x
            tiers["tier4_odds"] = TIER4_ODDS_BPS;
            tiers["tier4_prize"] = basePrice * TIER4_MULTIPLIER;

            // Tier 5: 0.01% - 100x (capped at max jackpot)
            tiers["tier5_odds"] = TIER5_ODDS_BPS;
            BigInteger tier5Prize = basePrice * TIER5_MULTIPLIER;
            if (tier5Prize > config.MaxJackpot)
            {
                tier5Prize = config.MaxJackpot;
            }
            tiers["tier5_prize"] = tier5Prize;

            return tiers;
        }

        /// <summary>
        /// Calculate prize based on random number and lottery type
        /// Returns 0 if no win
        /// </summary>
        internal static BigInteger CalculatePrize(byte lotteryType, BigInteger randomNumber)
        {
            LotteryConfig config = GetLotteryConfig(lotteryType);
            BigInteger basePrice = config.TicketPrice;

            // Use modulo 10000 for basis points calculation
            BigInteger roll = randomNumber % 10000;

            // Check tiers from highest to lowest
            // Tier 5: 0.01% (roll < 1)
            if (roll < TIER5_ODDS_BPS)
            {
                BigInteger prize = basePrice * TIER5_MULTIPLIER;
                return prize > config.MaxJackpot ? config.MaxJackpot : prize;
            }

            // Tier 4: 0.1% (roll < 10)
            if (roll < TIER5_ODDS_BPS + TIER4_ODDS_BPS)
            {
                return basePrice * TIER4_MULTIPLIER;
            }

            // Tier 3: 1% (roll < 110)
            if (roll < TIER5_ODDS_BPS + TIER4_ODDS_BPS + TIER3_ODDS_BPS)
            {
                return basePrice * TIER3_MULTIPLIER;
            }

            // Tier 2: 5% (roll < 610)
            if (roll < TIER5_ODDS_BPS + TIER4_ODDS_BPS + TIER3_ODDS_BPS + TIER2_ODDS_BPS)
            {
                return basePrice * TIER2_MULTIPLIER;
            }

            // Tier 1: 10% (roll < 1610)
            if (roll < TIER5_ODDS_BPS + TIER4_ODDS_BPS + TIER3_ODDS_BPS + TIER2_ODDS_BPS + TIER1_ODDS_BPS)
            {
                return basePrice * TIER1_MULTIPLIER;
            }

            // No win (~83.89%)
            return 0;
        }

        #endregion

        #region Admin Config Methods

        public static void SetLotteryConfig(
            byte lotteryType,
            BigInteger ticketPrice,
            bool isInstant,
            BigInteger maxJackpot,
            bool enabled)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(lotteryType <= 5, "invalid lottery type");
            ExecutionEngine.Assert(ticketPrice > 0, "price must be > 0");
            ExecutionEngine.Assert(maxJackpot > ticketPrice, "maxJackpot > price");

            LotteryConfig config = new LotteryConfig
            {
                Type = lotteryType,
                TicketPrice = ticketPrice,
                IsInstant = isInstant,
                MaxJackpot = maxJackpot,
                Enabled = enabled
            };

            byte[] key = Helper.Concat(PREFIX_LOTTERY_CONFIG, new byte[] { lotteryType });
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(config));
        }

        public static void EnableLotteryType(byte lotteryType, bool enabled)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(lotteryType <= 5, "invalid lottery type");

            LotteryConfig config = GetLotteryConfig(lotteryType);
            config.Enabled = enabled;

            byte[] key = Helper.Concat(PREFIX_LOTTERY_CONFIG, new byte[] { lotteryType });
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(config));
        }

        #endregion
    }
}
