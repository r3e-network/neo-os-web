using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasSponsor
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetPoolDetails(BigInteger poolId)
        {
            PoolData pool = GetPoolData(poolId);
            Map<string, object> details = new Map<string, object>();
            if (pool.Sponsor == UInt160.Zero) return details;

            details["id"] = poolId;
            details["sponsor"] = pool.Sponsor;
            details["poolType"] = pool.PoolType;
            details["initialAmount"] = pool.InitialAmount;
            details["remainingAmount"] = pool.RemainingAmount;
            details["maxClaimPerUser"] = pool.MaxClaimPerUser;
            details["totalClaimed"] = pool.TotalClaimed;
            details["claimCount"] = pool.ClaimCount;
            details["createTime"] = pool.CreateTime;
            details["expiryTime"] = pool.ExpiryTime;
            details["active"] = pool.Active;
            details["description"] = pool.Description;

            if (pool.Active && Runtime.Time < pool.ExpiryTime)
            {
                details["status"] = "active";
                details["remainingTime"] = pool.ExpiryTime - Runtime.Time;
            }
            else if (Runtime.Time >= pool.ExpiryTime)
                details["status"] = "expired";
            else
                details["status"] = "depleted";

            return details;
        }

        [Safe]
        public static Map<string, object> GetSponsorStatsDetails(UInt160 sponsor)
        {
            SponsorStats stats = GetSponsorStats(sponsor);
            Map<string, object> details = new Map<string, object>();

            details["poolsCreated"] = stats.PoolsCreated;
            details["totalSponsored"] = stats.TotalSponsored;
            details["totalClaimed"] = stats.TotalClaimed;
            details["beneficiariesHelped"] = stats.BeneficiariesHelped;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["activePools"] = stats.ActivePools;
            details["highestSinglePool"] = stats.HighestSinglePool;
            details["topUpsCount"] = stats.TopUpsCount;

            details["hasFirstPool"] = HasSponsorBadge(sponsor, 1);
            details["hasGenerous"] = HasSponsorBadge(sponsor, 2);
            details["hasPatron"] = HasSponsorBadge(sponsor, 3);
            details["hasBenefactor"] = HasSponsorBadge(sponsor, 4);
            details["hasPoolMaster"] = HasSponsorBadge(sponsor, 5);
            details["hasTopUpKing"] = HasSponsorBadge(sponsor, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetBeneficiaryStatsDetails(UInt160 beneficiary)
        {
            BeneficiaryStats stats = GetBeneficiaryStats(beneficiary);
            Map<string, object> details = new Map<string, object>();

            details["totalClaimed"] = stats.TotalClaimed;
            details["claimCount"] = stats.ClaimCount;
            details["poolsUsed"] = stats.PoolsUsed;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["highestSingleClaim"] = stats.HighestSingleClaim;

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalPools"] = GetPoolCount();
            stats["activePools"] = GetActivePoolCount();
            stats["totalSponsored"] = GetTotalSponsored();
            stats["totalClaimed"] = GetTotalClaimed();
            stats["totalSponsors"] = GetTotalSponsors();
            stats["totalBeneficiaries"] = GetTotalBeneficiaries();

            stats["minSponsorship"] = MIN_SPONSORSHIP;
            stats["maxClaimPerTx"] = MAX_CLAIM_PER_TX;
            stats["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            stats["topUpMin"] = TOP_UP_MIN;
            stats["maxWhitelistSize"] = MAX_WHITELIST_SIZE;

            return stats;
        }

        #endregion
    }
}
