using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGraveyard
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetMemoryDetails(BigInteger memoryId)
        {
            Memory memory = GetMemory(memoryId);
            Map<string, object> details = new Map<string, object>();
            if (memory.Owner == UInt160.Zero) return details;

            details["id"] = memoryId;
            details["owner"] = memory.Owner;
            details["memoryType"] = memory.MemoryType;
            details["buriedTime"] = memory.BuriedTime;
            details["forgotten"] = memory.Forgotten;
            details["epitaph"] = memory.Epitaph;

            if (memory.Forgotten)
            {
                details["forgottenTime"] = memory.ForgottenTime;
            }
            else
            {
                details["contentHash"] = memory.ContentHash;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetMemorialDetails(BigInteger memorialId)
        {
            Memorial memorial = GetMemorial(memorialId);
            Map<string, object> details = new Map<string, object>();
            if (memorial.Creator == UInt160.Zero) return details;

            details["id"] = memorialId;
            details["creator"] = memorial.Creator;
            details["title"] = memorial.Title;
            details["description"] = memorial.Description;
            details["createdTime"] = memorial.CreatedTime;
            details["totalTributes"] = memorial.TotalTributes;
            details["tributeCount"] = memorial.TributeCount;
            details["active"] = memorial.Active;

            return details;
        }

        [Safe]
        public static Map<string, object> GetUserStats(UInt160 user)
        {
            UserStats stats = GetUserStatsData(user);
            Map<string, object> details = new Map<string, object>();

            details["memoriesBuried"] = stats.MemoriesBuried;
            details["memoriesForgotten"] = stats.MemoriesForgotten;
            details["memorialsCreated"] = stats.MemorialsCreated;
            details["tributesSent"] = stats.TributesSent;
            details["tributesReceived"] = stats.TributesReceived;
            details["totalSpent"] = stats.TotalSpent;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["secretsBuried"] = stats.SecretsBuried;
            details["regretsBuried"] = stats.RegretsBuried;
            details["wishesBuried"] = stats.WishesBuried;
            details["memoryCount"] = GetUserMemoryCount(user);

            details["hasFirstMemory"] = HasUserBadge(user, 1);
            details["hasMemoryKeeper"] = HasUserBadge(user, 2);
            details["hasLettingGo"] = HasUserBadge(user, 3);
            details["hasMemorialBuilder"] = HasUserBadge(user, 4);
            details["hasGenerous"] = HasUserBadge(user, 5);
            details["hasVeteran"] = HasUserBadge(user, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalMemories"] = TotalMemories();
            stats["totalMemorials"] = TotalMemorials();
            stats["totalBuried"] = TotalBuried();
            stats["totalForgotten"] = TotalForgotten();
            stats["totalTributes"] = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_TRIBUTES);
            stats["totalUsers"] = TotalUsers();
            stats["buryFee"] = BURY_FEE;
            stats["forgetFee"] = FORGET_FEE;
            stats["memorialFee"] = MEMORIAL_FEE;
            stats["minTribute"] = MIN_TRIBUTE;
            return stats;
        }

        [Safe]
        public static string GetMemoryTypeName(BigInteger memoryType)
        {
            if (memoryType == 1) return "Secret";
            if (memoryType == 2) return "Regret";
            if (memoryType == 3) return "Wish";
            if (memoryType == 4) return "Confession";
            return "Other";
        }

        #endregion
    }
}
