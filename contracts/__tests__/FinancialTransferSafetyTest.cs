using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class FinancialTransferSafetyTest
    {
        [Fact]
        public void PlatformGameCountdownWrapsGASTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Countdown.cs");
            Assert.Contains("ExecutionEngine.Assert", code);
            Assert.Contains("GAS.Transfer", code);
        }

        [Fact]
        public void PlatformDeFiLendingWrapsNEOTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.Lending.cs");
            Assert.Contains("ExecutionEngine.Assert", code);
        }

        [Fact]
        public void PlatformDeFiLendingOnlyPaysLoanFundsToBorrower()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.Lending.cs");

            Assert.Contains("private static void TransferLoanGasToBorrower", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, borrower, amount)", code);
            Assert.Contains("private static void ReturnLoanCollateralToBorrower", code);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, loan.Borrower, loan.Collateral)", code);
            Assert.Contains("ValidateApp(appId, ProductType_Lending)", code);
            Assert.DoesNotContain("public static void Transfer", code);
            Assert.DoesNotContain("public static BigInteger Transfer", code);
            Assert.DoesNotContain("UInt160 recipient", code);
            Assert.DoesNotContain("UInt160 to, BigInteger amount", code);
        }

        [Fact]
        public void PlatformDeFiOtherProductsKeepFundsInsideProductRecipients()
        {
            string defi = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.cs");
            string flash = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.FlashLoan.cs");
            string capsule = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.Capsule.cs");

            Assert.DoesNotContain("[ContractPermission(\"*\", \"*\")]", defi);
            Assert.Contains("[ContractPermission(\"*\", \"getSelectedCandidate\", \"onFlashLoan\")]", defi);
            Assert.Contains("Runtime.CheckWitness(provider)", flash);
            Assert.Contains("callbackMethod == \"onFlashLoan\"", flash);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, provider, amount", flash);
            Assert.Contains("contractGasAfter == contractGasBefore + fee", flash);
            Assert.Contains("GAS.Transfer(\n                Runtime.ExecutingScriptHash,\n                callbackContract,\n                amount", flash);
            Assert.DoesNotContain("UInt160 recipient", flash);

            Assert.Contains("Runtime.CheckWitness(capsule.Owner)", capsule);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Principal)", capsule);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Compound - fee)", capsule);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, payout)", capsule);
            Assert.DoesNotContain("UInt160 recipient", capsule);
        }

        [Fact]
        public void PlatformSocialEnvelopeWrapsGASTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            Assert.Contains("ExecutionEngine.Assert", code);
            Assert.Contains("GAS.Transfer", code);
        }

        [Fact]
        public void PlatformSocialRangeGasPoolWrapsPayoutTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            Assert.Contains("ClaimRangeGasPool", code);
            Assert.Contains("ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount)", code);
        }

        [Fact]
        public void PlatformSocialGasCreditWithdrawalWrapsTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.cs");
            Assert.Contains("WithdrawGasCredit", code);
            Assert.Contains("ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
        }

        [Fact]
        public void PlatformSocialPayoutsStayWithinTheirDomainRoles()
        {
            string envelope = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            string trust = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Trust.cs");
            string vault = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Vault.cs");

            Assert.Contains("Runtime.CheckWitness(claimer)", envelope);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount)", envelope);
            Assert.Contains("Runtime.CheckWitness(pool.Creator)", envelope);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, pool.Creator, refund)", envelope);
            Assert.DoesNotContain("UInt160 recipient", envelope);

            Assert.Contains("Runtime.CheckWitness(trust.Owner)", trust);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, trust.Heir, heirAmount)", trust);
            Assert.Contains("NEO.Transfer(Runtime.ExecutingScriptHash, trust.Owner, refundAmount)", trust);
            Assert.DoesNotContain("UInt160 recipient", trust);

            Assert.Contains("Runtime.CheckWitness(attacker)", vault);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, attacker, reward)", vault);
            Assert.DoesNotContain("UInt160 recipient", vault);
        }

        [Fact]
        public void PlatformGamePayoutsStayBoundToGameWinnersAndPlayers()
        {
            string countdown = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Countdown.cs");
            string coinFlip = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.CoinFlip.cs");
            string gacha = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Gacha.cs");
            string dice = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Dice.cs");

            Assert.Contains("UInt160 winner = round.LastBuyer", countdown);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize)", countdown);
            Assert.DoesNotContain("UInt160 recipient", countdown);

            Assert.Contains("bet.Player", coinFlip);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout)", coinFlip);
            Assert.DoesNotContain("UInt160 recipient", coinFlip);

            Assert.Contains("play.Player", gacha);
            Assert.Contains("Runtime.ExecutingScriptHash, play.Player, selectedItem.Amount", gacha);
            Assert.Contains("Runtime.ExecutingScriptHash, play.Player, tokenId", gacha);
            Assert.DoesNotContain("UInt160 recipient", gacha);

            Assert.Contains("bet.Player", dice);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout)", dice);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, bet.Amount)", dice);
            Assert.DoesNotContain("UInt160 recipient", dice);
        }
    }
}
