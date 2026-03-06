using System.IO;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppTemplateBaseTest
    {
        [Fact]
        public void TemplateBaseSourceFileExists()
        {
            string path = ContractSourceAssertions.ResolveRelativeSource(
                "contracts",
                "MiniAppTemplates",
                "MiniAppTemplate.Base.cs");

            Assert.Equal(
                Path.Combine(
                    ContractSourceAssertions.FindRepoRoot(),
                    "contracts",
                    "MiniAppTemplates",
                    "MiniAppTemplate.Base.cs"),
                path);
        }

        [Fact]
        public void TemplateBaseExposesConfigurationApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppTemplates",
                "MiniAppTemplate.Base.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "TemplateConfig", "GetConfig");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "ByteString", "GetRawConfig");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "OperationDef[]", "GetOperations");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "OperationDef", "GetOperation");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "bool", "HasPermission");
        }

        [Fact]
        public void TemplateBaseDefinesOperationAndPermissionShapes()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppTemplates",
                "MiniAppTemplate.Base.cs");

            ContractSourceAssertions.AssertHasPublicStruct(code, "TemplateConfig");
            ContractSourceAssertions.AssertHasPublicStruct(code, "OperationDef");
            ContractSourceAssertions.AssertHasPublicStruct(code, "Permission");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "Operations");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "RequiresWitness");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "Key");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "Enabled");
        }

        [Fact]
        public void TemplateBaseSeedsAdminFromDeployerOnFirstInitialization()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppTemplates",
                "MiniAppTemplate.Base.cs");

            Assert.Contains(
                "Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, sender);",
                code);
        }
    }
}
