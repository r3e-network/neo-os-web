using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class FinancialTransferSafetyTest
    {
        [Fact]
        public void AppAccountWrapsNativeTransfersInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "AppAccount");
            Assert.Contains(
                "ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, target, amount), \"GAS transfer failed\")",
                code);
            Assert.Contains(
                "ExecutionEngine.Assert(NEO.Transfer(Runtime.ExecutingScriptHash, target, amount), \"NEO transfer failed\")",
                code);
        }

        [Fact]
        public void AppAccountOutboundLanesAreRoleBound()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "AppAccount");

            // The one normal outbound path is registry-relayed: spend POLICY
            // (timelocked payout address, engine-bound pool funding) lives in the
            // registry treasury, never here.
            Assert.Contains("Runtime.CallingScriptHash == RegistryOf()", code);

            // The escape hatch pays only the stored app admin.
            Assert.Contains("TransferAsset(asset, admin, amount)", code);

            // No free-destination surface exists on the account shim.
            Assert.DoesNotContain("UInt160 recipient", code);
            Assert.DoesNotContain("ContractManagement.Destroy", code);
        }

        [Fact]
        public void PlatformRegistryWrapsNativeTransfersInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformRegistry");
            Assert.Contains(
                "ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount),\n                \"credit withdrawal failed\")",
            code);
            Assert.Contains(
                "ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, row.Hash, amount, appId + \":fund\"),\n                \"engine pool transfer failed\")",
            code);
            Assert.Contains(
                "ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, admin, amount),\n                \"fee withdrawal failed\")",
            code);
        }

        [Fact]
        public void PlatformRegistryTreasuryLanesAreRoleBound()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformRegistry");

            // Every account relay is destination-bound: the registered payout
            // address or the registry itself (the fundEnginePool transit hop);
            // pool forwarding is hard-bound to the registered engine hash.
            Assert.Contains("Contract.Call(account, \"executeTransfer\", CallFlags.All, asset, payout, amount)", code);
            Assert.Contains("Contract.Call(account, \"executeTransfer\", CallFlags.All, GAS.Hash, Runtime.ExecutingScriptHash, amount)", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, row.Hash, amount, appId + \":fund\")", code);

            // Credit exits pay the witnessing payer; fee exits pay the admin.
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount)", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, admin, amount)", code);

            // No free-destination surface, no destroy, no wildcard grants.
            Assert.DoesNotContain("UInt160 recipient", code);
            Assert.DoesNotContain("ContractManagement.Destroy", code);
            Assert.DoesNotContain("ContractPermission(\"*\", \"*\")", code);
        }

        [Fact]
        public void PlatformGameCountdownWrapsGASTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Countdown*.cs", "contracts", "platform", "PlatformGame");
            Assert.Contains("ExecutionEngine.Assert", code);
            Assert.Contains("GAS.Transfer", code);
        }

        [Fact]
        public void PlatformDeFiLendingWrapsNEOTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformDeFi.Lending*.cs", "contracts", "platform", "PlatformDeFi");
            Assert.Contains("ExecutionEngine.Assert", code);
        }

        [Fact]
        public void PlatformDeFiLendingOnlyPaysLoanFundsToBorrower()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformDeFi.Lending*.cs", "contracts", "platform", "PlatformDeFi");

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
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformSocial.Envelope*.cs", "contracts", "platform", "PlatformSocial");
            Assert.Contains("ExecutionEngine.Assert", code);
            Assert.Contains("GAS.Transfer", code);
        }

        [Fact]
        public void PlatformSocialRangeGasPoolWrapsPayoutTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformSocial.Envelope*.cs", "contracts", "platform", "PlatformSocial");
            Assert.Contains("ClaimRangeGasPool", code);
            Assert.Contains("ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, claimer, amount)", code);
        }

        [Fact]
        public void PlatformSocialGasCreditWithdrawalWrapsTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformSocial");
            Assert.Contains("WithdrawGasCredit", code);
            Assert.Contains("ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, user, amount)", code);
        }

        [Fact]
        public void PlatformSocialBusinessPayoutsPreserveDirectCreditSolvency()
        {
            string envelope = ContractSourceAssertions.ReadSourcesByPattern("PlatformSocial.Envelope*.cs", "contracts", "platform", "PlatformSocial");
            string trust = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Trust.cs");
            string vault = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Vault.cs");

            Assert.Equal(4, envelope.Split("EnsureGasCreditSolvent();").Length - 1);
            Assert.Equal(2, trust.Split("EnsureNeoCreditSolvent();").Length - 1);
            Assert.Equal(2, vault.Split("EnsureGasCreditSolvent();").Length - 1);
            Assert.Contains(
                "ExecutionEngine.Assert(\n                        NEO.Transfer(Runtime.ExecutingScriptHash, admin, platformFee)",
                trust);
            Assert.Contains(
                "ExecutionEngine.Assert(\n                        NEO.Transfer(Runtime.ExecutingScriptHash, admin, penalty)",
                trust);
            Assert.Contains(
                "ExecutionEngine.Assert(\n                            GAS.Transfer(Runtime.ExecutingScriptHash, admin, fee)",
                vault);
        }

        [Fact]
        public void PlatformSocialPayoutsStayWithinTheirDomainRoles()
        {
            string envelope = ContractSourceAssertions.ReadSourcesByPattern("PlatformSocial.Envelope*.cs", "contracts", "platform", "PlatformSocial");
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
            string countdown = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Countdown*.cs", "contracts", "platform", "PlatformGame");
            string coinFlip = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.CoinFlip*.cs", "contracts", "platform", "PlatformGame");
            string gacha = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Gacha*.cs", "contracts", "platform", "PlatformGame");
            string dice = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Dice.cs");

            Assert.Contains("UInt160 winner = round.LastBuyer", countdown);
            // The winner is paid via pull-payment: the prize is added to the
            // existing direct GAS credit ledger (claimed via WithdrawGasCredit),
            // never pushed. A push to a GAS-rejecting contract winner would brick
            // settlement and strand the pot.
            Assert.Contains("AddDirectGasCredit(appId, winner, winnerPrize)", countdown);
            Assert.DoesNotContain("GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize)", countdown);
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

        [Fact]
        public void PlatformGameRewardGameWithdrawalWrapsTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.RewardGame*.cs", "contracts", "platform", "PlatformGame");
            Assert.Contains(
                "ExecutionEngine.Assert(\n                GAS.Transfer(Runtime.ExecutingScriptHash, account, credit),\n                \"withdraw transfer failed\")",
                code);
        }

        [Fact]
        public void PlatformGameRewardGamePayoutsStayRoleBound()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.RewardGame*.cs", "contracts", "platform", "PlatformGame");

            // The only outbound lane is the pull-payment withdrawal, which
            // pays the witnessing credit owner. Winnings settle as credit
            // (claimed via withdraw), never as a push to a free destination.
            Assert.Contains("Runtime.CheckWitness(account)", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, account, credit)", code);
            Assert.Contains("AddRewardCredit(ctx, appId, g.Player, payout);", code);
            Assert.DoesNotContain("UInt160 recipient", code);
            Assert.DoesNotContain("ContractManagement.Destroy", code);
            Assert.DoesNotContain("ContractPermission(\"*\", \"*\")", code);
        }
    }
}
