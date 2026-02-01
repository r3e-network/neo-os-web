using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Player Query Methods

        [Safe]
        public static Map<string, object> GetPlayerStatsDetails(UInt160 player)
        {
            PlayerStats stats = GetPlayerStats(player);
            Map<string, object> details = new Map<string, object>();

            details["totalKeysOwned"] = stats.TotalKeysOwned;
            details["totalSpent"] = stats.TotalSpent;
            details["totalWon"] = stats.TotalWon;
            details["roundsPlayed"] = stats.RoundsPlayed;
            details["roundsWon"] = stats.RoundsWon;
            details["referralEarnings"] = stats.ReferralEarnings;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["highestSinglePurchase"] = stats.HighestSinglePurchase;
            details["dividendsClaimed"] = stats.DividendsClaimed;

            if (stats.RoundsPlayed > 0)
            {
                details["winRate"] = stats.RoundsWon * 10000 / stats.RoundsPlayed;
            }

            details["netProfit"] = stats.TotalWon - stats.TotalSpent;

            details["hasFirstKey"] = HasPlayerBadge(player, 1);
            details["hasKeyCollector"] = HasPlayerBadge(player, 2);
            details["hasBigSpender"] = HasPlayerBadge(player, 3);
            details["hasWinner"] = HasPlayerBadge(player, 4);
            details["hasChampion"] = HasPlayerBadge(player, 5);
            details["hasWhale"] = HasPlayerBadge(player, 6);

            return details;
        }

        #endregion
    }
}
