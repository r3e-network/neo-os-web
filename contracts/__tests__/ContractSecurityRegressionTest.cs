using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractSecurityRegressionTest
    {
        [Fact]
        public void PlatformSocialEnvelopeUsesUInt160ZeroForMissingCreator()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");
            Assert.DoesNotContain("envelope.Creator != null", code);
            Assert.Contains("UInt160.Zero", code);
        }

        [Fact]
        public void PlatformSocialSupportsBoundedGasPrizePools()
        {
            string contractCode = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.cs");
            string envelopeCode = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.Envelope.cs");

            ContractSourceAssertions.AssertHasPublicStruct(contractCode, "RangeGasPoolData");
            ContractSourceAssertions.AssertHasPublicStaticMethod(envelopeCode, "BigInteger", "CreateRangeGasPool");
            ContractSourceAssertions.AssertHasPublicStaticMethod(envelopeCode, "BigInteger", "ClaimRangeGasPool");
            ContractSourceAssertions.AssertHasPublicStaticMethod(envelopeCode, "BigInteger", "FundRangeGasPool");
            ContractSourceAssertions.AssertHasPublicStaticMethod(envelopeCode, "RangeGasPoolData", "GetRangeGasPool");
            ContractSourceAssertions.AssertHasPublicStaticMethod(envelopeCode, "bool", "HasClaimedRangeGasPool");

            Assert.Contains("minClaimAmount <= maxClaimAmount", envelopeCode);
            Assert.Contains("amount >= pool.MinClaimAmount", envelopeCode);
            Assert.Contains("amount <= pool.MaxClaimAmount", envelopeCode);
            Assert.Contains("already claimed", envelopeCode);
            Assert.Contains("AppKey(appId, PREFIX_RANGE_CLAIMER, poolId, claimer)", envelopeCode);
            Assert.DoesNotContain("AppKey(appId, PREFIX_RANGE_CLAIMER, claimer)", envelopeCode);
            Assert.Contains("RangeGasPoolFunded", contractCode);
            Assert.Contains("pool.Creator == creator", envelopeCode);
            Assert.Contains("pool.RemainingAmount + amount <= maxRemainingCapacity", envelopeCode);
        }

        [Fact]
        public void PlatformSocialExposesSafeGasCreditRecoveryForTwoStepPoolCreation()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformSocial", "PlatformSocial.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetDirectGasCredit");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "WithdrawGasCredit");
            Assert.Contains("Runtime.CheckWitness(user)", code);
            Assert.Contains("GasCreditWithdrawn", code);
        }

        [Fact]
        public void PlatformDeFiFlashLoanHasReentrancyGuard()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformDeFi", "PlatformDeFi.FlashLoan.cs");
            Assert.Contains("REENTRANCY", code.ToUpper());
        }

        [Fact]
        public void PlatformGameOnNEP17PaymentValidatesCaller()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.cs");
            Assert.Contains("GAS.Hash", code);
            Assert.Contains("NEO.Hash", code);
        }

        [Fact]
        public void PlatformGameCountdownSettlementImmediatelyStartsNextRound()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Countdown.cs");

            Assert.Contains("StartNextCountdownRound(appId, nextRoundPot)", code);
            Assert.Contains("CD_NEXT_ROUND_SHARE_BPS", code);
            Assert.Contains("return LoadCountdownRound(appId, AppGetInt(appId, CD_PREFIX_ROUND_ID));", code);
        }

        [Fact]
        public void PlatformGameDiceUsesMorpheusVrfAndRequestBinding()
        {
            string platform = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.cs");
            string dice = ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", "PlatformGame.Dice.cs");

            Assert.Contains("GameType_Dice", platform);
            Assert.Contains("ResolveDiceBetFromOracle", platform);
            Assert.Contains("RefundDiceBetFromOracle", platform);
            Assert.Contains("\"vrf_random\"", dice);
            Assert.Contains("StoreOracleRequestContext(requestId, appId, GameType_Dice, betId)", dice);
            Assert.Contains("ValidateDiceRequestMapping(appId, betId, requestId)", dice);
            Assert.Contains("requestId > 0", dice);
            Assert.Contains("oracle request mismatch", dice);
            Assert.Contains("RequireGameType(appId, GameType_Dice)", dice);
            Assert.DoesNotContain("ProcessAutomatedSettlement", dice);
        }

        [Fact]
        public void RestoredMiniAppBaseAllowsUpdatesButNoDestroy()
        {
            string code = ContractSourceAssertions.ReadSource("contracts", "MiniApp.DevPack", "MiniAppCompactBase.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "void", "Update");
            Assert.Contains("ValidateAdmin();", code);
            Assert.Contains("ContractManagement.Update", code);
            Assert.DoesNotContain("ContractManagement.Destroy", code);
            Assert.DoesNotContain("public static void Destroy", code);
        }
    }
}
