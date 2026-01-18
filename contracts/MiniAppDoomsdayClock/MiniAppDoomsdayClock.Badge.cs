using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Badge Logic

        private static void CheckPlayerBadges(UInt160 player)
        {
            PlayerStats stats = GetPlayerStats(player);

            if (stats.TotalKeysOwned >= 1)
                AwardPlayerBadge(player, 1, "First Key");

            if (stats.TotalKeysOwned >= 100)
                AwardPlayerBadge(player, 2, "Key Collector");

            if (stats.TotalSpent >= 1000000000)
                AwardPlayerBadge(player, 3, "Big Spender");

            if (stats.RoundsWon >= 1)
                AwardPlayerBadge(player, 4, "Winner");

            if (stats.RoundsWon >= 5)
                AwardPlayerBadge(player, 5, "Champion");

            if (stats.TotalSpent >= 10000000000)
                AwardPlayerBadge(player, 6, "Whale");
        }

        #endregion
    }
}
