using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetEpochDetails(BigInteger epochId)
        {
            Epoch epoch = GetEpoch(epochId);
            Map<string, object> details = new Map<string, object>();

            details["id"] = epoch.Id;
            details["startTime"] = epoch.StartTime;
            details["endTime"] = epoch.EndTime;
            details["totalBids"] = epoch.TotalBids;
            details["highestBid"] = epoch.HighestBid;
            details["winner"] = epoch.Winner;
            details["votingPower"] = epoch.VotingPower;
            details["settled"] = epoch.Settled;

            if (!epoch.Settled && epoch.EndTime > 0)
            {
                BigInteger remaining = epoch.EndTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
            }

            return details;
        }

        [Safe]
        public static Map<string, object> GetCurrentEpochDetails()
        {
            return GetEpochDetails(GetCurrentEpochId());
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalPool"] = TotalPool();
            stats["currentEpoch"] = GetCurrentEpochId();
            stats["totalDistributed"] = TotalDistributed();
            stats["totalDepositors"] = TotalDepositors();
            stats["totalBidders"] = TotalBidders();

            // Configuration info
            stats["epochDurationSeconds"] = EPOCH_DURATION_SECONDS;
            stats["minDeposit"] = MIN_DEPOSIT;
            stats["minBid"] = MIN_BID;
            stats["platformFeeBps"] = PLATFORM_FEE_BPS;

            // Current epoch info
            BigInteger currentEpochId = GetCurrentEpochId();
            if (currentEpochId > 0)
            {
                Epoch currentEpoch = GetEpoch(currentEpochId);
                stats["currentEpochTotalBids"] = currentEpoch.TotalBids;
                stats["currentEpochHighestBid"] = currentEpoch.HighestBid;
                stats["currentEpochWinner"] = currentEpoch.Winner;
                stats["currentEpochSettled"] = currentEpoch.Settled;
                if (!currentEpoch.Settled && currentEpoch.EndTime > 0)
                {
                    BigInteger remaining = currentEpoch.EndTime - Runtime.Time;
                    stats["currentEpochRemainingTime"] = remaining > 0 ? remaining : 0;
                }
            }

            return stats;
        }

        #endregion
    }
}
