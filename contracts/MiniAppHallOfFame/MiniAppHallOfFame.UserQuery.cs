using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region User Stats Query

        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserStats stats = GetUserStats(user);
            Map<string, object> details = new Map<string, object>();

            details["totalVoted"] = stats.TotalVoted;
            details["voteCount"] = stats.VoteCount;
            details["seasonsParticipated"] = stats.SeasonsParticipated;
            details["rewardsClaimed"] = stats.RewardsClaimed;
            details["nomineesAdded"] = stats.NomineesAdded;
            details["highestSingleVote"] = stats.HighestSingleVote;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;

            details["hasFirstVote"] = HasVoterBadge(user, 1);
            details["hasActiveVoter"] = HasVoterBadge(user, 2);
            details["hasWhaleVoter"] = HasVoterBadge(user, 3);
            details["hasSeasonVeteran"] = HasVoterBadge(user, 4);
            details["hasNominator"] = HasVoterBadge(user, 5);
            details["hasLoyalSupporter"] = HasVoterBadge(user, 6);

            return details;
        }

        #endregion
    }
}
