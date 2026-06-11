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
        #region Events
        [DisplayName("Staked")]
        public static event Action<UInt160, BigInteger, BigInteger> OnStaked; // user, amount, totalStaked
        [DisplayName("Unstaked")]
        public static event Action<UInt160, BigInteger, BigInteger> OnUnstaked; // user, amount, totalStaked
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // user, amount, balance (GAS bid credit)
        [DisplayName("BidPlaced")]
        public static event Action<BigInteger, UInt160, BigInteger> OnBidPlaced; // epoch, bidder, totalBid
        [DisplayName("EpochSettled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger> OnEpochSettled; // epoch, winner, bid, distributed
        [DisplayName("RewardsClaimed")]
        public static event Action<UInt160, BigInteger> OnRewardsClaimed; // staker, amount
        [DisplayName("BidReclaimed")]
        public static event Action<BigInteger, UInt160, BigInteger> OnBidReclaimed; // epoch, bidder, amount
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // user, amount
        [DisplayName("EpochOpened")]
        public static event Action<BigInteger, BigInteger> OnEpochOpened; // epoch, bidding deadline (ms)
        #endregion

        #region Withdraw bid credit
        /// <summary>Reclaim any unused prepaid GAS bid-credit back to the sender.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_GAS_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

        #region Read-only
        [Safe]
        public static BigInteger TotalStaked() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_STAKED);

        [Safe]
        public static BigInteger StakeOf(UInt160 user) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_STAKED, (byte[])user));

        [Safe]
        public static BigInteger CurrentEpoch() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EPOCH);

        [Safe]
        public static BigInteger BidOf(BigInteger epoch, UInt160 bidder) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(Helper.Concat(PREFIX_BID, (byte[])(ByteString)epoch), (byte[])bidder));

        [Safe]
        public static BigInteger HighestBid(BigInteger epoch) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_HIGH_BID, (byte[])(ByteString)epoch));

        [Safe]
        public static UInt160 HighestBidder(BigInteger epoch)
        {
            ByteString v = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_HIGH_BIDDER, (byte[])(ByteString)epoch));
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        [Safe]
        public static UInt160 SettlementWinner(BigInteger epoch)
        {
            ByteString v = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_SETTLE_WINNER, (byte[])(ByteString)epoch));
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        [Safe]
        public static BigInteger SettlementAmount(BigInteger epoch) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_SETTLE_AMOUNT, (byte[])(ByteString)epoch));

        /// <summary>Total claimable GAS rewards for a staker (banked + unrealized).</summary>
        [Safe]
        public static BigInteger PendingRewards(UInt160 user)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger banked = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_PENDING, (byte[])user));
            BigInteger staked = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_STAKED, (byte[])user));
            if (staked <= 0) return banked;
            BigInteger accRps = (BigInteger)Storage.Get(ctx, PREFIX_ACC_RPS);
            BigInteger debt = (BigInteger)Storage.Get(ctx, Helper.Concat(PREFIX_REWARD_DEBT, (byte[])user));
            BigInteger unrealized = staked * accRps / SCALE - debt;
            return banked + (unrealized > 0 ? unrealized : 0);
        }

        [Safe]
        public static BigInteger GasCreditOf(UInt160 user) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_GAS_CREDIT, (byte[])user));

        [Safe]
        public static BigInteger MinBid() => MIN_BID;

        [Safe]
        public static BigInteger MinStake() => MIN_STAKE;

        /// <summary>Bidding window length opened by an epoch's first bid (ms).</summary>
        [Safe]
        public static BigInteger EpochDuration() => EPOCH_DURATION_MS;

        /// <summary>Bidding deadline for an epoch (0 until its first bid lands).</summary>
        [Safe]
        public static BigInteger EpochDeadline(BigInteger epoch) =>
            (BigInteger)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_EPOCH_END, (byte[])(ByteString)epoch));
        #endregion
    }
}
