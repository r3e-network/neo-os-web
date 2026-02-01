using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Epoch Settlement

        /// <summary>
        /// Settle the current epoch and start a new one.
        /// </summary>
        public static void SettleEpoch()
        {
            ValidateNotGloballyPaused(APP_ID);

            BigInteger epochId = GetCurrentEpochId();
            Epoch epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(!epoch.Settled, "already settled");
            ExecutionEngine.Assert(Runtime.Time >= epoch.EndTime, "epoch not ended");

            BigInteger totalPool = TotalPool();
            epoch.VotingPower = totalPool;
            epoch.Settled = true;
            StoreEpoch(epochId, epoch);

            if (epoch.TotalBids > 0 && totalPool > 0)
            {
                BigInteger platformFee = epoch.TotalBids * PLATFORM_FEE_BPS / 10000;
                BigInteger distributable = epoch.TotalBids - platformFee;

                BigInteger totalDistributed = TotalDistributed();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DISTRIBUTED, totalDistributed + distributable);
            }

            OnEpochSettled(epochId, epoch.Winner, epoch.TotalBids);

            if (epoch.Winner != UInt160.Zero)
            {
                OnDelegationActive(epochId, epoch.Winner, epoch.VotingPower);
            }

            BigInteger newEpochId = epochId + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CURRENT_EPOCH, newEpochId);

            Epoch newEpoch = new Epoch
            {
                Id = newEpochId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + EPOCH_DURATION_SECONDS,
                TotalBids = 0,
                HighestBid = 0,
                Winner = UInt160.Zero,
                VotingPower = 0,
                Settled = false
            };
            StoreEpoch(newEpochId, newEpoch);

            OnEpochStarted(newEpochId, newEpoch.StartTime, newEpoch.EndTime);
        }

        #endregion
    }
}
