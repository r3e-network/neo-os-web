using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStatsData(user);
            Map<string, object> details = new Map<string, object>();

            details["totalCapsules"] = stats.TotalCapsules;
            details["activeCapsules"] = stats.ActiveCapsules;
            details["totalDeposited"] = stats.TotalDeposited;
            details["totalWithdrawn"] = stats.TotalWithdrawn;
            details["totalEarned"] = stats.TotalEarned;
            details["totalPenalties"] = stats.TotalPenalties;
            details["highestDeposit"] = stats.HighestDeposit;
            details["longestLock"] = stats.LongestLock;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            // Calculate net profit
            details["netProfit"] = stats.TotalEarned - stats.TotalPenalties;

            // Check badge status
            details["hasFirstCapsule"] = HasUserBadge(user, 1);
            details["hasLongTermSaver"] = HasUserBadge(user, 2);
            details["hasDiamondHands"] = HasUserBadge(user, 3);
            details["hasWhaleDepositor"] = HasUserBadge(user, 4);
            details["hasCompoundMaster"] = HasUserBadge(user, 5);
            details["hasLoyalSaver"] = HasUserBadge(user, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalCapsules"] = TotalCapsules();
            stats["totalLocked"] = TotalLocked();
            stats["totalCompound"] = TotalCompound();
            stats["totalUsers"] = TotalUsers();
            stats["totalWithdrawn"] = TotalWithdrawn();
            stats["totalPenalties"] = TotalPenalties();

            // Configuration info
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;
            stats["earlyWithdrawPenaltyBps"] = EARLY_WITHDRAW_PENALTY_BPS;
            stats["minDeposit"] = MIN_DEPOSIT;
            stats["minLockDays"] = MIN_LOCK_DAYS;
            stats["maxLockDays"] = MAX_LOCK_DAYS;

            // APY tiers
            stats["tier1Days"] = TIER1_DAYS;
            stats["tier1ApyBps"] = TIER1_APY_BPS;
            stats["tier2Days"] = TIER2_DAYS;
            stats["tier2ApyBps"] = TIER2_APY_BPS;
            stats["tier3Days"] = TIER3_DAYS;
            stats["tier3ApyBps"] = TIER3_APY_BPS;
            stats["tier4Days"] = TIER4_DAYS;
            stats["tier4ApyBps"] = TIER4_APY_BPS;

            return stats;
        }

        #endregion
    }
}
