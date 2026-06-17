using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGovMerc : SmartContract
    {
        #region Settlement
        /// <summary>
        /// Resolve the live epoch: the top bidder wins, their bid is paid pro-rata to
        /// stakers, and the epoch advances. Permissionless. Reverts if there are no
        /// bids or the bidding window opened by the first bid has not elapsed yet
        /// (MP-D-01: blocks same-block bid+settle sniping).
        /// </summary>
        public static void SettleEpoch()
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger epoch = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);
            BigInteger highBid = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_HIGH_BID, (byte[])(ByteString)epoch));
            ExecutionEngine.Assert(highBid > 0, "no bids to settle");
            BigInteger deadline = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_EPOCH_END, (byte[])(ByteString)epoch));
            ExecutionEngine.Assert(deadline > 0 && Runtime.Time >= deadline, "epoch not ended");
            UInt160 winner = (UInt160)Storage.Get(ctx, Helper.Concat(PREFIX_HIGH_BIDDER, (byte[])(ByteString)epoch));

            // Record the resolved epoch (drives the per-epoch winner check in reclaimBid).
            Storage.Put(ctx, Helper.Concat(PREFIX_SETTLE_WINNER, (byte[])(ByteString)epoch), winner);
            Storage.Put(ctx, Helper.Concat(PREFIX_SETTLE_AMOUNT, (byte[])(ByteString)epoch), highBid);

            // MP-G-02: divide the winning bid only across ELIGIBLE stake — NEO that was
            // present before this epoch's bidding window opened. Stake added once bidding
            // started sits in the pending bucket (excluded here), so it cannot capture
            // this epoch's revenue. The accRewardPerShare math is otherwise unchanged.
            BigInteger eligible = (BigInteger)Storage.Get(ctx, PREFIX_ELIGIBLE_STAKED);
            BigInteger distributed = 0;
            if (eligible > 0)
            {
                BigInteger accRps = (BigInteger)Storage.Get(ctx, PREFIX_ACC_RPS) + highBid * SCALE / eligible;
                Storage.Put(ctx, PREFIX_ACC_RPS, accRps);
                distributed = highBid;
            }
            else
            {
                // No eligible stakers to reward: refund the winner's bid to their credit.
                byte[] wc = Helper.Concat(PREFIX_GAS_CREDIT, (byte[])winner);
                Storage.Put(ctx, wc, (BigInteger)Storage.Get(ctx, wc) + highBid);
            }

            Storage.Put(ctx, PREFIX_EPOCH, epoch + 1);
            OnEpochSettled(epoch, winner, highBid, distributed);
        }

        /// <summary>
        /// A losing bidder reclaims their bid from a settled epoch (the winner's bid was
        /// already spent/refunded at settle). Refunds straight to the bidder's wallet.
        /// </summary>
        public static BigInteger ReclaimBid(UInt160 bidder, BigInteger epoch)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(bidder), "bidder witness required");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger currentEpoch = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);
            ExecutionEngine.Assert(epoch < currentEpoch, "epoch not settled");

            ByteString winner = Storage.Get(ctx, Helper.Concat(PREFIX_SETTLE_WINNER, (byte[])(ByteString)epoch));
            ExecutionEngine.Assert(winner is null || (UInt160)winner != bidder, "winner cannot reclaim");

            byte[] bidKey = Helper.Concat(Helper.Concat(PREFIX_BID, (byte[])(ByteString)epoch), (byte[])bidder);
            BigInteger amount = (BigInteger)Storage.Get(ctx, bidKey);
            ExecutionEngine.Assert(amount > 0, "nothing to reclaim");
            Storage.Delete(ctx, bidKey);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, bidder, amount, "" });
            ExecutionEngine.Assert(ok, "reclaim transfer failed");
            OnBidReclaimed(epoch, bidder, amount);
            return amount;
        }
        #endregion
    }
}
