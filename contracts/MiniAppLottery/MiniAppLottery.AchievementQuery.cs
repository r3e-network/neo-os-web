using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Achievement Query

        [Safe]
        public static Map<string, object> GetPlayerAchievements(UInt160 player)
        {
            Map<string, object> achievements = new Map<string, object>();

            achievements["hasFirstTicket"] = HasAchievement(player, 1);
            achievements["hasTenTickets"] = HasAchievement(player, 2);
            achievements["hasHundredTickets"] = HasAchievement(player, 3);
            achievements["hasFirstWin"] = HasAchievement(player, 4);
            achievements["hasBigWinner"] = HasAchievement(player, 5);
            achievements["hasLuckyStreak"] = HasAchievement(player, 6);

            return achievements;
        }

        #endregion
    }
}
