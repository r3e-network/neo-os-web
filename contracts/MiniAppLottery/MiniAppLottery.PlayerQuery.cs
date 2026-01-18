using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Player Query

        [Safe]
        public static Map<string, object> GetPlayerStatsDetails(UInt160 player)
        {
            PlayerStats stats = GetPlayerStats(player);
            Map<string, object> details = new Map<string, object>();

            details["totalTickets"] = stats.TotalTickets;
            details["totalSpent"] = stats.TotalSpent;
            details["totalWins"] = stats.TotalWins;
            details["totalWon"] = stats.TotalWon;
            details["roundsPlayed"] = stats.RoundsPlayed;
            details["consecutiveWins"] = stats.ConsecutiveWins;
            details["bestWinStreak"] = stats.BestWinStreak;
            details["highestWin"] = stats.HighestWin;
            details["achievementCount"] = stats.AchievementCount;
            details["joinTime"] = stats.JoinTime;
            details["lastPlayTime"] = stats.LastPlayTime;

            if (stats.RoundsPlayed > 0)
            {
                details["winRate"] = stats.TotalWins * 10000 / stats.RoundsPlayed;
            }

            details["netProfit"] = stats.TotalWon - stats.TotalSpent;

            BigInteger currentRound = CurrentRound();
            details["currentRoundTickets"] = GetPlayerTickets(player, currentRound);

            return details;
        }

        #endregion
    }
}
