using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Platform Stats

        /// <summary>
        /// Get comprehensive platform statistics.
        /// 
        /// RETURNS:
        /// - totalBets: Total bets placed
        /// - totalPlayers: Number of unique players
        /// - totalWagered: Total GAS wagered
        /// - totalPaid: Total GAS paid to winners
        /// - jackpotPool: Current jackpot amount
        /// - minBet: Minimum bet amount
        /// - maxBet: Maximum bet amount
        /// - platformFee: Platform fee percentage
        /// - jackpotThreshold: Minimum bet for jackpot eligibility
        /// - jackpotChance: Jackpot chance in basis points
        /// - highRollerThreshold: High roller achievement threshold
        /// - streakBonusBps: Streak bonus per win (basis points)
        /// - maxStreakBonus: Maximum streak bonus
        /// - houseEdge: Actual house edge (basis points)
        /// </summary>
        /// <returns>Map of platform statistics</returns>
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalBets"] = GetBetCount();
            stats["totalPlayers"] = GetTotalPlayers();
            stats["totalWagered"] = GetTotalWagered();
            stats["totalPaid"] = GetTotalPaid();
            stats["jackpotPool"] = GetJackpotPool();
            stats["minBet"] = MIN_BET;
            stats["maxBet"] = MAX_BET;
            stats["platformFee"] = PLATFORM_FEE_PERCENT;
            stats["jackpotThreshold"] = JACKPOT_THRESHOLD;
            stats["jackpotChance"] = JACKPOT_CHANCE_BPS;
            stats["highRollerThreshold"] = HIGH_ROLLER_THRESHOLD;
            stats["streakBonusBps"] = STREAK_BONUS_BPS;
            stats["maxStreakBonus"] = MAX_STREAK_BONUS;

            BigInteger totalWagered = GetTotalWagered();
            BigInteger totalPaid = GetTotalPaid();
            if (totalWagered > 0)
            {
                stats["houseEdge"] = (totalWagered - totalPaid) * 10000 / totalWagered;
            }

            return stats;
        }

        #endregion
    }
}
