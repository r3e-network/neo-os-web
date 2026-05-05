using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class AnchorBoundarySafetyTest
    {
        [Fact]
        public void PlatformAnchorKeepsUserWithdrawalsUserWitnessed()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("public static void Withdraw(string appId, UInt160 user, BigInteger amount)", code);
            Assert.Contains("Runtime.CheckWitness(user)", code);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
            Assert.DoesNotContain("NEO.Transfer(Runtime.ExecutingScriptHash, Admin()", code);
            Assert.DoesNotContain("NEO.Transfer(Runtime.ExecutingScriptHash, GetAppAdmin", code);
        }

        [Fact]
        public void PlatformAnchorCanStakeDirectlyFromNeoTransferData()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("if (data is string)", code);
            Assert.Contains("StakeFromCredit(appId, from, amount)", code);
            Assert.Contains("private static void StakeFromCredit(string appId, UInt160 user, BigInteger amount)", code);
        }

        [Fact]
        public void PlatformAnchorKeepsRewardClaimsUserWitnessed()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("public static void ClaimRewards(string appId, UInt160 user)", code);
            Assert.Contains("Runtime.CheckWitness(user)", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
            Assert.DoesNotContain("GAS.Transfer(Runtime.ExecutingScriptHash, Admin()", code);
            Assert.DoesNotContain("GAS.Transfer(Runtime.ExecutingScriptHash, GetAppAdmin", code);
        }

        [Fact]
        public void PlatformAnchorKeepsCreditsUserWitnessed()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("public static void WithdrawCredit(UInt160 user, string asset, BigInteger amount)", code);
            Assert.Contains("Runtime.CheckWitness(user)", code);
            Assert.Contains("ConsumeGasCredit(user, amount)", code);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
        }

        [Fact]
        public void PlatformAnchorDoesNotHarvestUserGasCredits()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("GetTotalRewardReserve() + GetTotalGasCredit() + amount", code);
            Assert.Contains("PutTotalRewardReserve(GetTotalRewardReserve() + amount)", code);
            Assert.Contains("PutTotalRewardReserve(GetTotalRewardReserve() - amount)", code);
            Assert.Contains("Runtime.CheckWitness(funder)", code);
            Assert.Contains("private static void ConsumeGasCredit(UInt160 user, BigInteger amount)", code);
        }

        [Fact]
        public void PlatformAnchorRequiresAaWitnessForAgentVotes()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("public static void VoteAgent(string appId, BigInteger agentId)", code);
            Assert.Contains("Runtime.CheckWitness(agentAccount)", code);
            Assert.Contains("NEO.Vote(agentAccount, candidate)", code);
        }

        [Fact]
        public void ProfitAnchorPooledVotesMustUseBestProfitAgent()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformAnchor", "PlatformAnchor.cs");

            Assert.Contains("ValidateMode(appId, MODE_PROFIT)", code);
            Assert.Contains("RecomputeBestProfitAgent(appId)", code);
            Assert.Contains("agentId == GetBigInteger(AppKey(appId, PREFIX_BEST_AGENT))", code);
            Assert.Contains("NEO.Vote(Runtime.ExecutingScriptHash, candidate)", code);
        }

        [Fact]
        public void SelfLoanVotesCollateralThroughProfitAnchorWithoutTransferringCustody()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.Lending.cs");

            Assert.Contains("public static void SyncProfitAnchorVote(string appId)", code);
            Assert.Contains("\"getBestCandidate\"", code);
            Assert.Contains("NEO.Vote(Runtime.ExecutingScriptHash, (ECPoint)candidate", code);
            Assert.DoesNotContain("NEO.Transfer(Runtime.ExecutingScriptHash, profitAnchorContract", code);
        }
    }
}
