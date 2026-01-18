using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppMasqueradeDAO
    {
        #region Internal Helpers

        private static void StoreMask(BigInteger maskId, MaskData mask)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MASKS, (ByteString)maskId.ToByteArray()),
                StdLib.Serialize(mask));
        }

        private static void StoreProposal(BigInteger proposalId, ProposalData proposal)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_PROPOSALS, (ByteString)proposalId.ToByteArray()),
                StdLib.Serialize(proposal));
        }

        private static ByteString GetVoteKey(BigInteger proposalId, BigInteger maskId)
        {
            return Helper.Concat(
                Helper.Concat((ByteString)PREFIX_VOTES, (ByteString)proposalId.ToByteArray()),
                (ByteString)maskId.ToByteArray());
        }

        private static void AddUserMask(UInt160 user, BigInteger maskId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_MASK_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_MASKS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, maskId);
        }

        private static BigInteger GetVotingPowerForType(BigInteger maskType)
        {
            if (maskType == 1) return 1;  // Basic
            if (maskType == 2) return 3;  // Premium
            if (maskType == 3) return 5;  // Founder
            return 1;
        }

        /// <summary>
        /// [DEPRECATED] O(n) delegation search - use GetCachedDelegatedPower instead.
        /// VoteWithCalculation uses cached power for O(1) lookup.
        /// </summary>
        private static BigInteger GetEffectiveVotingPower(BigInteger maskId)
        {
            MaskData mask = GetMask(maskId);
            BigInteger basePower = mask.VotingPower;

            BigInteger totalMasks = TotalMasks();
            BigInteger delegatedPower = 0;

            for (BigInteger i = 1; i <= totalMasks && i <= 100; i++)
            {
                if (i == maskId) continue;
                BigInteger delegatedTo = GetDelegation(i);
                if (delegatedTo == maskId)
                {
                    MaskData delegator = GetMask(i);
                    if (delegator.Active)
                    {
                        delegatedPower += delegator.VotingPower;
                    }
                }
            }

            return basePower + delegatedPower;
        }

        private static void StoreMemberStats(UInt160 member, MemberStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMBER_STATS, member),
                StdLib.Serialize(stats));
        }

        private static void UpdateMemberStatsOnMaskCreate(UInt160 member, BigInteger maskType)
        {
            MemberStats stats = GetMemberStats(member);

            bool isNewMember = stats.JoinTime == 0;
            if (isNewMember)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalMembers = TotalMembers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MEMBERS, totalMembers + 1);
            }

            stats.MasksCreated += 1;
            stats.ActiveMasks += 1;
            stats.LastActivityTime = Runtime.Time;

            if (maskType == 2)
            {
                stats.PremiumMasks += 1;
            }

            StoreMemberStats(member, stats);
            CheckMemberBadges(member);
        }

        private static void UpdateMemberStatsOnProposalCreate(UInt160 member, BigInteger newReputation)
        {
            MemberStats stats = GetMemberStats(member);
            stats.ProposalsCreated += 1;
            stats.TotalReputation += 5;
            stats.LastActivityTime = Runtime.Time;

            if (newReputation > stats.HighestReputation)
            {
                stats.HighestReputation = newReputation;
            }

            StoreMemberStats(member, stats);
            CheckMemberBadges(member);
        }

        private static void UpdateMemberStatsOnVote(UInt160 member, BigInteger newReputation)
        {
            MemberStats stats = GetMemberStats(member);
            stats.TotalVotes += 1;
            stats.TotalReputation += 1;
            stats.LastActivityTime = Runtime.Time;

            if (newReputation > stats.HighestReputation)
            {
                stats.HighestReputation = newReputation;
            }

            StoreMemberStats(member, stats);
            CheckMemberBadges(member);
        }

        private static void UpdateMemberStatsOnDelegation(UInt160 member, bool isDelegating)
        {
            MemberStats stats = GetMemberStats(member);
            if (isDelegating)
            {
                stats.DelegationsGiven += 1;
            }
            stats.LastActivityTime = Runtime.Time;
            StoreMemberStats(member, stats);
        }

        private static void UpdateMemberStatsOnProposalPassed(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);
            stats.ProposalsPassed += 1;
            stats.LastActivityTime = Runtime.Time;
            StoreMemberStats(member, stats);
            CheckMemberBadges(member);
        }

        private static void UpdateMemberStatsOnMaskDeactivate(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);
            stats.ActiveMasks -= 1;
            stats.LastActivityTime = Runtime.Time;
            StoreMemberStats(member, stats);
        }

        #region Badge Logic

        private static void CheckMemberBadges(UInt160 member)
        {
            MemberStats stats = GetMemberStats(member);

            if (stats.MasksCreated >= 1)
                AwardMemberBadge(member, 1, "First Mask");

            if (stats.TotalVotes >= 10)
                AwardMemberBadge(member, 2, "Active Voter");

            if (stats.ProposalsCreated >= 3)
                AwardMemberBadge(member, 3, "Proposer");

            if (stats.TotalReputation >= 50)
                AwardMemberBadge(member, 4, "Influencer");

            if (stats.PremiumMasks >= 3)
                AwardMemberBadge(member, 5, "Premium Member");

            if (stats.ProposalsPassed >= 3)
                AwardMemberBadge(member, 6, "Successful Proposer");
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

        #endregion

        #region Automation
        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
