using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Query Methods

        [Safe]
        public static Map<string, object> GetDepositorDetails(UInt160 depositor)
        {
            Deposit deposit = GetDeposit(depositor);
            DepositorStats stats = GetDepositorStats(depositor);
            Map<string, object> details = new Map<string, object>();

            details["depositor"] = depositor;
            details["amount"] = deposit.Amount;
            details["depositTime"] = deposit.DepositTime;
            details["lastClaimEpoch"] = deposit.LastClaimEpoch;
            details["pendingRewards"] = GetPendingRewards(depositor);

            details["totalDeposited"] = stats.TotalDeposited;
            details["totalWithdrawn"] = stats.TotalWithdrawn;
            details["totalRewardsClaimed"] = stats.TotalRewardsClaimed;
            details["epochsParticipated"] = stats.EpochsParticipated;
            details["highestDeposit"] = stats.HighestDeposit;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["bidsPlaced"] = stats.BidsPlaced;
            details["bidsWon"] = stats.BidsWon;
            details["totalBidAmount"] = stats.TotalBidAmount;

            BigInteger totalPool = TotalPool();
            if (totalPool > 0 && deposit.Amount > 0)
            {
                details["poolShare"] = deposit.Amount * 10000 / totalPool;
            }

            details["hasFirstDeposit"] = HasDepositorBadge(depositor, 1);
            details["hasLoyalDepositor"] = HasDepositorBadge(depositor, 2);
            details["hasWhaleDepositor"] = HasDepositorBadge(depositor, 3);
            details["hasActiveBidder"] = HasDepositorBadge(depositor, 4);
            details["hasWinningBidder"] = HasDepositorBadge(depositor, 5);
            details["hasVeteran"] = HasDepositorBadge(depositor, 6);

            return details;
        }

        #endregion
    }
}
