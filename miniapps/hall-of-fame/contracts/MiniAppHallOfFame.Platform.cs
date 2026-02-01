using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Platform Stats

        /// <summary>
        /// Get comprehensive platform statistics.
        /// 
        /// RETURNS:
        /// - currentSeason: Active season ID
        /// - totalPool: Total GAS pool
        /// - totalVoters: Number of unique voters
        /// - totalNominees: Number of nominees
        /// - totalInducted: Number of inducted members
        /// - minVote: Minimum vote amount
        /// - seasonDurationSeconds: Season duration
        /// - platformFeeBps: Platform fee (basis points)
        /// - voterRewardBps: Voter reward (basis points)
        /// - maxCategoryLength: Max category name length
        /// - maxNomineeLength: Max nominee name length
        /// - currentSeasonVotes: Votes in current season
        /// - currentSeasonVoters: Voters in current season
        /// - currentSeasonActive: Whether season is active
        /// - currentSeasonRemainingTime: Seconds remaining in season
        /// </summary>
        /// <returns>Map of platform statistics</returns>
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["currentSeason"] = CurrentSeasonId();
            stats["totalPool"] = TotalPool();
            stats["totalVoters"] = TotalVoters();
            stats["totalNominees"] = TotalNominees();
            stats["totalInducted"] = TotalInducted();

            stats["minVote"] = MIN_VOTE;
            stats["seasonDurationSeconds"] = SEASON_DURATION_SECONDS;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;
            stats["voterRewardBps"] = VOTER_REWARD_BPS;
            stats["maxCategoryLength"] = MAX_CATEGORY_LENGTH;
            stats["maxNomineeLength"] = MAX_NOMINEE_LENGTH;

            BigInteger currentSeasonId = CurrentSeasonId();
            if (currentSeasonId > 0)
            {
                Season currentSeason = GetSeason(currentSeasonId);
                stats["currentSeasonVotes"] = currentSeason.TotalVotes;
                stats["currentSeasonVoters"] = currentSeason.VoterCount;
                stats["currentSeasonActive"] = currentSeason.Active;
                if (currentSeason.Active)
                {
                    BigInteger remaining = currentSeason.EndTime - Runtime.Time;
                    stats["currentSeasonRemainingTime"] = remaining > 0 ? remaining : 0;
                }
            }

            return stats;
        }

        #endregion
    }
}
