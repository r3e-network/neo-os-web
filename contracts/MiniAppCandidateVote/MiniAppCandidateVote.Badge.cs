using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCandidateVote
    {
        #region Badge Logic

        /// <summary>
        /// Check and award voter badges based on achievements.
        /// Badges: 1=FirstVote, 2=Consistent(5 epochs), 3=Whale(1000 NEO), 4=Veteran(20 epochs),
        ///         5=LoyalVoter(10 GAS rewards), 6=TopContributor(5000 NEO total)
        /// </summary>
        private static void CheckVoterBadges(UInt160 voter)
        {
            VoterStats stats = GetVoterStats(voter);

            // Badge 1: First Vote
            if (stats.EpochsParticipated >= 1)
            {
                AwardVoterBadge(voter, 1, "First Vote");
            }

            // Badge 2: Consistent Voter (5 epochs participated)
            if (stats.EpochsParticipated >= 5)
            {
                AwardVoterBadge(voter, 2, "Consistent Voter");
            }

            // Badge 3: Whale (1000+ NEO in single vote)
            if (stats.HighestVote >= 100000000000) // 1000 NEO
            {
                AwardVoterBadge(voter, 3, "Whale");
            }

            // Badge 4: Veteran (20 epochs participated)
            if (stats.EpochsParticipated >= 20)
            {
                AwardVoterBadge(voter, 4, "Veteran");
            }

            // Badge 5: Loyal Voter (10+ GAS in rewards claimed)
            if (stats.TotalRewardsClaimed >= 1000000000) // 10 GAS
            {
                AwardVoterBadge(voter, 5, "Loyal Voter");
            }

            // Badge 6: Top Contributor (5000+ NEO total voted)
            if (stats.TotalVoted >= 500000000000) // 5000 NEO
            {
                AwardVoterBadge(voter, 6, "Top Contributor");
            }
        }

        private static void AwardVoterBadge(UInt160 voter, BigInteger badgeType, string badgeName)
        {
            if (HasVoterBadge(voter, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VOTER_BADGES, voter),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            VoterStats stats = GetVoterStats(voter);
            stats.BadgeCount += 1;
            StoreVoterStats(voter, stats);

            OnVoterBadgeEarned(voter, badgeType, badgeName);
        }

        #endregion
    }
}
