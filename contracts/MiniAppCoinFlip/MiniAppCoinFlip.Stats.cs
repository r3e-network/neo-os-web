using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Stats Update

        private static void UpdatePlayerStats(UInt160 player, BigInteger amount, bool won, BigInteger payout, bool wonJackpot)
        {
            PlayerStats stats = GetPlayerStats(player);

            if (stats.JoinTime == 0) stats.JoinTime = Runtime.Time;
            stats.TotalBets += 1;
            stats.TotalWagered += amount;
            stats.LastBetTime = Runtime.Time;

            if (amount > stats.HighestBet) stats.HighestBet = amount;

            if (won)
            {
                stats.TotalWins += 1;
                stats.TotalWon += payout;
                stats.CurrentWinStreak += 1;
                stats.CurrentLossStreak = 0;

                if (stats.CurrentWinStreak > stats.BestWinStreak)
                {
                    stats.BestWinStreak = stats.CurrentWinStreak;
                }

                if (payout > stats.HighestWin) stats.HighestWin = payout;

                OnStreakUpdated(player, 1, stats.CurrentWinStreak);
            }
            else
            {
                stats.TotalLosses += 1;
                stats.TotalLost += amount;
                stats.CurrentLossStreak += 1;
                stats.CurrentWinStreak = 0;

                if (stats.CurrentLossStreak > stats.WorstLossStreak)
                {
                    stats.WorstLossStreak = stats.CurrentLossStreak;
                }

                OnStreakUpdated(player, 2, stats.CurrentLossStreak);
            }

            if (wonJackpot) stats.JackpotsWon += 1;

            StorePlayerStats(player, stats);

            CheckAchievements(player, stats, amount);
        }

        #endregion
    }
}
