using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region Hacker Badge Logic

        /// <summary>
        /// Check and award hacker badges.
        /// 1=FirstBreak, 2=Persistent(10), 3=VaultCrusher(5),
        /// 4=EliteHacker(10), 5=HardcoreHacker(3 hard), 6=BigEarner(100 GAS)
        /// </summary>
        private static void CheckHackerBadges(UInt160 hacker)
        {
            HackerStats stats = GetHackerStats(hacker);

            if (stats.VaultsBroken >= 1)
                AwardHackerBadge(hacker, 1, "First Break");

            if (stats.TotalAttempts >= 10)
                AwardHackerBadge(hacker, 2, "Persistent");

            if (stats.VaultsBroken >= 5)
                AwardHackerBadge(hacker, 3, "Vault Crusher");

            if (stats.VaultsBroken >= 10)
                AwardHackerBadge(hacker, 4, "Elite Hacker");

            if (stats.HardBroken >= 3)
                AwardHackerBadge(hacker, 5, "Hardcore Hacker");

            if (stats.TotalEarned >= 10000000000)
                AwardHackerBadge(hacker, 6, "Big Earner");
        }

        private static void AwardHackerBadge(UInt160 hacker, BigInteger badgeType, string badgeName)
        {
            if (HasHackerBadge(hacker, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_HACKER_BADGES, hacker),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            HackerStats stats = GetHackerStats(hacker);
            stats.BadgeCount += 1;
            StoreHackerStats(hacker, stats);

            OnHackerBadgeEarned(hacker, badgeType, badgeName);
        }

        #endregion

        #region Creator Badge Logic

        /// <summary>
        /// Check and award creator badges.
        /// 1=FirstVault, 2=BountyMaster(5), 3=Unbreakable(3 expired),
        /// 4=HighRoller(50 GAS), 5=VaultArchitect(10)
        /// </summary>
        private static void CheckCreatorBadges(UInt160 creator)
        {
            CreatorStats stats = GetCreatorStats(creator);

            if (stats.VaultsCreated >= 1)
                AwardCreatorBadge(creator, 1, "First Vault");

            if (stats.VaultsCreated >= 5)
                AwardCreatorBadge(creator, 2, "Bounty Master");

            if (stats.VaultsExpired >= 3)
                AwardCreatorBadge(creator, 3, "Unbreakable");

            if (stats.TotalBountiesPosted >= 5000000000)
                AwardCreatorBadge(creator, 4, "High Roller");

            if (stats.VaultsCreated >= 10)
                AwardCreatorBadge(creator, 5, "Vault Architect");
        }

        private static void AwardCreatorBadge(UInt160 creator, BigInteger badgeType, string badgeName)
        {
            if (HasCreatorBadge(creator, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_BADGES, creator),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            CreatorStats stats = GetCreatorStats(creator);
            stats.BadgeCount += 1;
            StoreCreatorStats(creator, stats);

            OnCreatorBadgeEarned(creator, badgeType, badgeName);
        }

        #endregion
    }
}
