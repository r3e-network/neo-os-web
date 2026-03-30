using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ServiceGatewayRegistryEnforcementTest
    {
        [Fact]
        public void ServiceGatewayChecksModuleRegistryForActiveModules()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "ServiceGateway",
                "ServiceGateway.cs");

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*moduleRegistry\s*,\s*""isModuleActive""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.DoesNotMatch(
                new Regex(@"ValidateModuleRegistered[\s\S]*?ContractManagement\.GetContract\(moduleHash\)", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);
        }

        [Fact]
        public void ServiceGatewayChecksInstanceDeclaredBindingAgainstResolvedModuleHash()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "ServiceGateway",
                "ServiceGateway.cs");

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*instanceRegistry\s*,\s*""resolveModuleBinding""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*moduleRegistry\s*,\s*""resolveModuleHash""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"ExecutionEngine\.Assert\(\s*expectedModuleHash\s*==\s*moduleHash", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);
        }

        [Fact]
        public void ServiceGatewayChecksBindingAgainstInstanceRecipe()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "ServiceGateway",
                "ServiceGateway.cs");

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*instanceRegistry\s*,\s*""recipeRegistry""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"Contract\.Call\(\s*recipeRegistry\s*,\s*""resolveRecipeBinding""", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);

            Assert.Matches(
                new Regex(@"ExecutionEngine\.Assert\(\s*recipeBindingRef\s*!=\s*null\s*&&\s*recipeBindingRef\.Length\s*==\s*2", RegexOptions.Multiline | RegexOptions.CultureInvariant),
                code);
        }
    }
}
