using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppTemplateWarningsTest
    {
        [Theory]
        [InlineData("Template.Governance.cs")]
        [InlineData("Template.Lottery.cs")]
        [InlineData("Template.Prediction.cs")]
        public void TemplatesDoNotUseObsoleteRuntimeScriptContainer(string fileName)
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppTemplates",
                fileName);

            Assert.DoesNotContain("Runtime.ScriptContainer", code);
            Assert.Contains("Runtime.Transaction", code);
        }
    }
}
