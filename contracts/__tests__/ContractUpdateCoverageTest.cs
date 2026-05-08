using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractUpdateCoverageTest
    {
        [Theory]
        [InlineData("PlatformAnchor")]
        [InlineData("PlatformDeFi")]
        [InlineData("PlatformGame")]
        [InlineData("PlatformSocial")]
        public void PlatformContractsExposeAdminGatedUpdate(string contractName)
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "platform",
                contractName,
                $"{contractName}.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "Update");
            Assert.Contains("ValidateAdmin();", code);
            Assert.Contains("ContractManagement.Update", code);
        }
    }
}
