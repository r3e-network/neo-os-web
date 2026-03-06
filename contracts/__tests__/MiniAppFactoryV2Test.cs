using System.IO;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppFactoryV2Test
    {
        [Fact]
        public void FactorySourceFileExists()
        {
            string path = ContractSourceAssertions.ResolveRelativeSource(
                "contracts",
                "MiniAppFactoryV2",
                "MiniAppFactoryV2.cs");

            Assert.Equal(
                Path.Combine(
                    ContractSourceAssertions.FindRepoRoot(),
                    "contracts",
                    "MiniAppFactoryV2",
                    "MiniAppFactoryV2.cs"),
                path);
        }

        [Fact]
        public void FactoryDeclaresExpectedContractType()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppFactoryV2",
                "MiniAppFactoryV2.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "MiniAppFactoryV2");
        }

        [Fact]
        public void FactoryExposesTemplateCrudAndDeploymentApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppFactoryV2",
                "MiniAppFactoryV2.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "TemplateInfo", "GetTemplate");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "UpsertTemplate");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "UInt160", "DeployFromTemplate");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "string[]", "GetAllCategories");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAppRegistry");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAdmin");
        }

        [Fact]
        public void FactoryDefinesTemplateInfoSchemaFields()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppFactoryV2",
                "MiniAppFactoryV2.cs");

            ContractSourceAssertions.AssertHasPublicStruct(code, "TemplateInfo");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "ConfigSchema");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "UiSchema");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "NefHash");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "ManifestHash");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "Active");
        }
    }
}
