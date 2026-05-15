using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        /// <summary>Get bet details by betId.</summary>
        [Safe]
        public static Map<string, object> GetCoinFlipBet(string appId, BigInteger betId)
        {
            CoinFlipBet bet = LoadCoinFlipBet(appId, betId);
            Map<string, object> details = new Map<string, object>();

            if (bet.Player == UInt160.Zero) return details;

            details["betId"] = betId;
            details["player"] = bet.Player;
            details["amount"] = bet.Amount;
            details["choice"] = bet.Choice;
            details["timestamp"] = bet.Timestamp;
            details["resolved"] = bet.Resolved;

            return details;
        }

        /// <summary>Get the configured bet limits for the CoinFlip game.</summary>
        [Safe]
        public static Map<string, object> GetCoinFlipBetLimits(string appId)
        {
            Map<string, object> limits = new Map<string, object>();
            limits["minBet"] = CF_MIN_BET;
            limits["maxBet"] = CF_MAX_BET;
            limits["dailyLimit"] = CF_DAILY_LIMIT;
            limits["cooldownMs"] = CF_COOLDOWN_MS;
            limits["maxConsecutive"] = CF_MAX_CONSECUTIVE;
            limits["platformFeePercent"] = CF_PLATFORM_FEE_PERCENT;
            limits["totalBets"] = AppGetInt(appId, CF_PREFIX_BET_ID);
            return limits;
        }
    }
}
