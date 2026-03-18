using System.Collections.Generic;
using System.Numerics;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class TrustAnchorRewardModelTest
    {
        private static readonly BigInteger Fixed8 = 100000000;

        private sealed class RewardModel
        {
            private static readonly BigInteger Scale = Fixed8;
            private readonly Dictionary<string, BigInteger> _stake = new();
            private readonly Dictionary<string, BigInteger> _reward = new();
            private readonly Dictionary<string, BigInteger> _paid = new();

            public BigInteger TotalStake { get; private set; }
            public BigInteger Rps { get; private set; }
            public BigInteger PendingReward { get; private set; }

            public BigInteger StakeOf(string account) => _stake.TryGetValue(account, out var value) ? value : 0;
            public BigInteger RewardOf(string account) => _reward.TryGetValue(account, out var value) ? value : 0;

            public void DepositReward(BigInteger amount)
            {
                if (TotalStake > 0)
                {
                    Rps += amount * Scale / TotalStake;
                    return;
                }

                PendingReward += amount;
            }

            public void DepositStake(string account, BigInteger amount)
            {
                var previousTotalStake = TotalStake;
                Sync(account);
                _stake[account] = StakeOf(account) + amount;
                TotalStake += amount;

                if (previousTotalStake == 0 && PendingReward > 0)
                {
                    Rps += PendingReward * Scale / TotalStake;
                    PendingReward = 0;
                }
            }

            public void WithdrawStake(string account, BigInteger amount)
            {
                Sync(account);
                _stake[account] = StakeOf(account) - amount;
                TotalStake -= amount;
            }

            public void Sync(string account)
            {
                var stake = StakeOf(account);
                var paid = _paid.TryGetValue(account, out var value) ? value : 0;

                if (stake > 0)
                {
                    var earned = stake * (Rps - paid) / Scale + RewardOf(account);
                    _reward[account] = earned;
                }

                _paid[account] = Rps;
            }
        }

        [Fact]
        public void RewardStaysPendingUntilFirstStakeExists()
        {
            var model = new RewardModel();

            model.DepositReward(50 * Fixed8);

            Assert.Equal(0, model.TotalStake);
            Assert.Equal(0, model.Rps);
            Assert.Equal(50 * Fixed8, model.PendingReward);
        }

        [Fact]
        public void FirstStakeReceivesEntirePendingReward()
        {
            var model = new RewardModel();

            model.DepositReward(50 * Fixed8);
            model.DepositStake("alice", 10);
            model.Sync("alice");

            Assert.Equal(0, model.PendingReward);
            Assert.Equal(10, model.TotalStake);
            Assert.Equal(50 * Fixed8, model.RewardOf("alice"));
        }

        [Fact]
        public void RewardsSplitProRataAcrossStakers()
        {
            var model = new RewardModel();

            model.DepositStake("alice", 2);
            model.DepositStake("bob", 1);
            model.DepositReward(300 * Fixed8);
            model.Sync("alice");
            model.Sync("bob");

            Assert.Equal(200 * Fixed8, model.RewardOf("alice"));
            Assert.Equal(100 * Fixed8, model.RewardOf("bob"));
        }

        [Fact]
        public void SyncBeforeStakeChangePreservesEarnedReward()
        {
            var model = new RewardModel();

            model.DepositStake("alice", 1);
            model.DepositReward(100 * Fixed8);
            model.DepositStake("alice", 1);
            model.DepositReward(100 * Fixed8);
            model.Sync("alice");

            Assert.Equal(200 * Fixed8, model.RewardOf("alice"));
            Assert.Equal(2, model.StakeOf("alice"));
        }

        [Fact]
        public void WithdrawKeepsAlreadyEarnedRewardAndStopsFutureAccrual()
        {
            var model = new RewardModel();

            model.DepositStake("alice", 1);
            model.DepositReward(100 * Fixed8);
            model.WithdrawStake("alice", 1);
            model.DepositReward(100 * Fixed8);
            model.Sync("alice");

            Assert.Equal(0, model.TotalStake);
            Assert.Equal(100 * Fixed8, model.RewardOf("alice"));
        }
    }
}
