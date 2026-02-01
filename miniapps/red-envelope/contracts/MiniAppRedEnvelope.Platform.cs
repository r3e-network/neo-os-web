using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["envelopesCreated"] = stats.EnvelopesCreated;
            details["envelopesClaimed"] = stats.EnvelopesClaimed;
            details["totalSent"] = stats.TotalSent;
            details["totalReceived"] = stats.TotalReceived;
            details["bestLuckWins"] = stats.BestLuckWins;
            details["highestSingleClaim"] = stats.HighestSingleClaim;
            details["highestEnvelopeCreated"] = stats.HighestEnvelopeCreated;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            details["hasFirstEnvelope"] = HasBadge(user, 1);
            details["hasGenerous"] = HasBadge(user, 2);
            details["hasLuckyOne"] = HasBadge(user, 3);
            details["hasCollector"] = HasBadge(user, 4);
            details["hasBigSpender"] = HasBadge(user, 5);
            details["hasSocialButterfly"] = HasBadge(user, 6);

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalEnvelopes"] = GetEnvelopeCount();
            stats["totalDistributed"] = GetTotalDistributed();
            stats["totalUsers"] = TotalUsers();
            stats["minAmount"] = MIN_AMOUNT;
            stats["maxPackets"] = MAX_PACKETS;
            stats["defaultExpirySeconds"] = DEFAULT_EXPIRY_SECONDS;
            return stats;
        }

        #endregion
    }
}
