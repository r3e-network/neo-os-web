using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHeritageTrust
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetTrustDetails(BigInteger trustId)
        {
            Trust trust = GetTrust(trustId);
            Map<string, object> details = new Map<string, object>();
            if (trust.Owner == UInt160.Zero) return details;

            details["id"] = trustId;
            details["owner"] = trust.Owner;
            details["primaryHeir"] = trust.PrimaryHeir;
            details["principal"] = trust.Principal;
            details["gasPrincipal"] = trust.GasPrincipal;
            details["accruedYield"] = trust.AccruedYield;
            details["claimedYield"] = trust.ClaimedYield;
            details["monthlyNeo"] = trust.MonthlyNeoRelease;
            details["monthlyGas"] = trust.MonthlyGasRelease;
            details["onlyRewards"] = trust.OnlyReleaseRewards;
            details["releaseMode"] = ResolveReleaseMode(trust);
            details["lastReleaseTime"] = trust.LastReleaseTime;
            details["totalNeoReleased"] = trust.TotalNeoReleased;
            details["totalGasReleased"] = trust.TotalGasReleased;
            details["createdTime"] = trust.CreatedTime;
            details["lastHeartbeat"] = trust.LastHeartbeat;
            details["heartbeatInterval"] = trust.HeartbeatInterval;
            details["deadline"] = trust.Deadline;
            details["active"] = trust.Active;
            details["executed"] = trust.Executed;
            details["cancelled"] = trust.Cancelled;
            details["trustName"] = trust.TrustName;
            details["notes"] = trust.Notes;

            if (trust.Active && !trust.Executed)
            {
                BigInteger graceDeadline = trust.Deadline + GRACE_PERIOD_SECONDS;
                if (Runtime.Time < trust.Deadline)
                {
                    details["status"] = "active";
                    details["timeUntilDeadline"] = trust.Deadline - Runtime.Time;
                }
                else if (Runtime.Time < graceDeadline)
                {
                    details["status"] = "grace_period";
                    details["timeUntilExecutable"] = graceDeadline - Runtime.Time;
                }
                else
                {
                    details["status"] = "executable";
                }
            }
            else if (trust.Executed)
            {
                details["status"] = "executed";
            }
            else if (trust.Cancelled)
            {
                details["status"] = "cancelled";
            }
            else
            {
                details["status"] = "inactive";
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalTrusts"] = TotalTrusts();
            stats["totalPrincipal"] = TotalPrincipal();
            stats["totalYieldDistributed"] = TotalYieldDistributed();
            stats["totalExecuted"] = TotalExecuted();
            stats["totalOwners"] = TotalOwners();
            stats["totalCancelled"] = TotalCancelled();

            stats["minPrincipal"] = MIN_PRINCIPAL;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;
            stats["cancelPenaltyBps"] = CANCEL_PENALTY_BPS;
            stats["defaultHeartbeatSeconds"] = HEARTBEAT_INTERVAL_SECONDS;
            stats["minHeartbeatSeconds"] = MIN_HEARTBEAT_SECONDS;
            stats["maxHeartbeatSeconds"] = MAX_HEARTBEAT_SECONDS;
            stats["gracePeriodSeconds"] = GRACE_PERIOD_SECONDS;

            return stats;
        }

        [Safe]
        public static Map<string, object> GetOwnerStatsDetails(UInt160 owner)
        {
            OwnerStats stats = GetOwnerStats(owner);
            Map<string, object> details = new Map<string, object>();

            details["trustsCreated"] = stats.TrustsCreated;
            details["activeTrusts"] = stats.ActiveTrusts;
            details["totalPrincipalDeposited"] = stats.TotalPrincipalDeposited;
            details["totalYieldClaimed"] = stats.TotalYieldClaimed;
            details["trustsExecuted"] = stats.TrustsExecuted;
            details["trustsCancelled"] = stats.TrustsCancelled;
            details["guardiansAdded"] = stats.GuardiansAdded;
            details["heartbeatCount"] = stats.HeartbeatCount;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["highestPrincipal"] = stats.HighestPrincipal;
            details["principalAdditions"] = stats.PrincipalAdditions;
            details["trustCount"] = GetUserTrustCount(owner);

            return details;
        }

        [Safe]
        public static BigInteger[] GetUserTrusts(UInt160 user, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetUserTrustCount(user);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_TRUSTS, user),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static BigInteger GetHeirTrustCount(UInt160 heir)
        {
            byte[] key = Helper.Concat(PREFIX_HEIR_TRUST_COUNT, heir);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger[] GetHeirTrusts(UInt160 heir, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetHeirTrustCount(heir);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_HEIR_TRUSTS, heir),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }
        #endregion
    }
}
