using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc
    {
        #region Bid Methods

        /// <summary>
        /// Place a bid for the current epoch's voting power.
        /// </summary>
        public static void PlaceBid(UInt160 candidate, BigInteger bidAmount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(bidAmount >= MIN_BID, "min 0.1 GAS bid");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(candidate), "unauthorized");

            ValidatePaymentReceipt(APP_ID, candidate, bidAmount, receiptId);

            BigInteger epochId = GetCurrentEpochId();
            Epoch epoch = GetEpoch(epochId);
            ExecutionEngine.Assert(!epoch.Settled, "epoch already settled");
            ExecutionEngine.Assert(Runtime.Time < epoch.EndTime, "epoch ended");

            BigInteger currentBid = GetUserBid(epochId, candidate);
            BigInteger newBid = currentBid + bidAmount;
            bool isFirstBidInEpoch = currentBid == 0;

            byte[] bidKey = Helper.Concat(
                Helper.Concat(PREFIX_EPOCH_BIDS, (ByteString)epochId.ToByteArray()),
                candidate);
            Storage.Put(Storage.CurrentContext, bidKey, newBid);

            epoch.TotalBids += bidAmount;
            if (newBid > epoch.HighestBid)
            {
                epoch.HighestBid = newBid;
                epoch.Winner = candidate;
            }
            StoreEpoch(epochId, epoch);

            UpdateBidderStatsOnBid(candidate, bidAmount, isFirstBidInEpoch);

            OnBidPlaced(epochId, candidate, newBid);
        }

        #endregion
    }
}
