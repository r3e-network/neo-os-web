using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Badge Logic

        private static void CheckVoterBadges(UInt160 voter)
        {
            UserStats stats = GetUserStats(voter);

            if (stats.VoteCount >= 1)
                AwardVoterBadge(voter, 1, "First Vote");

            if (stats.VoteCount >= 10)
                AwardVoterBadge(voter, 2, "Active Voter");

            if (stats.HighestSingleVote >= 1000000000)
                AwardVoterBadge(voter, 3, "Whale Voter");

            if (stats.SeasonsParticipated >= 5)
                AwardVoterBadge(voter, 4, "Season Veteran");

            if (stats.NomineesAdded >= 3)
                AwardVoterBadge(voter, 5, "Nominator");

            if (stats.TotalVoted >= 5000000000)
                AwardVoterBadge(voter, 6, "Loyal Supporter");
        }

        #endregion
    }
}
