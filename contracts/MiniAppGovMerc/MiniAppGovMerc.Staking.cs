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
        #region Staking
        // Has the current epoch's bidding window opened? It opens on the epoch's first
        // bid (PREFIX_EPOCH_END set). Stake added while it is open cannot earn the live
        // epoch's bid — it is parked in the PENDING bucket and activates next epoch.
        private static bool BiddingWindowOpen(StorageContext ctx, BigInteger epoch)
        {
            byte[] endKey = Helper.Concat(PREFIX_EPOCH_END, (byte[])(ByteString)epoch);
            return (BigInteger)Storage.Get(ctx, endKey) != 0;
        }

        private static void StakeInternal(StorageContext ctx, UInt160 user, BigInteger amount)
        {
            ExecutionEngine.Assert(amount >= MIN_STAKE, "stake below minimum");
            // Fold any matured pending stake in first so harvest/debt sees the full
            // eligible balance and the new debt snapshot stays correct.
            ActivatePending(ctx, user);
            Harvest(ctx, user);

            BigInteger epoch = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);
            if (BiddingWindowOpen(ctx, epoch))
            {
                // MP-G-02: the live epoch's bid is already locked in — this stake is
                // ineligible for it. Park it; it becomes eligible from the next epoch.
                // Harvest above banked rewards but does NOT reset the debt, and this
                // branch leaves the eligible balance (PREFIX_STAKED) unchanged, so
                // re-snapshot the debt against that balance — otherwise the next Harvest
                // would re-bank the same rewards (double-count / drain).
                SetRewardDebt(ctx, user, (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_STAKED, (byte[])user)));
                byte[] pKey = Helper.Concat(PREFIX_PENDING_STAKE, (byte[])user);
                BigInteger pending = (BigInteger)Storage.Get(ctx, pKey) + amount;
                Storage.Put(ctx, pKey, pending);
                Storage.Put(ctx, Helper.Concat(PREFIX_PENDING_EPOCH, (byte[])user), epoch + 1);

                BigInteger totalParked = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_STAKED) + amount;
                Storage.Put(ctx, PREFIX_TOTAL_STAKED, totalParked);
                OnStaked(user, amount, totalParked);
                return;
            }

            // Window not open yet: the stake is present before bidding starts, so it is
            // immediately eligible and joins the accumulator divisor right away.
            byte[] sKey = Helper.Concat(PREFIX_STAKED, (byte[])user);
            BigInteger staked = (BigInteger)Storage.Get(ctx, sKey) + amount;
            Storage.Put(ctx, sKey, staked);
            BigInteger eligible = (BigInteger)Storage.Get(ctx, PREFIX_ELIGIBLE_STAKED) + amount;
            Storage.Put(ctx, PREFIX_ELIGIBLE_STAKED, eligible);
            BigInteger total = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_STAKED) + amount;
            Storage.Put(ctx, PREFIX_TOTAL_STAKED, total);
            SetRewardDebt(ctx, user, staked);
            OnStaked(user, amount, total);
        }

        // Move a user's matured pending stake (tagged with an epoch <= the current one)
        // into their eligible balance. Banks earned rewards first so the freshly eligible
        // NEO starts from the live accRewardPerShare (it earns no past distribution).
        private static void ActivatePending(StorageContext ctx, UInt160 user)
        {
            byte[] pKey = Helper.Concat(PREFIX_PENDING_STAKE, (byte[])user);
            BigInteger pending = (BigInteger)Storage.Get(ctx, pKey);
            if (pending <= 0) return;
            byte[] peKey = Helper.Concat(PREFIX_PENDING_EPOCH, (byte[])user);
            BigInteger eligibleFrom = (BigInteger)Storage.Get(ctx, peKey);
            BigInteger epoch = (BigInteger)Storage.Get(ctx, PREFIX_EPOCH);
            if (epoch < eligibleFrom) return;

            Harvest(ctx, user);
            byte[] sKey = Helper.Concat(PREFIX_STAKED, (byte[])user);
            BigInteger staked = (BigInteger)Storage.Get(ctx, sKey) + pending;
            Storage.Put(ctx, sKey, staked);
            BigInteger eligible = (BigInteger)Storage.Get(ctx, PREFIX_ELIGIBLE_STAKED) + pending;
            Storage.Put(ctx, PREFIX_ELIGIBLE_STAKED, eligible);
            Storage.Delete(ctx, pKey);
            Storage.Delete(ctx, peKey);
            SetRewardDebt(ctx, user, staked);
        }

        /// <summary>Withdraw staked NEO. Pending rewards are banked first.</summary>
        public static void WithdrawStake(UInt160 user, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "user witness required");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            ActivatePending(ctx, user);

            byte[] sKey = Helper.Concat(PREFIX_STAKED, (byte[])user);
            BigInteger staked = (BigInteger)Storage.Get(ctx, sKey);
            byte[] pKey = Helper.Concat(PREFIX_PENDING_STAKE, (byte[])user);
            BigInteger pending = (BigInteger)Storage.Get(ctx, pKey);
            ExecutionEngine.Assert(staked + pending >= amount, "insufficient stake");

            // Pull from the still-ineligible pending bucket first (it earns nothing, so
            // there is no reward bookkeeping to unwind), then from eligible stake.
            BigInteger fromPending = amount <= pending ? amount : pending;
            if (fromPending > 0)
            {
                BigInteger remPending = pending - fromPending;
                if (remPending == 0) { Storage.Delete(ctx, pKey); Storage.Delete(ctx, Helper.Concat(PREFIX_PENDING_EPOCH, (byte[])user)); }
                else Storage.Put(ctx, pKey, remPending);
            }

            BigInteger fromEligible = amount - fromPending;
            if (fromEligible > 0)
            {
                Harvest(ctx, user);
                BigInteger remaining = staked - fromEligible;
                if (remaining == 0) Storage.Delete(ctx, sKey); else Storage.Put(ctx, sKey, remaining);
                BigInteger eligible = (BigInteger)Storage.Get(ctx, PREFIX_ELIGIBLE_STAKED) - fromEligible;
                Storage.Put(ctx, PREFIX_ELIGIBLE_STAKED, eligible);
                SetRewardDebt(ctx, user, remaining);
            }

            BigInteger total = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_STAKED) - amount;
            Storage.Put(ctx, PREFIX_TOTAL_STAKED, total);

            bool ok = (bool)Contract.Call(NEO.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, user, amount, "" });
            ExecutionEngine.Assert(ok, "NEO transfer failed");
            OnUnstaked(user, amount, total);
        }
        #endregion
    }
}
