using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get raw deposit data without calculations.
        /// Frontend calculates: poolShare = amount * 10000 / totalPool
        /// </summary>
        [Safe]
        public static Map<string, object> GetDepositRaw(UInt160 depositor)
        {
            Deposit deposit = GetDeposit(depositor);
            Map<string, object> data = new Map<string, object>();

            data["amount"] = deposit.Amount;
            data["depositTime"] = deposit.DepositTime;
            data["lastClaimEpoch"] = deposit.LastClaimEpoch;
            data["totalPool"] = TotalPool();
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Get current epoch state for frontend.
        /// </summary>
        [Safe]
        public static Map<string, object> GetEpochRaw(BigInteger epochId)
        {
            Epoch epoch = GetEpoch(epochId);
            Map<string, object> data = new Map<string, object>();

            data["id"] = epoch.Id;
            data["startTime"] = epoch.StartTime;
            data["endTime"] = epoch.EndTime;
            data["totalBids"] = epoch.TotalBids;
            data["highestBid"] = epoch.HighestBid;
            data["winner"] = epoch.Winner;
            data["votingPower"] = epoch.VotingPower;
            data["settled"] = epoch.Settled;
            data["currentTime"] = Runtime.Time;

            return data;
        }

        /// <summary>
        /// Get governance constants for frontend.
        /// </summary>
        [Safe]
        public static Map<string, object> GetGovMercConstants()
        {
            Map<string, object> constants = new Map<string, object>();
            constants["epochDurationSeconds"] = EPOCH_DURATION_SECONDS;
            constants["minDeposit"] = MIN_DEPOSIT;
            constants["minBid"] = MIN_BID;
            constants["platformFeeBps"] = PLATFORM_FEE_BPS;
            constants["currentEpoch"] = GetCurrentEpochId();
            constants["currentTime"] = Runtime.Time;
            return constants;
        }

        #endregion
    }
}
