using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Achievement Check

        /// <summary>
        /// Check and award achievements based on player stats and bet.
        /// 
        /// ACHIEVEMENTS:
        /// - 1 "First Win": First win
        /// - 2 "Ten Wins": 10 total wins
        /// - 3 "Hundred Wins": 100 total wins
        /// - 4 "High Roller": Bet >= 10 GAS
        /// - 5 "Lucky Streak": 5+ win streak
        /// - 6 "Jackpot Winner": Won jackpot
        /// - 7 "Veteran": 100 total bets
        /// - 8 "Big Spender": 100 GAS total wagered
        /// - 9 "Comeback King": 5 loss streak then win
        /// - 10 "Whale": Single bet >= 50 GAS
        /// </summary>
        /// <param name="player">Player address</param>
        /// <param name="stats">Player statistics</param>
        /// <param name="betAmount">Current bet amount</param>
        private static void CheckAchievements(UInt160 player, PlayerStats stats, BigInteger betAmount)
        {
            // Achievement 1: First Win
            if (stats.TotalWins == 1)
                AwardAchievement(player, 1, "First Win");

            // Achievement 2: Ten Wins
            if (stats.TotalWins == 10)
                AwardAchievement(player, 2, "Ten Wins");

            // Achievement 3: Hundred Wins
            if (stats.TotalWins == 100)
                AwardAchievement(player, 3, "Hundred Wins");

            // Achievement 4: High Roller
            if (betAmount >= HIGH_ROLLER_THRESHOLD)
                AwardAchievement(player, 4, "High Roller");

            // Achievement 5: Lucky Streak (5 wins)
            if (stats.BestWinStreak >= 5)
                AwardAchievement(player, 5, "Lucky Streak");

            // Achievement 6: Jackpot Winner
            if (stats.JackpotsWon >= 1)
                AwardAchievement(player, 6, "Jackpot Winner");

            // Achievement 7: Veteran (100 total bets)
            if (stats.TotalBets >= 100)
                AwardAchievement(player, 7, "Veteran");

            // Achievement 8: Big Spender (100 GAS total wagered)
            if (stats.TotalWagered >= 10000000000)
                AwardAchievement(player, 8, "Big Spender");

            // Achievement 9: Comeback King (5 loss streak then win)
            if (stats.WorstLossStreak >= 5 && stats.CurrentWinStreak >= 1)
                AwardAchievement(player, 9, "Comeback King");

            // Achievement 10: Whale (single bet >= 50 GAS)
            if (betAmount >= MAX_BET)
                AwardAchievement(player, 10, "Whale");
        }

        #endregion
    }
}
