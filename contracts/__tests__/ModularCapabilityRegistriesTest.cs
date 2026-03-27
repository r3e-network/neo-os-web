using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ModularCapabilityRegistriesTest
    {
        [Fact]
        public void ModuleRegistryExposesExpectedSkeletonApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "ModuleRegistry",
                "ModuleRegistry.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "ModuleRegistry");
            ContractSourceAssertions.AssertHasPublicStruct(code, "ModuleInfo");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "ModuleId");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "Version");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "ContractHash");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "InitSchemaHash");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "OperationSchemaHash");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "Active");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "ModuleInfo", "GetModule");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "UInt160", "ResolveModuleHash");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "UpsertModule");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetModuleActive");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAdmin");
        }

        [Fact]
        public void RecipeRegistryExposesExpectedSkeletonApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "RecipeRegistry",
                "RecipeRegistry.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "RecipeRegistry");
            ContractSourceAssertions.AssertHasPublicStruct(code, "RecipeInfo");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "RecipeId");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "Version");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "ModuleRefs");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "AllowedRuntimeMode");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "RouterTemplateId");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "Active");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "RecipeInfo", "GetRecipe");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "UpsertRecipe");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetRecipeActive");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetModuleRegistry");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAdmin");
        }

        [Fact]
        public void MiniAppInstanceRegistryExposesExpectedSkeletonApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppInstanceRegistry",
                "MiniAppInstanceRegistry.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "MiniAppInstanceRegistry");
            ContractSourceAssertions.AssertHasPublicStruct(code, "InstanceInfo");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "InstanceId");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "RecipeId");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "RecipeVersion");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "RuntimeMode");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "RouterContract");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "ModuleBindings");
            ContractSourceAssertions.AssertHasPublicField(code, "MiniAppInstanceStatus", "Status");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "UpgradePending");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "InstanceInfo", "GetInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "RegisterInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetInstanceStatus");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "BindRouterContract");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAppRegistry");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetRecipeRegistry");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetModuleRegistry");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "SetAdmin");
        }

    }
}
