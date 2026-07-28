using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractUpdateCoverageTest
    {
        [Theory]
        [InlineData("AppAccount")]
        [InlineData("PlatformAnchor")]
        [InlineData("PlatformDeFi")]
        [InlineData("PlatformGame")]
        [InlineData("PlatformRegistry")]
        [InlineData("PlatformSocial")]
        [InlineData("PlatformVesting")]
        [InlineData("PlatformEscrow")]
        public void PlatformContractsExposeAdminGatedUpdate(string contractName)
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory(
                "contracts",
                "platform",
                contractName);

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "Update");
            Assert.Contains("ValidateAdmin();", code);
            Assert.Contains("ContractManagement.Update", code);
        }
    }
}
