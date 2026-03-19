using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Bid Methods

        /// <summary>
        /// Place a bid for the current epoch's voting power.
        /// </summary>
        public static void PlaceBid(UInt160 candidate, BigInteger bidAmount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(bidAmount >= MIN_BID, "min 0.1 GAS bid");

            ValidateUserOrAbstractAccount(candidate);

            ConsumeDirectGasCredit(candidate, bidAmount);

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

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            if (from == null || !from.IsValid || from == Runtime.ExecutingScriptHash || amount <= 0) return;

            if (Runtime.CallingScriptHash == GAS.Hash)
            {
                StorageMap gasCredits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT);
                ByteString gasKey = (ByteString)(byte[])from;
                ByteString existing = gasCredits.Get(gasKey);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                gasCredits.Put(gasKey, balance + amount);
                return;
            }
            if (Runtime.CallingScriptHash == NEO.Hash)
            {
                StorageMap credits = new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_ASSET_CREDIT);
                ByteString key = (ByteString)Helper.Concat((ByteString)(byte[])NEO.Hash, (ByteString)(byte[])from);
                ByteString existing = credits.Get(key);
                BigInteger balance = existing == null ? 0 : (BigInteger)existing;
                credits.Put(key, balance + amount);
                return;
            }

            ExecutionEngine.Assert(false, "unsupported asset");
        }

        #endregion
    }
}
