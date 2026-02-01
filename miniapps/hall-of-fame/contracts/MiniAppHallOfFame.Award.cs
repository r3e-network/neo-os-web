using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Award Badge

        /// <summary>
        /// Award a badge to a voter for achievements.
        /// 
        /// IDEMPOTENT:
        /// - Does nothing if voter already has badge
        /// 
        /// EFFECTS:
        /// - Records badge ownership
        /// - Increments user's badge count
        /// - Emits VoterBadgeEarned event
        /// 
        /// BADGE TYPES:
        /// - 1: First Vote
        /// - 2: 10 Votes Cast
        /// - 3: 100 GAS Voted
        /// - 4: Multi-season participant
        /// </summary>
        /// <param name="voter">Address to award badge</param>
        /// <param name="badgeType">Badge type identifier</param>
        /// <param name="badgeName">Badge display name</param>
        private static void AwardVoterBadge(UInt160 voter, BigInteger badgeType, string badgeName)
        {
            if (HasVoterBadge(voter, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_VOTER_BADGES, voter),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            UserStats stats = GetUserStats(voter);
            stats.BadgeCount += 1;
            StoreUserStats(voter, stats);

            OnVoterBadgeEarned(voter, badgeType, badgeName);
        }

        #endregion
    }
}
