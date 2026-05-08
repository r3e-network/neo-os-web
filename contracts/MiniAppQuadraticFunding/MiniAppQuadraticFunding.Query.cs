using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppQuadraticFunding
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetRoundDetails(BigInteger roundId)
        {
            RoundData round = GetRound(roundId);
            Map<string, object> details = new Map<string, object>();
            if (round.Creator == UInt160.Zero) return details;

            string status;
            if (round.Cancelled)
            {
                status = "cancelled";
            }
            else if (round.Finalized)
            {
                status = "finalized";
            }
            else if (Runtime.Time < round.StartTime)
            {
                status = "upcoming";
            }
            else if (Runtime.Time > round.EndTime)
            {
                status = "ended";
            }
            else
            {
                status = "active";
            }

            details["id"] = roundId;
            details["creator"] = round.Creator;
            details["asset"] = round.Asset;
            details["assetSymbol"] = IsNeo(round.Asset) ? "NEO" : "GAS";
            details["matchingPool"] = round.MatchingPool;
            details["matchingAllocated"] = round.MatchingAllocated;
            details["matchingWithdrawn"] = round.MatchingWithdrawn;
            details["matchingRemaining"] = round.MatchingPool - round.MatchingAllocated - round.MatchingWithdrawn;
            details["totalContributed"] = round.TotalContributed;
            details["projectCount"] = round.ProjectCount;
            details["startTime"] = round.StartTime;
            details["endTime"] = round.EndTime;
            details["createdTime"] = round.CreatedTime;
            details["finalized"] = round.Finalized;
            details["cancelled"] = round.Cancelled;
            details["status"] = status;
            details["title"] = round.Title;
            details["description"] = round.Description;
            return details;
        }

        [Safe]
        public static Map<string, object> GetProjectDetails(BigInteger projectId)
        {
            ProjectData project = GetProject(projectId);
            Map<string, object> details = new Map<string, object>();
            if (project.Owner == UInt160.Zero) return details;

            RoundData round = GetRound(project.RoundId);
            string status = project.Active ? "active" : "inactive";
            if (project.Claimed) status = "claimed";

            details["id"] = projectId;
            details["roundId"] = project.RoundId;
            details["owner"] = project.Owner;
            details["name"] = project.Name;
            details["description"] = project.Description;
            details["link"] = project.Link;
            details["createdTime"] = project.CreatedTime;
            details["totalContributed"] = project.TotalContributed;
            details["contributorCount"] = project.ContributorCount;
            details["matchedAmount"] = project.MatchedAmount;
            details["active"] = project.Active;
            details["claimed"] = project.Claimed;
            details["status"] = status;
            details["asset"] = round.Asset;
            details["assetSymbol"] = IsNeo(round.Asset) ? "NEO" : "GAS";
            details["roundFinalized"] = round.Finalized;
            return details;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalRounds"] = TotalRounds();
            stats["totalProjects"] = TotalProjects();
            stats["minNeo"] = MIN_NEO;
            stats["minGas"] = MIN_GAS;
            stats["maxTitleLength"] = MAX_TITLE_LENGTH;
            stats["maxProjectName"] = MAX_PROJECT_NAME_LENGTH;
            return stats;
        }

        [Safe]
        public static BigInteger[] GetRounds(BigInteger offset, BigInteger limit)
        {
            BigInteger total = TotalRounds();
            if (offset >= total) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > total) end = total;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                result[(int)i] = offset + i + 1;
            }
            return result;
        }

        [Safe]
        public static BigInteger[] GetRoundProjects(BigInteger roundId, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetRoundProjectCountInternal(roundId);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, BuildRoundProjectKey(roundId, offset + i));
            }
            return result;
        }

        [Safe]
        public static BigInteger[] GetOwnerProjects(UInt160 owner, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetOwnerProjectCountInternal(owner);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_OWNER_PROJECTS, owner),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static BigInteger[] GetCreatorRounds(UInt160 creator, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetCreatorRoundCountInternal(creator);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_CREATOR_ROUNDS, creator),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        #endregion
    }
}
