using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class SharedModeModulesTest
    {
        [Fact]
        public void FundingVaultExposesInstanceScopedVaultApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "FundingVault",
                "FundingVault.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "FundingVault");
            ContractSourceAssertions.AssertHasPublicStruct(code, "InstanceInfo");
            ContractSourceAssertions.AssertHasPublicField(code, "string", "InstanceId");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "Owner");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "Operator");
            ContractSourceAssertions.AssertHasPublicField(code, "ByteString", "Config");
            ContractSourceAssertions.AssertHasPublicField(code, "bool", "Active");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "InstanceInfo", "GetInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetPendingBalance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetLockedBalance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "InitializeInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "LockFunds");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "ReleaseFunds");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "RefundFunds");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "WithdrawPendingFunds");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "OnNEP17Payment");
        }

        [Fact]
        public void StreamVestingExposesSharedRecurringStreamApi()
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "StreamVesting",
                "StreamVesting.cs");

            ContractSourceAssertions.AssertHasPublicClass(code, "StreamVesting");
            ContractSourceAssertions.AssertHasPublicStruct(code, "InstanceInfo");
            ContractSourceAssertions.AssertHasPublicStruct(code, "StreamData");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "FundingVault");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "Creator");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "Beneficiary");
            ContractSourceAssertions.AssertHasPublicField(code, "UInt160", "Asset");
            ContractSourceAssertions.AssertHasPublicField(code, "BigInteger", "TotalAmount");
            ContractSourceAssertions.AssertHasPublicField(code, "BigInteger", "ReleasedAmount");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "InstanceInfo", "GetInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "TotalStreams");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "StreamData", "GetStream");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetClaimable");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "Map<string, object>", "GetStreamDetails");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "InitializeInstance");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "CreateStream");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "ClaimStream");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "CancelStream");
        }
    }
}
