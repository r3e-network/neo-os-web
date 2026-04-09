using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractSecurityRegressionTest
    {
        [Fact]
        public void RedEnvelopeUsesUInt160ZeroForMissingCreator()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniAppRedEnvelope", "MiniAppRedEnvelope.cs");
            Assert.DoesNotContain("envelope.Creator != null", code);
            Assert.Contains("envelope.Creator != UInt160.Zero", code);
        }

        [Fact]
        public void StreamVestingClaimStreamUsesReentrancyGuard()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "StreamVesting", "StreamVesting.cs");
            Assert.Contains("EnterClaimGuard(instanceId, streamId)", code);
            Assert.Contains("ExitClaimGuard(instanceId, streamId)", code);
        }

        [Fact]
        public void StreamVestingDefinesClaimGuardStoragePrefix()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "StreamVesting", "StreamVesting.cs");
            Assert.Contains("PREFIX_CLAIM_GUARD", code);
        }
    }
}
