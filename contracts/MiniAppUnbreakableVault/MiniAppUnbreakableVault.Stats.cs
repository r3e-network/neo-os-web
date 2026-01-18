using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppUnbreakableVault
    {
        #region Stats Storage

        private static void StoreHackerStats(UInt160 hacker, HackerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HACKER_STATS, hacker),
                StdLib.Serialize(stats));
        }

        private static void StoreCreatorStats(UInt160 creator, CreatorStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CREATOR_STATS, creator),
                StdLib.Serialize(stats));
        }

        #endregion

        #region Hacker Stats Updates

        private static void UpdateHackerStatsOnBreak(UInt160 hacker, BigInteger reward, BigInteger difficulty, bool isNew)
        {
            HackerStats stats = GetHackerStats(hacker);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalHackers = TotalHackers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HACKERS, totalHackers + 1);
            }

            stats.VaultsBroken += 1;
            stats.TotalEarned += reward;
            stats.TotalAttempts += 1;
            stats.LastActivityTime = Runtime.Time;

            if (reward > stats.HighestBounty) stats.HighestBounty = reward;

            if (difficulty == 1) stats.EasyBroken += 1;
            else if (difficulty == 2) stats.MediumBroken += 1;
            else stats.HardBroken += 1;

            StoreHackerStats(hacker, stats);
            CheckHackerBadges(hacker);

            OnLeaderboardUpdated(hacker, stats.VaultsBroken, stats.TotalEarned);
        }

        private static void UpdateHackerStatsOnAttempt(UInt160 hacker, bool isNew)
        {
            HackerStats stats = GetHackerStats(hacker);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalHackers = TotalHackers();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_HACKERS, totalHackers + 1);
            }

            stats.TotalAttempts += 1;
            stats.LastActivityTime = Runtime.Time;

            StoreHackerStats(hacker, stats);
        }

        #endregion

        #region Creator Stats Updates

        private static void UpdateCreatorStatsOnCreate(UInt160 creator, BigInteger bounty, bool isNew)
        {
            CreatorStats stats = GetCreatorStats(creator);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalCreators = TotalCreators();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CREATORS, totalCreators + 1);
            }

            stats.VaultsCreated += 1;
            stats.TotalBountiesPosted += bounty;
            stats.LastActivityTime = Runtime.Time;

            if (bounty > stats.HighestBounty) stats.HighestBounty = bounty;

            StoreCreatorStats(creator, stats);
            CheckCreatorBadges(creator);
        }

        private static void UpdateCreatorStatsOnBroken(UInt160 creator, BigInteger bountyLost)
        {
            CreatorStats stats = GetCreatorStats(creator);
            stats.VaultsBroken += 1;
            stats.TotalBountiesLost += bountyLost;
            stats.LastActivityTime = Runtime.Time;
            StoreCreatorStats(creator, stats);
        }

        private static void UpdateCreatorStatsOnExpired(UInt160 creator, BigInteger refund)
        {
            CreatorStats stats = GetCreatorStats(creator);
            stats.VaultsExpired += 1;
            stats.TotalRefunded += refund;
            stats.LastActivityTime = Runtime.Time;
            StoreCreatorStats(creator, stats);
            CheckCreatorBadges(creator);
        }

        #endregion
    }
}
