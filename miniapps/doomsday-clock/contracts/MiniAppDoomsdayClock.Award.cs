using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Award Badge

        private static void AwardPlayerBadge(UInt160 player, BigInteger badgeType, string badgeName)
        {
            if (HasPlayerBadge(player, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_PLAYER_BADGES, player),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            PlayerStats stats = GetPlayerStats(player);
            stats.BadgeCount += 1;
            StorePlayerStats(player, stats);

            OnPlayerBadgeEarned(player, badgeType, badgeName);
        }

        #endregion
    }
}
