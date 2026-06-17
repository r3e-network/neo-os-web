using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin : SmartContract
    {
        #region Owner-only configuration / treasury
        /// <summary>Tune the check-in fee and milestone rewards (base units).</summary>
        public static void SetRewardConfig(BigInteger checkInFee, BigInteger weekReward, BigInteger twoWeekReward)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(checkInFee >= 0, "fee must be >= 0");
            ExecutionEngine.Assert(weekReward >= 0, "weekReward must be >= 0");
            ExecutionEngine.Assert(twoWeekReward >= 0, "twoWeekReward must be >= 0");
            StorageContext ctx = Storage.CurrentContext;
            Storage.Put(ctx, PREFIX_FEE, checkInFee);
            Storage.Put(ctx, PREFIX_WEEK_REWARD, weekReward);
            Storage.Put(ctx, PREFIX_TWO_WEEK_REWARD, twoWeekReward);
            OnRewardConfigUpdated(checkInFee, weekReward, twoWeekReward);
        }

        /// <summary>Pause / unpause check-ins and claims.</summary>
        public static void SetPaused(bool paused)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            StorageContext ctx = Storage.CurrentContext;
            Storage.Put(ctx, PREFIX_PAUSED, paused ? 1 : 0);
            OnPausedChanged(paused);
        }

        /// <summary>
        /// Withdraw owner revenue — only the portion of the reward-backing pool that
        /// EXCEEDS the protected obligation (the sum of every user's accrued-but-
        /// unclaimed reward). An accrued reward is therefore always claimable; the
        /// owner can only sweep surplus fees / over-funding.
        /// </summary>
        public static void WithdrawRevenue(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            BigInteger obligation = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_UNCLAIMED);
            BigInteger withdrawable = pool - obligation;
            if (withdrawable < 0) withdrawable = 0;
            ExecutionEngine.Assert(amount <= withdrawable, "amount exceeds withdrawable revenue");
            Storage.Put(ctx, PREFIX_POOL, pool - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "revenue transfer failed");
            OnRevenueWithdrawn(to, amount);
        }

        /// <summary>Owner-gated instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Internal helpers
        private static UserState LoadUser(StorageContext ctx, UInt160 user)
        {
            ByteString raw = Storage.Get(ctx, UserKey(user));
            if (raw is null)
                return new UserState
                {
                    CurrentStreak = 0, HighestStreak = 0, LastCheckinDay = 0,
                    Unclaimed = 0, Claimed = 0, TotalCheckins = 0,
                };
            return (UserState)StdLib.Deserialize(raw);
        }

        private static byte[] UserKey(UInt160 user) => Helper.Concat(PREFIX_USER, (byte[])user);

        /// <summary>Contract-clock UTC day = Runtime.Time(ms) / 86_400_000.</summary>
        private static BigInteger CurrentUtcDay() => (BigInteger)Runtime.Time / MS_PER_DAY;

        /// <summary>The configured check-in fee, defaulting when unset.</summary>
        private static BigInteger FeeValue(StorageContext ctx)
        {
            ByteString raw = Storage.Get(ctx, PREFIX_FEE);
            return raw is null ? DEFAULT_CHECKIN_FEE : (BigInteger)raw;
        }

        private static BigInteger WeekRewardValue(StorageContext ctx)
        {
            ByteString raw = Storage.Get(ctx, PREFIX_WEEK_REWARD);
            return raw is null ? DEFAULT_WEEK_REWARD : (BigInteger)raw;
        }

        private static BigInteger TwoWeekRewardValue(StorageContext ctx)
        {
            ByteString raw = Storage.Get(ctx, PREFIX_TWO_WEEK_REWARD);
            return raw is null ? DEFAULT_TWO_WEEK_REWARD : (BigInteger)raw;
        }

        /// <summary>Reward accrued when a streak HITS day 7 or day 14; else 0.</summary>
        private static BigInteger MilestoneReward(StorageContext ctx, BigInteger streak)
        {
            if (streak == WEEK_DAY) return WeekRewardValue(ctx);
            if (streak == TWO_WEEK_DAY) return TwoWeekRewardValue(ctx);
            return 0;
        }
        #endregion
    }
}
