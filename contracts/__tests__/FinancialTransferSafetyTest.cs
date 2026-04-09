using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class FinancialTransferSafetyTest
    {
        [Fact]
        public void LastSurvivorWinnerPayoutMustAssertTransferResult()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppLastSurvivor", "MiniAppLastSurvivor.Settle.cs");
            Assert.Contains("ExecutionEngine.Assert(", code);
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize)", code);
            Assert.Contains("winner payout failed", code);
        }

        [Fact]
        public void LastSurvivorDoesNotCallUncheckedTransfer()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppLastSurvivor", "MiniAppLastSurvivor.Settle.cs");
            // The old pattern was a bare GAS.Transfer on its own line without Assert
            Assert.DoesNotContain("\n                GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize);\n", code);
        }

        [Fact]
        public void SelfLoanCollateralWithdrawalMustAssertTransferResult()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppSelfLoan", "MiniAppSelfLoan.Methods.cs");
            Assert.Contains("collateral withdrawal transfer failed", code);
        }

        [Fact]
        public void SelfLoanCloseTransferMustAssertResult()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppSelfLoan", "MiniAppSelfLoan.Methods.cs");
            Assert.Contains("loan close transfer failed", code);
        }
    }
}
