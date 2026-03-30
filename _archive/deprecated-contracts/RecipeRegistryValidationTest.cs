using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class RecipeRegistryValidationTest
    {
        [Fact]
        public void UpsertRecipeValidatesReferencedModulesAgainstModuleRegistry()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "RecipeRegistry",
                "RecipeRegistry.cs");

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*moduleRegistry\s*,\s*""getModule""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Contains("recipe binding requires module_id/version", code);
            Assert.Contains("duplicate recipe binding", code);
            Assert.Contains("recipe references unknown module", code);
            Assert.Contains("recipe references inactive module", code);
        }
    }
}
