using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Stats Update Methods

        private static void UpdateDepositorStatsOnDeposit(UInt160 depositor, BigInteger amount, bool isNew)
        {
            DepositorStats stats = GetDepositorStats(depositor);

            if (isNew)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalDepositors = TotalDepositors();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DEPOSITORS, totalDepositors + 1);
            }

            stats.TotalDeposited += amount;
            stats.LastActivityTime = Runtime.Time;
            stats.EpochsParticipated += 1;

            if (amount > stats.HighestDeposit)
            {
                stats.HighestDeposit = amount;
            }

            StoreDepositorStats(depositor, stats);
            CheckDepositorBadges(depositor);
        }

        private static void UpdateDepositorStatsOnWithdraw(UInt160 depositor, BigInteger amount, BigInteger rewards)
        {
            DepositorStats stats = GetDepositorStats(depositor);
            stats.TotalWithdrawn += amount;
            stats.TotalRewardsClaimed += rewards;
            stats.LastActivityTime = Runtime.Time;
            StoreDepositorStats(depositor, stats);
        }

        private static void UpdateBidderStatsOnBid(UInt160 bidder, BigInteger amount, bool isFirstBid)
        {
            DepositorStats stats = GetDepositorStats(bidder);

            if (stats.JoinTime == 0)
            {
                stats.JoinTime = Runtime.Time;
            }

            if (isFirstBid && stats.BidsPlaced == 0)
            {
                BigInteger totalBidders = TotalBidders();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BIDDERS, totalBidders + 1);
            }

            stats.BidsPlaced += 1;
            stats.TotalBidAmount += amount;
            stats.LastActivityTime = Runtime.Time;

            StoreDepositorStats(bidder, stats);
            CheckDepositorBadges(bidder);
        }

        #endregion
    }
}
