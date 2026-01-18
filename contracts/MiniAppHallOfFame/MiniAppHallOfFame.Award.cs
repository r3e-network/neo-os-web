using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Award Badge

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
