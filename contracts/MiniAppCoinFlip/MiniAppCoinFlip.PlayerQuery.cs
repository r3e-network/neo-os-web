using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Player Stats Query

        [Safe]
        public static Map<string, object> GetPlayerStatsDetails(UInt160 player)
        {
            PlayerStats stats = GetPlayerStats(player);
            Map<string, object> details = new Map<string, object>();

            details["totalBets"] = stats.TotalBets;
            details["totalWins"] = stats.TotalWins;
            details["totalLosses"] = stats.TotalLosses;
            details["totalWagered"] = stats.TotalWagered;
            details["totalWon"] = stats.TotalWon;
            details["totalLost"] = stats.TotalLost;
            details["currentWinStreak"] = stats.CurrentWinStreak;
            details["currentLossStreak"] = stats.CurrentLossStreak;
            details["bestWinStreak"] = stats.BestWinStreak;
            details["worstLossStreak"] = stats.WorstLossStreak;
            details["highestWin"] = stats.HighestWin;
            details["highestBet"] = stats.HighestBet;
            details["achievementCount"] = stats.AchievementCount;
            details["jackpotsWon"] = stats.JackpotsWon;
            details["joinTime"] = stats.JoinTime;
            details["lastBetTime"] = stats.LastBetTime;

            if (stats.TotalBets > 0)
            {
                details["winRate"] = stats.TotalWins * 10000 / stats.TotalBets;
            }

            details["netProfit"] = stats.TotalWon - stats.TotalLost;

            details["hasFirstWin"] = HasAchievement(player, 1);
            details["hasTenWins"] = HasAchievement(player, 2);
            details["hasHundredWins"] = HasAchievement(player, 3);
            details["hasHighRoller"] = HasAchievement(player, 4);
            details["hasLuckyStreak"] = HasAchievement(player, 5);
            details["hasJackpotWinner"] = HasAchievement(player, 6);
            details["hasVeteran"] = HasAchievement(player, 7);
            details["hasBigSpender"] = HasAchievement(player, 8);
            details["hasComebackKing"] = HasAchievement(player, 9);
            details["hasWhale"] = HasAchievement(player, 10);

            details["betCount"] = GetUserBetCount(player);

            return details;
        }

        #endregion
    }
}
