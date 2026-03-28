using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppInstanceRegistryValidationTest
    {
        [Fact]
        public void RegisterInstanceValidatesRecipeAndModuleCompatibility()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppInstanceRegistry",
                "MiniAppInstanceRegistry.cs");

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*recipeRegistry\s*,\s*""getRecipe""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*recipeRegistry\s*,\s*""resolveRecipeBinding""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*moduleRegistry\s*,\s*""getModule""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Contains("recipe not active", code);
            Assert.Contains("runtime mode not allowed", code);
            Assert.Contains("missing required binding", code);
            Assert.Contains("unexpected binding", code);
            Assert.Contains("binding references inactive module", code);
        }
    }
}
