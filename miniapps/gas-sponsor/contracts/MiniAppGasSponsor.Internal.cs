using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasSponsor
    {
        #region Internal Helpers

        private static void StorePool(BigInteger poolId, PoolData pool)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_POOLS, (ByteString)poolId.ToByteArray()),
                StdLib.Serialize(pool));
        }

        private static void StoreSponsorStats(UInt160 sponsor, SponsorStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_SPONSOR_STATS, sponsor),
                StdLib.Serialize(stats));
        }

        private static void StoreBeneficiaryStats(UInt160 beneficiary, BeneficiaryStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_BENEFICIARY_STATS, beneficiary),
                StdLib.Serialize(stats));
        }

        private static void UpdateSponsorStatsOnCreate(UInt160 sponsor, BigInteger amount)
        {
            SponsorStats stats = GetSponsorStats(sponsor);

            bool isNewSponsor = stats.JoinTime == 0;
            if (isNewSponsor)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalSponsors = GetTotalSponsors();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SPONSORS, totalSponsors + 1);
            }

            stats.PoolsCreated += 1;
            stats.TotalSponsored += amount;
            stats.ActivePools += 1;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestSinglePool)
                stats.HighestSinglePool = amount;

            StoreSponsorStats(sponsor, stats);
        }

        private static void UpdateSponsorStatsOnClaim(UInt160 sponsor)
        {
            SponsorStats stats = GetSponsorStats(sponsor);
            stats.TotalClaimed += 1;
            stats.BeneficiariesHelped += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreSponsorStats(sponsor, stats);
        }

        private static void UpdateSponsorStatsOnTopUp(UInt160 sponsor, BigInteger amount)
        {
            SponsorStats stats = GetSponsorStats(sponsor);
            stats.TotalSponsored += amount;
            stats.TopUpsCount += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreSponsorStats(sponsor, stats);
            CheckSponsorBadges(sponsor);
        }

        private static void UpdateBeneficiaryStatsOnClaim(UInt160 beneficiary, BigInteger amount, BigInteger poolId)
        {
            BeneficiaryStats stats = GetBeneficiaryStats(beneficiary);

            bool isNewBeneficiary = stats.JoinTime == 0;
            if (isNewBeneficiary)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalBeneficiaries = GetTotalBeneficiaries();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BENEFICIARIES, totalBeneficiaries + 1);
            }

            BigInteger prevClaimed = GetUserClaimedFromPool(beneficiary, poolId);
            if (prevClaimed == 0)
                stats.PoolsUsed += 1;

            stats.TotalClaimed += amount;
            stats.ClaimCount += 1;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestSingleClaim)
                stats.HighestSingleClaim = amount;

            StoreBeneficiaryStats(beneficiary, stats);
        }

        #endregion
    }
}
