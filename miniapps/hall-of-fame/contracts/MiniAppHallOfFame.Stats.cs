using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Stats Update

        /// <summary>
        /// Update user statistics after voting.
        /// 
        /// EFFECTS:
        /// - Increments total voted amount
        /// - Increments vote count
        /// - Updates join time for new voters
        /// - Tracks highest single vote
        /// - Tracks seasons participated
        /// - Awards eligible badges
        /// </summary>
        /// <param name="user">Voter address</param>
        /// <param name="amount">Vote amount</param>
        /// <param name="seasonId">Current season ID</param>
        private static void UpdateUserStats(UInt160 user, BigInteger amount, BigInteger seasonId)
        {
            UserStats stats = GetUserStats(user);

            bool isNewVoter = stats.JoinTime == 0;
            if (isNewVoter)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalVoters = TotalVoters();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTERS, totalVoters + 1);
            }

            stats.TotalVoted += amount;
            stats.VoteCount += 1;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestSingleVote)
            {
                stats.HighestSingleVote = amount;
            }

            BigInteger prevSeasonVotes = GetUserSeasonVotes(user, seasonId);
            if (prevSeasonVotes == 0)
            {
                stats.SeasonsParticipated += 1;
            }

            StoreUserStats(user, stats);
            CheckVoterBadges(user);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_SEASON_VOTES, user),
                (ByteString)seasonId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, prevSeasonVotes + amount);
        }

        /// <summary>
        /// Update user statistics after adding a nominee.
        /// 
        /// EFFECTS:
        /// - Increments nominees added count
        /// - Updates join time for new users
        /// - Awards eligible badges
        /// </summary>
        /// <param name="user">User address who added nominee</param>
        private static void UpdateUserStatsOnNominee(UInt160 user)
        {
            UserStats stats = GetUserStats(user);

            bool isNewVoter = stats.JoinTime == 0;
            if (isNewVoter)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalVoters = TotalVoters();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VOTERS, totalVoters + 1);
            }

            stats.NomineesAdded += 1;
            stats.LastActivityTime = Runtime.Time;

            StoreUserStats(user, stats);
            CheckVoterBadges(user);
        }

        #endregion
    }
}
