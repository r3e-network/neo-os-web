using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppTimeCapsule
    {
        #region Platform Stats

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["capsulesBuried"] = stats.CapsulesBuried;
            details["capsulesRevealed"] = stats.CapsulesRevealed;
            details["capsulesFished"] = stats.CapsulesFished;
            details["capsulesGifted"] = stats.CapsulesGifted;
            details["capsulesReceived"] = stats.CapsulesReceived;
            details["totalSpent"] = stats.TotalSpent;
            details["totalEarned"] = stats.TotalEarned;
            details["fishingRewards"] = stats.FishingRewards;
            details["joinTime"] = stats.JoinTime;
            details["favCategory"] = stats.FavCategory;
            details["capsuleCount"] = GetUserCapsuleCount(user);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalCapsules"] = TotalCapsules();
            stats["totalPublicCapsules"] = TotalPublicCapsules();
            stats["totalRevealed"] = TotalRevealed();
            stats["totalFished"] = TotalFished();
            stats["totalGifted"] = TotalGifted();
            stats["buryFee"] = BURY_FEE;
            stats["fishFee"] = FISH_FEE;
            stats["extendFee"] = EXTEND_FEE;
            stats["giftFee"] = GIFT_FEE;
            stats["fishReward"] = FISH_REWARD;
            stats["minLockDurationSeconds"] = MIN_LOCK_DURATION_SECONDS;
            stats["maxLockDurationSeconds"] = MAX_LOCK_DURATION_SECONDS;
            return stats;
        }

        [Safe]
        public static Map<string, object> GetCategoryStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["personal"] = GetCategoryCount(1);
            stats["gift"] = GetCategoryCount(2);
            stats["memorial"] = GetCategoryCount(3);
            stats["announcement"] = GetCategoryCount(4);
            stats["secret"] = GetCategoryCount(5);
            return stats;
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }

        #endregion
    }
}
