using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractSecurityRegressionTest
    {
        [Fact]
        public void PlatformSocialEnvelopeUsesUInt160ZeroForMissingCreator()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            Assert.DoesNotContain("envelope.Creator != null", code);
            Assert.Contains("UInt160.Zero", code);
        }

        [Fact]
        public void PlatformDeFiFlashLoanHasReentrancyGuard()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.FlashLoan.cs");
            Assert.Contains("REENTRANCY", code.ToUpper());
        }

        [Fact]
        public void PlatformGameOnNEP17PaymentValidatesCaller()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.cs");
            Assert.Contains("GAS.Hash", code);
            Assert.Contains("NEO.Hash", code);
        }

        [Fact]
        public void PlatformGameCountdownSettlementImmediatelyStartsNextRound()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Countdown.cs");

            Assert.Contains("StartNextCountdownRound(appId, nextRoundPot)", code);
            Assert.Contains("CD_NEXT_ROUND_SHARE_BPS", code);
            Assert.Contains("return LoadCountdownRound(appId, AppGetInt(appId, CD_PREFIX_ROUND_ID));", code);
        }
    }
}
