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
    /// <summary>
    /// MiniAppDailyCheckin — self-contained on-chain daily check-in + streak rewards.
    ///
    /// WHY: the previously deployed daily-checkin contract (testnet
    /// 0xaba84da2…, mainnet 0xbd4f3646…) is owned by an unknown key we do not
    /// control, its OnNEP17Payment rejects any memo other than the check-in memo,
    /// and it exposes NO fund / setRewardConfig method — so its milestone reward
    /// pool can never be funded or tuned and a streak reward can never actually be
    /// paid. This replacement is owned by NR3E4D8N so we control funding + tuning.
    ///
    /// MODEL: a user checks in once per UTC day by sending a GAS transfer carrying
    /// the memo "miniapp-dailycheckin:checkin" (the check-in fee). OnNEP17Payment
    /// records the check-in: it advances the consecutive-day streak (resets to 1 if
    /// a UTC day was missed), increments counters, accrues the check-in fee into the
    /// reward pool, and accrues a SMALL milestone reward to the user's unclaimed
    /// balance when the streak reaches day 7 (weekReward) or day 14 (twoWeekReward).
    /// The pool is also fundable by the owner via memo "miniapp-dailycheckin:fund".
    ///
    /// CLAIM: claimRewards(user) pays the user's accrued unclaimed balance out of the
    /// contract's own GAS pool, in a direct (non-deposit) call gated by the user's
    /// witness. It is REVERTED with a clear message if the pool cannot cover it, so
    /// the reward promise is only honoured when actually funded.
    ///
    /// UTC DAY: currentUtcDay = Runtime.Time(ms) / 86_400_000. canCheckin is
    /// lastCheckinDay < currentUtcDay. Day is the contract's own unit (consistent
    /// across reads); the frontend never compares it to a JS calendar day.
    ///
    /// SAFETY: GAS only, BASE UNITS (1 GAS = 1e8). OnNEP17Payment is CREDIT-ONLY —
    /// it validates the memo/caller (may revert) and mutates streak/counters/pool
    /// state, but performs NO token transfer. All transfers (claimRewards,
    /// withdrawRevenue) live in direct methods. Owner is hardcoded via [InitialValue].
    /// </summary>
    [DisplayName("MiniAppDailyCheckin")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained daily check-in: UTC-day streak with small milestone GAS rewards paid from an owner-fundable pool — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppDailyCheckin : SmartContract
    {
        #region Constants (base units / time)
        private const long MS_PER_DAY = 86_400_000;
        private const string CHECKIN_MEMO = "miniapp-dailycheckin:checkin";
        private const string FUND_MEMO = "miniapp-dailycheckin:fund";

        // Streak milestone days that accrue a reward.
        private const int WEEK_DAY = 7;
        private const int TWO_WEEK_DAY = 14;

        // Defaults (tunable by the owner via SetRewardConfig). Kept SMALL so a
        // modest pool sustains many users: 0.001 GAS fee, 0.01 / 0.02 GAS rewards.
        private const long DEFAULT_CHECKIN_FEE = 100_000;       // 0.001 GAS
        private const long DEFAULT_WEEK_REWARD = 1_000_000;     // 0.01 GAS
        private const long DEFAULT_TWO_WEEK_REWARD = 2_000_000; // 0.02 GAS

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Storage prefixes
        // PREFIX_POOL: total GAS held to back rewards (check-in fees + owner
        // fundings). It tracks the contract's reward-backing GAS balance.
        // PREFIX_TOTAL_UNCLAIMED: the PROTECTED obligation = sum of every user's
        // accrued-but-unclaimed reward. WithdrawRevenue can only sweep
        // (pool - totalUnclaimed), so an accrued reward is always claimable.
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TOTAL_UNCLAIMED = new byte[] { 0x19 };
        private static readonly byte[] PREFIX_USER = new byte[] { 0x11 };          // + user -> UserState
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TOTAL_CHECKINS = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TOTAL_REWARDED = new byte[] { 0x14 }; // total claimed across all users
        // Config (single-key slots so the owner can tune without redeploy).
        private static readonly byte[] PREFIX_FEE = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_WEEK_REWARD = new byte[] { 0x16 };
        private static readonly byte[] PREFIX_TWO_WEEK_REWARD = new byte[] { 0x17 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x18 };
        #endregion

        #region Events
        [DisplayName("CheckedIn")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCheckedIn; // user, streak, reward
        [DisplayName("RewardsClaimed")]
        public static event Action<UInt160, BigInteger> OnRewardsClaimed; // user, amount
        [DisplayName("PoolFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnPoolFunded; // from, amount, pool
        [DisplayName("RewardConfigUpdated")]
        public static event Action<BigInteger, BigInteger, BigInteger> OnRewardConfigUpdated; // fee, week, twoWeek
        [DisplayName("PausedChanged")]
        public static event Action<bool> OnPausedChanged;
        [DisplayName("RevenueWithdrawn")]
        public static event Action<UInt160, BigInteger> OnRevenueWithdrawn; // to, amount
        #endregion

        #region Types
        public struct UserState
        {
            public BigInteger CurrentStreak;
            public BigInteger HighestStreak;
            public BigInteger LastCheckinDay;
            public BigInteger Unclaimed;     // accrued milestone reward not yet claimed (base units)
            public BigInteger Claimed;       // total claimed (base units)
            public BigInteger TotalCheckins; // count of check-ins by this user
        }
        #endregion

        #region Deposit (check-in + pool funding) — CREDIT-ONLY
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;
            StorageContext ctx = Storage.CurrentContext;

            if (memo == FUND_MEMO)
            {
                BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount;
                Storage.Put(ctx, PREFIX_POOL, pool);
                OnPoolFunded(from, amount, pool);
                return;
            }
            if (memo == CHECKIN_MEMO)
            {
                ExecutionEngine.Assert(!IsPaused(), "contract is paused");
                ExecutionEngine.Assert(from is not null && from.IsValid && !from.IsZero, "invalid sender");
                ExecutionEngine.Assert(amount >= FeeValue(ctx), "fee below required check-in fee");

                BigInteger today = CurrentUtcDay();
                UserState u = LoadUser(ctx, from);
                ExecutionEngine.Assert(u.LastCheckinDay < today, "already checked in today");

                // Consecutive-day streak: continue if yesterday, else reset to 1.
                // First-ever check-in (LastCheckinDay == 0) starts at 1.
                if (u.LastCheckinDay == today - 1) u.CurrentStreak += 1;
                else u.CurrentStreak = 1;
                if (u.CurrentStreak > u.HighestStreak) u.HighestStreak = u.CurrentStreak;
                u.LastCheckinDay = today;
                u.TotalCheckins += 1;

                // New-user accounting on first-ever check-in.
                if (u.TotalCheckins == 1)
                {
                    BigInteger totalUsers = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_USERS) + 1;
                    Storage.Put(ctx, PREFIX_TOTAL_USERS, totalUsers);
                }
                BigInteger totalCheckins = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CHECKINS) + 1;
                Storage.Put(ctx, PREFIX_TOTAL_CHECKINS, totalCheckins);

                // The check-in fee funds the reward pool.
                BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL) + amount;
                Storage.Put(ctx, PREFIX_POOL, pool);

                // Accrue a milestone reward when the streak HITS a milestone day.
                BigInteger reward = MilestoneReward(ctx, u.CurrentStreak);
                if (reward > 0)
                {
                    u.Unclaimed += reward;
                    BigInteger totalUnclaimed = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_UNCLAIMED) + reward;
                    Storage.Put(ctx, PREFIX_TOTAL_UNCLAIMED, totalUnclaimed);
                }

                Storage.Put(ctx, UserKey(from), StdLib.Serialize(u));
                OnCheckedIn(from, u.CurrentStreak, reward);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Claim
        /// <summary>
        /// Pay the user's accrued unclaimed milestone reward out of the contract's
        /// GAS pool. Reverts if there is nothing to claim or the pool is short.
        /// </summary>
        public static BigInteger ClaimRewards(UInt160 user)
        {
            ExecutionEngine.Assert(user is not null && user.IsValid && !user.IsZero, "invalid user");
            ExecutionEngine.Assert(Runtime.CheckWitness(user), "user witness required");
            StorageContext ctx = Storage.CurrentContext;
            ExecutionEngine.Assert(!IsPaused(), "contract is paused");

            UserState u = LoadUser(ctx, user);
            BigInteger amount = u.Unclaimed;
            ExecutionEngine.Assert(amount > 0, "no rewards to claim");

            BigInteger pool = (BigInteger)Storage.Get(ctx, PREFIX_POOL);
            ExecutionEngine.Assert(pool >= amount, "reward pool cannot cover claim");

            // Effects before interaction.
            u.Unclaimed = 0;
            u.Claimed += amount;
            Storage.Put(ctx, UserKey(user), StdLib.Serialize(u));
            Storage.Put(ctx, PREFIX_POOL, pool - amount);
            BigInteger totalUnclaimed = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_UNCLAIMED) - amount;
            if (totalUnclaimed < 0) totalUnclaimed = 0;
            Storage.Put(ctx, PREFIX_TOTAL_UNCLAIMED, totalUnclaimed);
            BigInteger totalRewarded = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_REWARDED) + amount;
            Storage.Put(ctx, PREFIX_TOTAL_REWARDED, totalRewarded);

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, user, amount, "" });
            ExecutionEngine.Assert(ok, "reward transfer failed");

            OnRewardsClaimed(user, amount);
            return amount;
        }
        #endregion
    }
}
