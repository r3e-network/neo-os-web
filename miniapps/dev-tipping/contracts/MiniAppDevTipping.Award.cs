using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Award Methods

        private static void AwardTipperBadge(UInt160 tipper, BigInteger badgeType, string badgeName)
        {
            if (HasTipperBadge(tipper, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_TIPPER_BADGES, tipper),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            TipperStats stats = GetTipperStats(tipper);
            stats.BadgeCount += 1;
            StoreTipperStats(tipper, stats);

            OnTipperBadgeEarned(tipper, badgeType, badgeName);
        }

        private static void AwardDevBadge(BigInteger devId, BigInteger badgeType, string badgeName)
        {
            if (HasDevBadge(devId, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_DEV_BADGES, (ByteString)devId.ToByteArray()),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            DeveloperData dev = GetDeveloper(devId);
            dev.BadgeCount += 1;
            StoreDeveloper(devId, dev);

            OnDevBadgeEarned(devId, badgeType, badgeName);
        }

        #endregion
    }
}
