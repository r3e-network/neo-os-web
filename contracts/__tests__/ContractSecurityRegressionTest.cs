using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractSecurityRegressionTest
    {
        // -----------------------------------------------------------------
        // Audit-fix regression tests — these assertions pin source patterns
        // so a refactor cannot silently strip a Critical-tier guard.
        // -----------------------------------------------------------------

        [Fact]
        public void AuditFixC2_QuadraticFundingBlocksSelfContribute()
        {
            // Audit fix C-2: round creator and project owner are prohibited from
            // contributing. The guard sits in MiniAppQuadraticFunding.Projects.cs
            // alongside an audit-fix comment for traceability.
            string projects = ContractSourceAssertions.ReadSource(
                "contracts", "MiniAppQuadraticFunding", "MiniAppQuadraticFunding.Projects.cs");
            Assert.Contains("contributor != project.Owner", projects);
            Assert.Contains("contributor != round.Creator", projects);
            Assert.Contains("owner cannot contribute", projects);
            Assert.Contains("round creator cannot contribute", projects);

            // FinalizeRound must reject the round creator as a finalizer — only the
            // gateway or platform admin may finalize.
            string methods = ContractSourceAssertions.ReadSource(
                "contracts", "MiniAppQuadraticFunding", "MiniAppQuadraticFunding.Methods.cs");
            Assert.Contains("fromGateway || Runtime.CheckWitness(Admin())", methods);
            Assert.DoesNotContain(
                "fromGateway || Runtime.CheckWitness(round.Creator) || Runtime.CheckWitness(Admin())",
                methods);
        }

        [Fact]
        public void AuditFixC4_MiniAppIframesAreSandboxed()
        {
            // Audit fix C-4: miniapp iframes must declare a `sandbox` attribute that
            // omits `allow-same-origin`. Both PlayAreaShared.tsx and PlayAreaMedia.tsx
            // render miniapps; both must carry the attribute.
            string shared = ContractSourceAssertions.ReadSource(
                "platform", "host-app", "components", "playarea", "PlayAreaShared.tsx");
            string media = ContractSourceAssertions.ReadSource(
                "platform", "host-app", "components", "playarea", "PlayAreaMedia.tsx");

            // Required: sandbox declared with allow-scripts (the miniapp needs JS).
            Assert.Contains("sandbox=\"allow-scripts", shared);
            Assert.Contains("sandbox=\"allow-scripts", media);
            // Forbidden inside the sandbox attribute itself: allow-same-origin
            // would defeat the sandbox by giving the miniapp access to
            // window.parent.* and the host's auth tokens. The comment above
            // each iframe may mention "allow-same-origin" while explaining the
            // omission, so the check inspects only the lines that begin with
            // `sandbox=`.
            AssertSandboxLineExcludesSameOrigin(shared);
            AssertSandboxLineExcludesSameOrigin(media);
        }

        private static void AssertSandboxLineExcludesSameOrigin(string source)
        {
            foreach (string line in source.Split('\n'))
            {
                string trimmed = line.TrimStart();
                if (!trimmed.StartsWith("sandbox=\"")) continue;
                Assert.DoesNotContain("allow-same-origin", trimmed);
            }
        }

        [Fact]
        public void AuditFixH3_HostSdkRefusesBrowserConstruction()
        {
            // Audit fix H-4 (aka the audit's H-3-adjacent SDK boundary fix):
            // createHostSDK must call assertHostSdkServerContext() to refuse
            // construction in a browser. Without this guard, a developer mistake
            // bundling host-SDK code into the client would leak the API key to
            // every miniapp.
            string client = ContractSourceAssertions.ReadSource(
                "platform", "sdk", "src", "client.ts");
            Assert.Contains("assertHostSdkServerContext", client);
            Assert.Contains("createHostSDK is server-only", client);
            Assert.Contains("typeof window === \"undefined\"", client);
        }

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
            string contractCode = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformSocial");
            string envelopeCode = ContractSourceAssertions.ReadSourcesByPattern("PlatformSocial.Envelope*.cs", "contracts", "platform", "PlatformSocial");

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
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformSocial");
            string ledger = ContractSourceAssertions.ReadSource("contracts", "MiniApp.DevPack", "MiniAppCreditLedger.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetDirectGasCredit");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "WithdrawGasCredit");
            Assert.Contains("Runtime.CheckWitness(user)", code);
            Assert.Contains("GasCreditWithdrawn", code);
            Assert.Contains("MiniAppCreditLedger.RequireCreditAppId(data)", code);
            Assert.Contains("return RequireAppIdWithSuffix(data, \":credit\")", ledger);
            Assert.Contains("memo.Substring(0, separator) + suffix", ledger);
            Assert.Contains("AppKey(appId, PREFIX_DIRECT_GAS_CREDIT, payer)", code);
            Assert.Contains("PREFIX_TOTAL_GAS_CREDIT_LIABILITY", code);
            Assert.Contains("PREFIX_TOTAL_NEO_CREDIT_LIABILITY", code);
            Assert.DoesNotContain("new StorageMap(Storage.CurrentContext, PREFIX_DIRECT_GAS_CREDIT)", code);
        }

        [Fact]
        public void PlatformDeFiScopesDirectCreditAndLiabilitiesByTenant()
        {
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformDeFi");
            string ledger = ContractSourceAssertions.ReadSource("contracts", "MiniApp.DevPack", "MiniAppCreditLedger.cs");

            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetDirectNeoCredit");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "GetDirectGasCredit");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "WithdrawNeoCredit");
            ContractSourceAssertions.AssertHasPublicStaticMethod(code, "BigInteger", "WithdrawGasCredit");
            Assert.Contains("MiniAppCreditLedger.RequireCreditAppId(data)", code);
            Assert.Contains("return RequireAppIdWithSuffix(data, \":credit\")", ledger);
            Assert.Contains("memo.Substring(0, separator) + suffix", ledger);
            Assert.Contains("AppKey(appId, PREFIX_NEO_CREDIT, payer)", code);
            Assert.Contains("AppKey(appId, PREFIX_GAS_CREDIT, payer)", code);
            Assert.Contains("PREFIX_APP_NEO_CREDIT_LIABILITY", code);
            Assert.Contains("PREFIX_APP_GAS_CREDIT_LIABILITY", code);
            Assert.Contains("PREFIX_TOTAL_NEO_CREDIT_LIABILITY", code);
            Assert.Contains("PREFIX_TOTAL_GAS_CREDIT_LIABILITY", code);
            Assert.DoesNotContain("new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT)", code);
            Assert.DoesNotContain("new StorageMap(Storage.CurrentContext, PREFIX_GAS_CREDIT)", code);
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
            string code = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformGame");
            Assert.Contains("GAS.Hash", code);
            // GAS-only intake (audit low: NEO was credited 1:1 into the
            // GAS-denominated ledger, silently destroying payer value).
            Assert.Contains("caller == GAS.Hash, \"only GAS accepted\"", code);
            Assert.DoesNotContain("caller == NEO.Hash", code);
        }

        [Fact]
        public void PlatformGameCountdownSettlementImmediatelyStartsNextRound()
        {
            string code = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Countdown*.cs", "contracts", "platform", "PlatformGame");

            Assert.Contains("StartNextCountdownRound(appId, nextRoundPot)", code);
            Assert.Contains("CD_NEXT_ROUND_SHARE_BPS", code);
            Assert.Contains("return LoadCountdownRound(appId, AppGetInt(appId, CD_PREFIX_ROUND_ID));", code);
        }

        [Fact]
        public void PlatformGameDiceUsesMorpheusVrfAndRequestBinding()
        {
            string platform = ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformGame");
            // Audit fix M-4/M-5: dice limit + storage helpers moved into
            // PlatformGame.Dice.Internal.cs to keep the main file under the 300-line
            // reviewability budget. The security invariants still hold; they're
            // just split across two partials now, so this test reads both.
            string dice = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Dice*.cs", "contracts", "platform", "PlatformGame");

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
        public void PlatformGameGachaSettlementDoesNotUseRefPrizeStruct()
        {
            string gacha = ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.Gacha*.cs", "contracts", "platform", "PlatformGame");

            Assert.DoesNotContain("ref selectedItem", gacha);
            Assert.Contains("selectedAssetType", gacha);
            Assert.Contains("selectedAssetHash", gacha);
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
