using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Stats Update Methods

        /// <summary>
        /// Update tipper statistics after a tip.
        /// 
        /// EFFECTS:
        /// - Sets join time for new tippers
        /// - Increments total tipped amount
        /// - Increments tip count
        /// - Updates last tip time
        /// - Tracks highest single tip
        /// - Records most recent tipped developer
        /// </summary>
        /// <param name="tipper">Tipper address</param>
        /// <param name="amount">Tip amount</param>
        /// <param name="devId">Developer tipped</param>
        private static void UpdateTipperStats(UInt160 tipper, BigInteger amount, BigInteger devId)
        {
            TipperStats stats = GetTipperStats(tipper);
            if (stats.JoinTime == 0) stats.JoinTime = Runtime.Time;
            stats.TotalTipped += amount;
            stats.TipCount += 1;
            stats.LastTipTime = Runtime.Time;
            if (amount > stats.HighestTip) stats.HighestTip = amount;
            stats.FavoriteDevId = devId;
            StoreTipperStats(tipper, stats);
        }

        /// <summary>
        /// Check and emit milestones when thresholds are crossed.
        /// 
        /// MILESTONES:
        /// - Milestone 1: 1 GAS total received
        /// - Milestone 2: 10 GAS total received
        /// - Milestone 3: 100 GAS total received
        /// </summary>
        /// <param name="devId">Developer ID</param>
        /// <param name="previousTotal">Previous total tips</param>
        /// <param name="newTotal">New total tips</param>
        private static void CheckDevMilestones(BigInteger devId, BigInteger previousTotal, BigInteger newTotal)
        {
            if (previousTotal < MILESTONE_1 && newTotal >= MILESTONE_1)
            {
                OnMilestoneReached(devId, 1, newTotal);
            }
            if (previousTotal < MILESTONE_2 && newTotal >= MILESTONE_2)
            {
                OnMilestoneReached(devId, 2, newTotal);
            }
            if (previousTotal < MILESTONE_3 && newTotal >= MILESTONE_3)
            {
                OnMilestoneReached(devId, 3, newTotal);
            }
        }

        #endregion
    }
}
