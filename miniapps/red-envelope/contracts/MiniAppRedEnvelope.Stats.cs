using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppRedEnvelope
    {
        #region Stats Update Methods

        private static void UpdateCreatorStats(UInt160 creator, BigInteger amount, bool isNew)
        {
            UserStats stats = GetUserStats(creator);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }

            stats.EnvelopesCreated += 1;
            stats.TotalSent += amount;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestEnvelopeCreated)
            {
                stats.HighestEnvelopeCreated = amount;
            }

            StoreUserStats(creator, stats);
            CheckUserBadges(creator, stats);
        }

        private static void UpdateClaimerStats(UInt160 claimer, BigInteger amount, bool isNew)
        {
            UserStats stats = GetUserStats(claimer);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                IncrementTotalUsers();
            }

            stats.EnvelopesClaimed += 1;
            stats.TotalReceived += amount;
            stats.LastActivityTime = Runtime.Time;

            if (amount > stats.HighestSingleClaim)
            {
                stats.HighestSingleClaim = amount;
            }

            StoreUserStats(claimer, stats);
            CheckUserBadges(claimer, stats);
        }

        private static void UpdateBestLuckWinner(UInt160 winner, BigInteger envelopeId)
        {
            UserStats stats = GetUserStats(winner);
            stats.BestLuckWins += 1;
            StoreUserStats(winner, stats);
            CheckUserBadges(winner, stats);
        }

        #endregion
    }
}
