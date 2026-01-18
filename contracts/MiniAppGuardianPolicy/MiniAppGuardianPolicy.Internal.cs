using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGuardianPolicy
    {
        #region Internal Helpers

        private static void StorePolicy(BigInteger policyId, PolicyData policy)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_POLICIES, (ByteString)policyId.ToByteArray()),
                StdLib.Serialize(policy));
        }

        private static void StoreHolderStats(UInt160 holder, HolderStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HOLDER_STATS, holder),
                StdLib.Serialize(stats));
        }

        private static void UpdateHolderStatsOnCreate(UInt160 holder, BigInteger coverage, BigInteger premium, bool isNew)
        {
            HolderStats stats = GetHolderStats(holder);

            if (isNew)
            {
                stats.JoinTime = (BigInteger)Runtime.Time;
                BigInteger totalHolders = GetTotalHolders();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HOLDERS, totalHolders + 1);
            }

            stats.TotalPolicies += 1;
            stats.ActivePolicies += 1;
            stats.TotalPremiumsPaid += premium;
            stats.TotalCoverage += coverage;
            stats.LastPolicyTime = (BigInteger)Runtime.Time;

            StoreHolderStats(holder, stats);
        }

        private static void UpdateHolderStatsOnClaim(UInt160 holder, bool approved, BigInteger payout)
        {
            HolderStats stats = GetHolderStats(holder);

            stats.ActivePolicies -= 1;

            if (approved)
            {
                stats.ApprovedClaims += 1;
                stats.TotalPayoutsReceived += payout;
            }
            else
            {
                // Policy completed without claim payout
                stats.ClaimFreePolicies += 1;
            }

            StoreHolderStats(holder, stats);
            CheckHolderBadges(holder);
        }

        #endregion

        #region Badge Logic

        private static void CheckHolderBadges(UInt160 holder)
        {
            HolderStats stats = GetHolderStats(holder);

            // Badge 1: First Policy
            if (stats.TotalPolicies >= 1)
            {
                AwardHolderBadge(holder, 1, "First Policy");
            }

            // Badge 2: Loyal Customer (5 policies)
            if (stats.TotalPolicies >= 5)
            {
                AwardHolderBadge(holder, 2, "Loyal Customer");
            }

            // Badge 3: High Value (100 GAS total coverage)
            if (stats.TotalCoverage >= 10000000000) // 100 GAS
            {
                AwardHolderBadge(holder, 3, "High Value");
            }

            // Badge 4: Claim Free (3 policies without claims)
            if (stats.ClaimFreePolicies >= 3)
            {
                AwardHolderBadge(holder, 4, "Claim Free");
            }
        }

        private static void AwardHolderBadge(UInt160 holder, BigInteger badgeType, string badgeName)
        {
            if (HasHolderBadge(holder, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_HOLDER_BADGES, holder),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            HolderStats stats = GetHolderStats(holder);
            stats.BadgeCount += 1;
            StoreHolderStats(holder, stats);

            OnHolderBadgeEarned(holder, badgeType, badgeName);
        }

        #endregion
    }
}
