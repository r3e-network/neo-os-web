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
        public void PlatformSocialEnvelopeWrapsGASTransferInAssert()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            Assert.Contains("ExecutionEngine.Assert", code);
            Assert.Contains("GAS.Transfer", code);
        }
    }
}
