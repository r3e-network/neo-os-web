using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class DailyCheckinContract : SmartContract
    {
        protected DailyCheckinContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? claimRewards(UInt160 user);
        public abstract void setRewardConfig(BigInteger checkInFee, BigInteger weekReward, BigInteger twoWeekReward);
        public abstract void setPaused(bool paused);
        public abstract void withdrawRevenue(UInt160 to, BigInteger amount);
        // Maps come back as raw Neo.VM.Types.Map (the binding the testing host uses).
        public abstract Neo.VM.Types.Map? getCheckInStateForFrontend(UInt160 user);
        public abstract Neo.VM.Types.Map? getCheckinStatus(UInt160 user);
        public abstract Neo.VM.Types.Map? getUserStatsDetails(UInt160 user);
        public abstract Neo.VM.Types.Map? getPlatformStats();
        public abstract bool? isPaused();
        public abstract BigInteger? rewardPool();
        public abstract BigInteger? totalUnclaimed();
        public abstract BigInteger? checkInFee();
    }

    public class MiniAppDailyCheckinTests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form, byte-reversed, as the TestEngine reports it).
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100_000_000;          // 1 GAS base units
        private const long FEE = 100_000;              // 0.001 GAS default check-in fee
        private const long WEEK_REWARD = 1_000_000;    // 0.01 GAS
        private const string CHECKIN_MEMO = "miniapp-dailycheckin:checkin";
        private const string FUND_MEMO = "miniapp-dailycheckin:fund";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static void FundGas(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        // Contract asserts surface as "ABORTMSG is executed. Reason: <text>".
        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        // Solvency invariant: the contract's GAS balance always covers the reward
        // pool obligation (excess being withdrawable revenue).
        private static void AssertSolvent(TestEngine engine, DailyCheckinContract c)
        {
            BigInteger pool = c.rewardPool() ?? 0;
            BigInteger balance = engine.Native.GAS.BalanceOf(c.Hash) ?? 0;
            Assert.True(balance >= pool, $"insolvent: balance {balance} < pool {pool}");
        }

        // Map value helpers — values come back as Neo.VM.Types.StackItem.
        private static BigInteger I(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetInteger();
        private static bool B(Neo.VM.Types.Map m, string key) =>
            m[(Neo.VM.Types.PrimitiveType)key].GetBoolean();

        // Advance the persisting-block clock by whole UTC days. The TestEngine does
        // NOT auto-advance time across transfers, so the contract's
        // CurrentUtcDay() (Runtime.Time / 86_400_000) only changes when we call this.
        private static void AdvanceDay(TestEngine engine) =>
            engine.PersistingBlock.Advance(TimeSpan.FromDays(1));

        private static void CheckIn(TestEngine engine, DailyCheckinContract c, UInt160 user)
        {
            engine.SetTransactionSigners(user);
            engine.Native.GAS.Transfer(user, c.Hash, FEE, CHECKIN_MEMO);
        }

        [Fact]
        public void Checkin_DepositRecordsStreakAndCountersAndPool()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            CheckIn(engine, c, user);

            var state = c.getCheckInStateForFrontend(user)!;
            Assert.Equal(BigInteger.One, I(state, "currentStreak"));
            Assert.Equal(BigInteger.One, I(state, "highestStreak"));
            Assert.Equal(BigInteger.One, I(state, "totalCheckins"));
            Assert.Equal(BigInteger.Zero, I(state, "unclaimed"));

            var platform = c.getPlatformStats()!;
            Assert.Equal(BigInteger.One, I(platform, "totalUsers"));
            Assert.Equal(BigInteger.One, I(platform, "totalCheckins"));
            Assert.Equal(new BigInteger(FEE), I(platform, "checkInFee"));

            // The fee accrued into the pool.
            Assert.Equal(new BigInteger(FEE), c.rewardPool());
            AssertSolvent(engine, c);
        }

        [Fact]
        public void Checkin_SecondSameDayBlockedThenEligibleNextDay()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            // Before any check-in the user is eligible today.
            Assert.True(B(c.getCheckinStatus(user)!, "canCheckin"));

            CheckIn(engine, c, user);

            // After today's check-in the contract reports the user is no longer
            // eligible until the next UTC midnight. NOTE: a SECOND deposit on the
            // same day reverts inside OnNEP17Payment ("already checked in today");
            // that mid-transfer abort cannot be unwound by the TestEngine host
            // (it crashes), so the same-day-block is asserted here via the
            // eligibility read (and is exercised on-chain by the live harness).
            var status = c.getCheckinStatus(user)!;
            Assert.False(B(status, "canCheckin"));
            Assert.True(I(status, "timeUntilEligible") > 0);
            Assert.Equal(I(c.getCheckInStateForFrontend(user)!, "currentDay"),
                         I(status, "lastCheckinDay"));

            // Advancing to the next UTC day makes the user eligible again, and a
            // second check-in then continues the streak (no double-count today).
            AdvanceDay(engine);
            Assert.True(B(c.getCheckinStatus(user)!, "canCheckin"));
            CheckIn(engine, c, user);
            Assert.Equal(new BigInteger(2), I(c.getCheckInStateForFrontend(user)!, "currentStreak"));
            Assert.Equal(new BigInteger(2L * FEE), c.rewardPool());
        }

        [Fact]
        public void Checkin_SevenConsecutiveDaysAccrueWeekMilestone()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            for (int day = 0; day < 7; day++)
            {
                CheckIn(engine, c, user);
                if (day < 6) AdvanceDay(engine);
            }

            var state = c.getCheckInStateForFrontend(user)!;
            Assert.Equal(new BigInteger(7), I(state, "currentStreak"));
            Assert.Equal(new BigInteger(7), I(state, "highestStreak"));
            Assert.Equal(new BigInteger(7), I(state, "totalCheckins"));
            // Day-7 milestone accrued the weekReward into unclaimed.
            Assert.Equal(new BigInteger(WEEK_REWARD), I(state, "unclaimed"));
            // Pool holds the 7 check-in fees.
            Assert.Equal(new BigInteger(7L * FEE), c.rewardPool());
            AssertSolvent(engine, c);
        }

        [Fact]
        public void Checkin_MissedDayResetsStreak()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            // Day d and d+1 → streak 2.
            CheckIn(engine, c, user);
            AdvanceDay(engine);
            CheckIn(engine, c, user);
            Assert.Equal(new BigInteger(2), I(c.getCheckInStateForFrontend(user)!, "currentStreak"));

            // Skip day d+2 (advance two days without a check-in), check in on d+3 →
            // streak resets to 1, highest stays 2.
            AdvanceDay(engine);
            AdvanceDay(engine);
            CheckIn(engine, c, user);

            var state = c.getCheckInStateForFrontend(user)!;
            Assert.Equal(BigInteger.One, I(state, "currentStreak"));
            Assert.Equal(new BigInteger(2), I(state, "highestStreak"));
            Assert.Equal(new BigInteger(3), I(state, "totalCheckins"));
        }

        [Fact]
        public void Claim_PaysFromPoolAndZeroesUnclaimed()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            // Reach the day-7 milestone to accrue weekReward.
            for (int day = 0; day < 7; day++)
            {
                CheckIn(engine, c, user);
                if (day < 6) AdvanceDay(engine);
            }
            Assert.Equal(new BigInteger(WEEK_REWARD), I(c.getCheckInStateForFrontend(user)!, "unclaimed"));

            // Owner funds the pool so it can cover the reward.
            FundGas(engine, OwnerHash, 5L * GAS);
            engine.SetTransactionSigners(OwnerHash);
            engine.Native.GAS.Transfer(OwnerHash, c.Hash, 2L * GAS, FUND_MEMO);

            BigInteger userBefore = engine.Native.GAS.BalanceOf(user) ?? 0;
            BigInteger poolBefore = c.rewardPool() ?? 0;

            engine.SetTransactionSigners(user);
            Assert.Equal(new BigInteger(WEEK_REWARD), c.claimRewards(user));

            // User received exactly the reward; pool dropped by the reward.
            Assert.Equal(userBefore + WEEK_REWARD, engine.Native.GAS.BalanceOf(user));
            Assert.Equal(poolBefore - WEEK_REWARD, c.rewardPool());

            // Unclaimed zeroed, claimed recorded, global totalRewarded updated.
            var details = c.getUserStatsDetails(user)!;
            Assert.Equal(BigInteger.Zero, I(details, "unclaimed"));
            Assert.Equal(new BigInteger(WEEK_REWARD), I(details, "claimed"));
            Assert.Equal(new BigInteger(WEEK_REWARD), I(c.getPlatformStats()!, "totalRewarded"));
            AssertSolvent(engine, c);

            // Nothing left to claim.
            AssertRevert("no rewards to claim", () => c.claimRewards(user));
        }

        [Fact]
        public void Claim_BlockedWhenPoolCannotCover()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            // Reach the milestone — the pool only holds 7 fees (700_000), which is
            // below the 1_000_000 weekReward, so the claim must be gated.
            for (int day = 0; day < 7; day++)
            {
                CheckIn(engine, c, user);
                if (day < 6) AdvanceDay(engine);
            }
            Assert.Equal(new BigInteger(7L * FEE), c.rewardPool());
            Assert.True((c.rewardPool() ?? 0) < WEEK_REWARD);

            engine.SetTransactionSigners(user);
            AssertRevert("reward pool cannot cover claim", () => c.claimRewards(user));

            // Unclaimed is untouched — still claimable once the pool is funded.
            Assert.Equal(new BigInteger(WEEK_REWARD), I(c.getUserStatsDetails(user)!, "unclaimed"));
        }

        [Fact]
        public void SetRewardConfig_AndSetPaused_AreOwnerOnly()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var stranger = TestEngine.GetNewSigner().Account;
            FundGas(engine, stranger, 5L * GAS);

            engine.SetTransactionSigners(stranger);
            AssertRevert("owner only", () => c.setRewardConfig(200_000, 5_000_000, 9_000_000));
            AssertRevert("owner only", () => c.setPaused(true));

            // Owner tunes the config; reads reflect the new values.
            engine.SetTransactionSigners(OwnerHash);
            c.setRewardConfig(200_000, 5_000_000, 9_000_000);
            Assert.Equal(new BigInteger(200_000), c.checkInFee());
            var platform = c.getPlatformStats()!;
            Assert.Equal(new BigInteger(5_000_000), I(platform, "weekReward"));
            Assert.Equal(new BigInteger(9_000_000), I(platform, "twoWeekReward"));

            // Owner can pause; a paused contract rejects claims (direct method, so
            // the revert is catchable). The paused check-in DEPOSIT path also
            // reverts on-chain, but that revert fires inside OnNEP17Payment
            // mid-transfer which crashes the TestEngine host, so it is covered by
            // the live harness rather than asserted via a transfer here.
            c.setPaused(true);
            Assert.True(c.isPaused() ?? false);

            engine.SetTransactionSigners(stranger);
            AssertRevert("contract is paused", () => c.claimRewards(stranger));

            // Unpausing restores normal operation.
            engine.SetTransactionSigners(OwnerHash);
            c.setPaused(false);
            Assert.False(c.isPaused() ?? true);
        }

        [Fact]
        public void WithdrawRevenue_OwnerOnlyAndNeverDrainsPool()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppDailyCheckin");
            var c = engine.Deploy<DailyCheckinContract>(nef, manifest);

            var user = TestEngine.GetNewSigner().Account;
            FundGas(engine, user, 5L * GAS);

            // One check-in: pool = FEE, balance = FEE → withdrawable = 0.
            CheckIn(engine, c, user);

            // A stranger cannot withdraw, and the zero-amount guard holds.
            engine.SetTransactionSigners(user);
            AssertRevert("owner only", () => c.withdrawRevenue(user, 1));
            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("amount must be > 0", () => c.withdrawRevenue(OwnerHash, 0));

            // The owner cannot touch the obligated pool: pool == obligation? No —
            // at streak 1 there is no accrued reward, so the obligation is 0 and the
            // FEE in the pool IS withdrawable revenue. Funding more first to make the
            // distinction crisp: fund 3 GAS, then drive the user to the week
            // milestone so a real obligation (weekReward) exists.
            FundGas(engine, OwnerHash, 5L * GAS);
            engine.SetTransactionSigners(OwnerHash);
            engine.Native.GAS.Transfer(OwnerHash, c.Hash, 3L * GAS, FUND_MEMO);

            // Reach day-7 (already checked in day 0 above → 6 more consecutive days),
            // accruing a weekReward obligation that must stay protected.
            for (int i = 0; i < 6; i++)
            {
                AdvanceDay(engine);
                CheckIn(engine, c, user);
            }
            Assert.Equal(new BigInteger(WEEK_REWARD), c.totalUnclaimed());

            // Withdrawable revenue = pool - obligation. The owner cannot withdraw a
            // hair more (that would dip into the user's accrued reward).
            BigInteger pool = c.rewardPool() ?? 0;
            BigInteger obligation = c.totalUnclaimed() ?? 0;
            BigInteger withdrawable = pool - obligation;
            Assert.True(withdrawable > 0, $"expected withdrawable revenue, got {withdrawable}");

            engine.SetTransactionSigners(OwnerHash);
            AssertRevert("amount exceeds withdrawable revenue",
                () => c.withdrawRevenue(OwnerHash, withdrawable + 1));

            BigInteger ownerBefore = engine.Native.GAS.BalanceOf(OwnerHash) ?? 0;
            c.withdrawRevenue(OwnerHash, withdrawable);
            Assert.Equal(ownerBefore + withdrawable, engine.Native.GAS.BalanceOf(OwnerHash));

            // After sweeping all revenue, exactly the obligation remains in the pool
            // and the user can still claim their full accrued reward.
            Assert.Equal(obligation, c.rewardPool());
            Assert.Equal(obligation, c.totalUnclaimed());
            engine.SetTransactionSigners(user);
            Assert.Equal(new BigInteger(WEEK_REWARD), c.claimRewards(user));
            Assert.Equal(BigInteger.Zero, c.rewardPool());
            Assert.Equal(BigInteger.Zero, c.totalUnclaimed());
            AssertSolvent(engine, c);
        }
    }
}
