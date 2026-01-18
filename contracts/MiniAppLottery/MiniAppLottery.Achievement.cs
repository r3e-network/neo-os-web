using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Achievement System

        private static void CheckAchievements(UInt160 player, PlayerStats stats)
        {
            // Achievement 1: First Ticket
            if (stats.TotalTickets >= 1)
            {
                AwardAchievement(player, 1, "First Ticket");
            }

            // Achievement 2: Ten Tickets
            if (stats.TotalTickets >= 10)
            {
                AwardAchievement(player, 2, "Ten Tickets");
            }

            // Achievement 3: Hundred Tickets
            if (stats.TotalTickets >= 100)
            {
                AwardAchievement(player, 3, "Hundred Tickets");
            }

            // Achievement 4: First Win
            if (stats.TotalWins >= 1)
            {
                AwardAchievement(player, 4, "First Win");
            }

            // Achievement 5: Big Winner
            if (stats.HighestWin >= BIG_WIN_THRESHOLD)
            {
                AwardAchievement(player, 5, "Big Winner");
            }

            // Achievement 6: Lucky Streak (3 consecutive wins)
            if (stats.BestWinStreak >= 3)
            {
                AwardAchievement(player, 6, "Lucky Streak");
            }
        }

        #endregion
    }
}
