using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractUpdateCoverageTest
    {
        [Theory]
        [InlineData("MiniAppEventTicketPass")]
        [InlineData("MiniAppMilestoneEscrow")]
        [InlineData("MiniAppQuadraticFunding")]
        [InlineData("MiniAppSoulboundCertificate")]
        public void DedicatedMiniAppContractsInheritAdminGatedUpdate(string contractName)
        {
            string contractCode = ContractSourceAssertions.ReadSource(
                "contracts",
                contractName,
                $"{contractName}.cs");
            string baseCode = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniApp.DevPack",
                "MiniAppCompactBase.cs");

            Assert.Contains(": MiniAppBase", contractCode);
            ContractSourceAssertions.AssertHasPublicStaticMethod(baseCode, "void", "Update");
            Assert.Contains("ValidateAdmin();", baseCode);
            Assert.Contains("ContractManagement.Update", baseCode);
        }

        [Theory]
        [InlineData("MiniAppEventTicketPass")]
        [InlineData("MiniAppMilestoneEscrow")]
        [InlineData("MiniAppQuadraticFunding")]
        [InlineData("MiniAppSoulboundCertificate")]
        public void DedicatedMiniAppContractsDoNotRequestWildcardNativeTokenPermissions(string contractName)
        {
            string contractCode = ContractSourceAssertions.ReadSource(
                "contracts",
                contractName,
                $"{contractName}.cs");

            Assert.DoesNotContain(
                "ContractPermission(\"0xd2a4cff31913016155e38e474a2c06d08be276cf\", \"*\")",
                contractCode);
            Assert.DoesNotContain(
                "ContractPermission(\"0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5\", \"*\")",
                contractCode);
        }

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
