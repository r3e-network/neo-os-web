using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasSponsor
    {
        #region Badge Logic

        /// <summary>
        /// Check and award sponsor badges based on achievements.
        /// Badges: 1=FirstPool, 2=Generous(10 GAS), 3=Patron(100 GAS),
        ///         4=Benefactor(1000 GAS), 5=PoolMaster(10 pools), 6=TopUpKing(10 top-ups)
        /// </summary>
        private static void CheckSponsorBadges(UInt160 sponsor)
        {
            SponsorStats stats = GetSponsorStats(sponsor);

            if (stats.PoolsCreated >= 1)
                AwardSponsorBadge(sponsor, 1, "First Pool");

            if (stats.TotalSponsored >= 1000000000) // 10 GAS
                AwardSponsorBadge(sponsor, 2, "Generous");

            if (stats.TotalSponsored >= 10000000000) // 100 GAS
                AwardSponsorBadge(sponsor, 3, "Patron");

            if (stats.TotalSponsored >= 100000000000) // 1000 GAS
                AwardSponsorBadge(sponsor, 4, "Benefactor");

            if (stats.PoolsCreated >= 10)
                AwardSponsorBadge(sponsor, 5, "Pool Master");

            if (stats.TopUpsCount >= 10)
                AwardSponsorBadge(sponsor, 6, "Top Up King");
        }

        private static void AwardSponsorBadge(UInt160 sponsor, BigInteger badgeType, string badgeName)
        {
            if (HasSponsorBadge(sponsor, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_SPONSOR_BADGES, sponsor),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            SponsorStats stats = GetSponsorStats(sponsor);
            stats.BadgeCount += 1;
            StoreSponsorStats(sponsor, stats);

            OnSponsorBadgeEarned(sponsor, badgeType, badgeName);
        }

        #endregion
    }
}
