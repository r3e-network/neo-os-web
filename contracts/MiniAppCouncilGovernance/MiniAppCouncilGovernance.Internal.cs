using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCouncilGovernance
    {
        #region Helper Methods
        private static ByteString GetProposalKey(BigInteger proposalId)
        {
            return Helper.Concat((ByteString)PREFIX_PROPOSAL, (ByteString)proposalId.ToByteArray());
        }

        private static ByteString GetVoteKey(BigInteger proposalId, UInt160 voter)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTE, (ByteString)proposalId.ToByteArray()),
                (ByteString)(byte[])voter);
        }

        private static ByteString GetSignatureKey(BigInteger proposalId, UInt160 signer)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_SIGNATURE, (ByteString)proposalId.ToByteArray()),
                (ByteString)(byte[])signer);
        }
        #endregion

        #region Internal Helpers

        private static void StoreMemberStats(UInt160 member, MemberStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMBER_STATS, member),
                StdLib.Serialize(stats));
        }

        private static void UpdateMemberStatsOnProposal(UInt160 creator)
        {
            MemberStats stats = GetMemberStats(creator);

            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalMembers = GetTotalMembers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS, totalMembers + 1);
            }

            stats.ProposalsCreated += 1;
            stats.LastActivityTime = Runtime.Time;

            StoreMemberStats(creator, stats);
            CheckMemberBadges(creator);
        }

        private static void UpdateMemberStatsOnVote(UInt160 voter, bool support)
        {
            MemberStats stats = GetMemberStats(voter);

            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalMembers = GetTotalMembers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS, totalMembers + 1);
            }

            stats.VotesCast += 1;
            stats.LastActivityTime = Runtime.Time;

            if (support)
            {
                stats.YesVotesCast += 1;
            }
            else
            {
                stats.NoVotesCast += 1;
            }

            StoreMemberStats(voter, stats);
            CheckMemberBadges(voter);
        }

        private static void UpdateCreatorYesVotes(UInt160 creator)
        {
            MemberStats stats = GetMemberStats(creator);
            stats.YesVotesReceived += 1;
            StoreMemberStats(creator, stats);
            CheckMemberBadges(creator);
        }

        private static void UpdateCreatorStatsOnFinalize(UInt160 creator, byte status)
        {
            MemberStats stats = GetMemberStats(creator);

            if (status == STATUS_PASSED)
            {
                stats.ProposalsPassed += 1;
            }
            else if (status == STATUS_REJECTED || status == STATUS_EXPIRED)
            {
                stats.ProposalsRejected += 1;
            }

            StoreMemberStats(creator, stats);
            CheckMemberBadges(creator);
        }
        #endregion

        #region Badge Logic

        private static void CheckMemberBadges(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);

            if (stats.ProposalsCreated >= 1)
                AwardMemberBadge(member, 1, "First Proposal");

            if (stats.VotesCast >= 10)
                AwardMemberBadge(member, 2, "Active Voter");

            if (stats.ProposalsPassed >= 5)
                AwardMemberBadge(member, 3, "Proposal Champion");

            if (stats.YesVotesReceived >= 10)
                AwardMemberBadge(member, 4, "Consensus Builder");

            if (stats.VotesCast >= 50)
                AwardMemberBadge(member, 5, "Veteran");
        }

        private static void AwardMemberBadge(UInt160 member, BigInteger badgeType, string badgeName)
        {
            if (HasMemberBadge(member, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_MEMBER_BADGES, member),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            MemberStats stats = GetMemberStats(member);
            stats.BadgeCount += 1;
            StoreMemberStats(member, stats);

            OnMemberBadgeEarned(member, badgeType, badgeName);
        }
        #endregion

        #region NEP-17 Receiver
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Accept GAS deposits
        }
        #endregion
    }
}
