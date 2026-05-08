using System;
using System.Collections.Generic;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class AnchorRewardAccountingInvariantTest
    {
        private const long RewardScale = 100_000_000;

        [Fact]
        public void PlatformAnchorCarriesDistributionAndUserRewardRemainders()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("PREFIX_REWARD_REMAINDER", code);
            Assert.Contains("PREFIX_TOTAL_REWARD_RESERVE", code);
            Assert.Contains("GetRewardRemainder(appId)", code);
            Assert.Contains("GetTotalRewardReserve() + GetTotalGasCredit() + amount", code);
            Assert.Contains("scaledReward = amount * REWARD_SCALE + GetRewardRemainder(appId)", code);
            Assert.Contains("Put(AppKey(appId, PREFIX_REWARD_REMAINDER), scaledReward % totalStaked)", code);
            Assert.Contains("private static BigInteger GetPendingRewardScaled(string appId, UInt160 user)", code);
            Assert.Contains("BigInteger amount = scaledPending / REWARD_SCALE", code);
            Assert.Contains("BigInteger remainingScaled = scaledPending - amount * REWARD_SCALE", code);
            Assert.Contains("PutTotalRewardReserve(GetTotalRewardReserve() + amount)", code);
            Assert.Contains("PutTotalRewardReserve(GetTotalRewardReserve() - amount)", code);
        }

        [Fact]
        public void PlatformAnchorLetsUsersExitAndClaimWhenPaused()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            string withdraw = ExtractMethod(code, "Withdraw");
            Assert.Contains("ValidateRegistered(appId)", withdraw);
            Assert.DoesNotContain("ValidateAnchorOpen(appId)", withdraw);

            string claimRewards = ExtractMethod(code, "ClaimRewards");
            Assert.Contains("ValidateRegistered(appId)", claimRewards);
            Assert.DoesNotContain("ValidateAnchorOpen(appId)", claimRewards);
        }

        [Fact]
        public void PlatformAnchorManualAgentActionsUseAgentWitnessWithoutAdminCosign()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            string transferAgentNeo = ExtractMethod(code, "TransferAgentNeo");
            Assert.DoesNotContain("ValidateAppAuthority(appId)", transferAgentNeo);
            Assert.Contains("TransferNeoBetweenSameAppAgents(appId, fromAgentId, toAgentId, amount)", transferAgentNeo);

            string transferNeoBetweenSameAppAgents = ExtractMethod(code, "TransferNeoBetweenSameAppAgents");
            Assert.DoesNotContain("ValidateAppAuthority(appId)", transferNeoBetweenSameAppAgents);
            Assert.Contains("Runtime.CheckWitness(fromAgent)", transferNeoBetweenSameAppAgents);
            Assert.Contains("NEO.Transfer(fromAgent, toAgent, amount)", transferNeoBetweenSameAppAgents);

            string voteAgent = ExtractMethod(code, "VoteAgent");
            Assert.DoesNotContain("ValidateAppAuthority(appId)", voteAgent);
            Assert.Contains("Runtime.CheckWitness(agentAccount)", voteAgent);

            string setAgentCandidate = ExtractMethod(code, "SetAgentCandidate");
            Assert.Contains("ValidateAppAuthority(appId)", setAgentCandidate);
        }

        [Fact]
        public void RewardModelPreservesTinyRewardsAcrossStakeChanges()
        {
            AnchorRewardModel model = new();
            model.Stake("alice", 1);
            model.Stake("bob", 1);
            model.Stake("carol", 1);

            model.FundRewards(1);
            model.Withdraw("alice", 1);
            model.Stake("alice", 1);
            model.FundRewards(1);
            model.Withdraw("alice", 1);
            model.Stake("alice", 1);
            model.FundRewards(1);

            long alice = model.Claim("alice");
            long bob = model.Claim("bob");
            long carol = model.Claim("carol");

            Assert.Equal(1, alice);
            Assert.Equal(1, bob);
            Assert.Equal(1, carol);
            Assert.Equal(0, model.RewardReserve);
        }

        [Fact]
        public void RewardModelNeverClaimsMoreThanFundedAcrossStakeChanges()
        {
            AnchorRewardModel model = new();
            model.Stake("alice", 2);
            model.FundRewards(7);
            model.Stake("bob", 3);
            model.FundRewards(11);
            model.Withdraw("alice", 1);
            model.FundRewards(13);
            model.Withdraw("bob", 1);
            model.FundRewards(17);

            long claimed =
                model.Claim("alice")
                + model.Claim("bob");

            Assert.True(claimed <= model.TotalFunded);
            Assert.Equal(model.TotalFunded - claimed, model.RewardReserve);
            Assert.True(model.RewardReserve >= 0);
        }

        [Fact]
        public void RewardModelPreventsCrossAppReserveDoubleCounting()
        {
            MultiAnchorRewardPool pool = new(balance: 10, gasCredit: 0);
            pool.Harvest("profitanchor", 6);

            Assert.Throws<InvalidOperationException>(() => pool.Harvest("trustanchor", 6));

            pool.Harvest("trustanchor", 4);
            Assert.Equal(10, pool.TotalRewardReserve);
            Assert.Equal(6, pool.RewardReserve("profitanchor"));
            Assert.Equal(4, pool.RewardReserve("trustanchor"));
            Assert.Equal(0, pool.AvailableGas);
        }

        [Fact]
        public void RewardModelMaintainsConservationAcrossRandomStakeRewardClaimSequences()
        {
            AnchorRewardModel model = new();
            Random random = new(0xA17C40);
            string[] users = { "alice", "bob", "carol", "dave" };

            model.Stake("alice", 3);
            model.Stake("bob", 5);

            for (int i = 0; i < 500; i++)
            {
                string user = users[random.Next(users.Length)];
                int action = random.Next(4);

                if (action == 0)
                {
                    model.Stake(user, random.Next(1, 7));
                }
                else if (action == 1 && model.StakeOf(user) > 0)
                {
                    model.Withdraw(user, random.Next(1, (int)model.StakeOf(user) + 1));
                }
                else if (action == 2 && model.TotalStaked > 0)
                {
                    model.FundRewards(random.Next(1, 23));
                }
                else
                {
                    model.Claim(user);
                }

                Assert.True(model.TotalClaimed <= model.TotalFunded);
                Assert.Equal(model.TotalFunded - model.TotalClaimed, model.RewardReserve);
                Assert.True(model.RewardReserve >= 0);
            }
        }

        private static string ExtractMethod(string code, string methodName)
        {
            int signature = code.IndexOf($"public static void {methodName}(", StringComparison.Ordinal);
            if (signature < 0)
            {
                signature = code.IndexOf($"private static void {methodName}(", StringComparison.Ordinal);
            }
            Assert.True(signature >= 0, $"Method {methodName} was not found.");
            int brace = code.IndexOf('{', signature);
            Assert.True(brace >= 0, $"Method {methodName} has no body.");

            int depth = 0;
            for (int i = brace; i < code.Length; i++)
            {
                if (code[i] == '{') depth++;
                if (code[i] == '}') depth--;
                if (depth == 0) return code.Substring(signature, i - signature + 1);
            }

            throw new InvalidOperationException($"Method {methodName} body was not closed.");
        }

        private sealed class AnchorRewardModel
        {
            private readonly Dictionary<string, long> stake = new();
            private readonly Dictionary<string, long> rewardDebt = new();
            private readonly Dictionary<string, long> pendingScaled = new();
            private long totalStaked;
            private long rewardPerNeo;
            private long rewardRemainder;

            public long RewardReserve { get; private set; }
            public long TotalFunded { get; private set; }
            public long TotalClaimed { get; private set; }
            public long TotalStaked => totalStaked;

            public long StakeOf(string user) => Get(stake, user);

            public void Stake(string user, long amount)
            {
                Accrue(user);
                stake[user] = Get(stake, user) + amount;
                totalStaked += amount;
                rewardDebt[user] = Get(stake, user) * rewardPerNeo;
            }

            public void Withdraw(string user, long amount)
            {
                Accrue(user);
                stake[user] = Get(stake, user) - amount;
                totalStaked -= amount;
                rewardDebt[user] = Get(stake, user) * rewardPerNeo;
            }

            public void FundRewards(long amount)
            {
                long scaledReward = amount * RewardScale + rewardRemainder;
                rewardPerNeo += scaledReward / totalStaked;
                rewardRemainder = scaledReward % totalStaked;
                RewardReserve += amount;
                TotalFunded += amount;
            }

            public long Claim(string user)
            {
                Accrue(user);
                long scaled = Get(pendingScaled, user);
                long amount = scaled / RewardScale;
                pendingScaled[user] = scaled - amount * RewardScale;
                RewardReserve -= amount;
                TotalClaimed += amount;
                return amount;
            }

            private void Accrue(string user)
            {
                long accrued = Get(stake, user) * rewardPerNeo - Get(rewardDebt, user);
                if (accrued < 0) accrued = 0;
                pendingScaled[user] = Get(pendingScaled, user) + accrued;
                rewardDebt[user] = Get(stake, user) * rewardPerNeo;
            }

            private static long Get(Dictionary<string, long> values, string key) =>
                values.TryGetValue(key, out long value) ? value : 0;
        }

        private sealed class MultiAnchorRewardPool
        {
            private readonly Dictionary<string, long> rewardReserveByApp = new();
            private readonly long balance;
            private readonly long totalGasCredit;

            public MultiAnchorRewardPool(long balance, long gasCredit)
            {
                this.balance = balance;
                totalGasCredit = gasCredit;
            }

            public long TotalRewardReserve { get; private set; }
            public long AvailableGas => balance - totalGasCredit - TotalRewardReserve;

            public long RewardReserve(string appId) =>
                rewardReserveByApp.TryGetValue(appId, out long value) ? value : 0;

            public void Harvest(string appId, long amount)
            {
                if (balance < TotalRewardReserve + totalGasCredit + amount)
                {
                    throw new InvalidOperationException("insufficient available GAS");
                }

                rewardReserveByApp[appId] = RewardReserve(appId) + amount;
                TotalRewardReserve += amount;
            }
        }
    }
}
