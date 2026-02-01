using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Badge Logic

        private static void CheckAndAwardBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            if (HasBadge(user, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            UserStats stats = GetUserStats(user);
            stats.BadgeCount += 1;
            StoreUserStats(user, stats);

        }

        #endregion
    }
}
