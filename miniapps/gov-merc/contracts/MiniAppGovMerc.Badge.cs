using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Badge Logic

        /// <summary>
        /// Check and award depositor badges based on achievements.
        /// Badges: 1=FirstDeposit, 2=LoyalDepositor(5 epochs), 3=WhaleDepositor(100 NEO),
        ///         4=ActiveBidder(10 bids), 5=WinningBidder(1 win), 6=Veteran(10 GAS rewards)
        /// </summary>
        private static void CheckDepositorBadges(UInt160 depositor)
        {
            DepositorStats stats = GetDepositorStats(depositor);

            // Badge 1: First Deposit
            if (stats.TotalDeposited >= MIN_DEPOSIT)
            {
                AwardDepositorBadge(depositor, 1, "First Deposit");
            }

            // Badge 2: Loyal Depositor (5 epochs participated)
            if (stats.EpochsParticipated >= 5)
            {
                AwardDepositorBadge(depositor, 2, "Loyal Depositor");
            }

            // Badge 3: Whale Depositor (100+ NEO highest deposit)
            if (stats.HighestDeposit >= 10000000000) // 100 NEO
            {
                AwardDepositorBadge(depositor, 3, "Whale Depositor");
            }

            // Badge 4: Active Bidder (10+ bids placed)
            if (stats.BidsPlaced >= 10)
            {
                AwardDepositorBadge(depositor, 4, "Active Bidder");
            }

            // Badge 5: Winning Bidder (1+ bids won)
            if (stats.BidsWon >= 1)
            {
                AwardDepositorBadge(depositor, 5, "Winning Bidder");
            }

            // Badge 6: Veteran (10+ GAS in rewards claimed)
            if (stats.TotalRewardsClaimed >= 1000000000) // 10 GAS
            {
                AwardDepositorBadge(depositor, 6, "Veteran");
            }
        }

        private static void AwardDepositorBadge(UInt160 depositor, BigInteger badgeType, string badgeName)
        {
            if (HasDepositorBadge(depositor, badgeType)) return;

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_DEPOSITOR_BADGES, depositor),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            DepositorStats stats = GetDepositorStats(depositor);
            stats.BadgeCount += 1;
            StoreDepositorStats(depositor, stats);

            OnDepositorBadgeEarned(depositor, badgeType, badgeName);
        }

        #endregion

        #region Automation

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");

            // Auto-settle epoch if ended
            BigInteger epochId = GetCurrentEpochId();
            Epoch epoch = GetEpoch(epochId);
            if (!epoch.Settled && Runtime.Time >= epoch.EndTime)
            {
                SettleEpoch();
            }
        }

        #endregion
    }
}
