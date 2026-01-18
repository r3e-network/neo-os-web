using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGuardianPolicy
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetPolicyDetails(BigInteger policyId)
        {
            PolicyData policy = GetPolicy(policyId);
            Map<string, object> details = new Map<string, object>();
            if (policy.Holder == UInt160.Zero) return details;

            details["id"] = policyId;
            details["holder"] = policy.Holder;
            details["assetType"] = policy.AssetType;
            details["policyType"] = policy.PolicyType;
            details["coverage"] = policy.Coverage;
            details["premium"] = policy.Premium;
            details["startPrice"] = policy.StartPrice;
            details["thresholdPercent"] = policy.ThresholdPercent;
            details["startTime"] = policy.StartTime;
            details["endTime"] = policy.EndTime;
            details["renewalCount"] = policy.RenewalCount;
            details["active"] = policy.Active;
            details["claimed"] = policy.Claimed;
            details["payoutAmount"] = policy.PayoutAmount;

            // Calculate status
            ulong currentTime = Runtime.Time;
            if (policy.Claimed)
            {
                details["status"] = "claimed";
            }
            else if (!policy.Active)
            {
                details["status"] = "cancelled";
            }
            else if (currentTime > (ulong)policy.EndTime)
            {
                details["status"] = "expired";
            }
            else
            {
                details["status"] = "active";
                details["remainingTime"] = policy.EndTime - (BigInteger)currentTime;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetHolderStatsDetails(UInt160 holder)
        {
            HolderStats stats = GetHolderStats(holder);
            Map<string, object> details = new Map<string, object>();

            details["totalPolicies"] = stats.TotalPolicies;
            details["activePolicies"] = stats.ActivePolicies;
            details["totalPremiumsPaid"] = stats.TotalPremiumsPaid;
            details["totalCoverage"] = stats.TotalCoverage;
            details["totalClaims"] = stats.TotalClaims;
            details["approvedClaims"] = stats.ApprovedClaims;
            details["totalPayoutsReceived"] = stats.TotalPayoutsReceived;
            details["claimFreePolicies"] = stats.ClaimFreePolicies;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastPolicyTime"] = stats.LastPolicyTime;

            // Calculate claim approval rate
            if (stats.TotalClaims > 0)
            {
                details["claimApprovalRate"] = stats.ApprovedClaims * 10000 / stats.TotalClaims;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalPolicies"] = GetPolicyCount();
            stats["activePolicies"] = GetActivePolicyCount();
            stats["totalHolders"] = GetTotalHolders();
            stats["totalCoverage"] = GetTotalCoverage();
            stats["totalPremiums"] = GetTotalPremiums();
            stats["totalPayouts"] = GetTotalPayouts();
            stats["minCoverage"] = MIN_COVERAGE;
            stats["maxCoverage"] = MAX_COVERAGE;
            stats["premiumRate"] = PREMIUM_RATE_PERCENT;
            stats["policyDurationSeconds"] = POLICY_DURATION_SECONDS;
            return stats;
        }

        #endregion
    }
}
