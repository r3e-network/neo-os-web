using System;
using System.IO;
using System.Linq;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppTarotVrfSourceSecurityTests
    {
        private static readonly string RepoRoot = ContractSourceAssertions.FindRepoRoot();
        private static readonly string ContractDir = Path.Combine(RepoRoot, "contracts", "MiniAppTarotVrf");

        private static string Source() => string.Join(
            "\n",
            Directory.GetFiles(ContractDir, "*.cs")
                .OrderBy(path => path, StringComparer.Ordinal)
                .Select(File.ReadAllText));

        [Fact]
        public void RandomnessAndCallbackBindingsRemainFailClosed()
        {
            string source = Source();
            Assert.DoesNotContain("Runtime.GetRandom", source, StringComparison.Ordinal);
            Assert.Contains("REQUEST_TYPE = \"vrf_random\"", source, StringComparison.Ordinal);
            Assert.Contains("Runtime.CallingScriptHash == Oracle()", source, StringComparison.Ordinal);
            Assert.Contains("reading.RequestId == requestId", source, StringComparison.Ordinal);
            Assert.Contains("ReadingForRequest(requestId) == readingId", source, StringComparison.Ordinal);
            Assert.Contains("reading.Network == (BigInteger)Runtime.GetNetwork()", source, StringComparison.Ordinal);
            Assert.Contains("PAYLOAD_DOMAIN", source, StringComparison.Ordinal);
            Assert.Contains("ComputeRequestPayloadHash", source, StringComparison.Ordinal);
            Assert.Contains("reading.PayloadHash == expectedPayloadHash", source, StringComparison.Ordinal);
            Assert.Contains("ActiveReadingInternal(reading.Player) == readingId", source, StringComparison.Ordinal);
            Assert.Contains("RequestIdSeenInternal(requestId)", source, StringComparison.Ordinal);
            Assert.Contains("CryptoLib.Sha256((ByteString)boundInput)", source, StringComparison.Ordinal);
        }

        [Fact]
        public void LegacyAdapterIsPinnedToCanonicalTestnetOnly()
        {
            string source = Source();
            Assert.Contains("NTT7sxdJmf24HWy11mxAjD8YCifcYZMvLT", source, StringComparison.Ordinal);
            Assert.Contains("Runtime.GetNetwork() == 894710606", source, StringComparison.Ordinal);
            Assert.Contains("Oracle() == LegacyTestnetOracle", source, StringComparison.Ordinal);
            Assert.Contains("ExecutionEngine.Assert(IsLegacyTestnetOracle(), \"legacy callback disabled\")",
                source, StringComparison.Ordinal);
            Assert.Contains("LEGACY_CALLBACK_METHOD = \"onOracleResult\"", source, StringComparison.Ordinal);
            Assert.Contains("RICH_CALLBACK_METHOD = \"onMiniAppResult\"", source, StringComparison.Ordinal);
            Assert.Contains("IsLegacyTestnetOracle()\n                ? LEGACY_CALLBACK_METHOD\n                : RICH_CALLBACK_METHOD",
                source, StringComparison.Ordinal);
            Assert.DoesNotContain("#if", source, StringComparison.Ordinal);
            Assert.DoesNotContain("Neo.SmartContract.Testing", source, StringComparison.Ordinal);
        }

        [Fact]
        public void CardSelectionUsesRejectionSamplingWithoutBiasedFallback()
        {
            string callback = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Callback.cs"));
            int limit = callback.IndexOf("acceptanceLimit = 65536 - (65536 % remaining)", StringComparison.Ordinal);
            int reject = callback.IndexOf("candidate >= acceptanceLimit", StringComparison.Ordinal);
            int modulo = callback.IndexOf("candidate % remaining", StringComparison.Ordinal);
            Assert.True(limit >= 0 && reject > limit && modulo > reject,
                "16-bit candidates must be rejected above the largest exact multiple before modulo reduction");
        }

        [Fact]
        public void CallbackSettlementEnforcesTheAdvertisedExpiry()
        {
            string callback = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Callback.cs"));
            int resolveIndex = callback.IndexOf("internal static void ResolveCallback(", StringComparison.Ordinal);
            int lockIndex = callback.IndexOf("AcquireLock();", resolveIndex, StringComparison.Ordinal);
            int expiryIndex = callback.IndexOf(
                "Runtime.Time >= reading.RequestedAt + READING_EXPIRY_MS",
                resolveIndex,
                StringComparison.Ordinal);
            int resultIndex = callback.IndexOf(
                "if (!success || result == null || result.Length != 32)",
                resolveIndex,
                StringComparison.Ordinal);

            Assert.True(resolveIndex >= 0 && lockIndex > resolveIndex
                    && expiryIndex > lockIndex && resultIndex > expiryIndex,
                "the common callback path must refund an expired reading before interpreting any Oracle result");
            Assert.Contains("STATUS_EXPIRED_REFUNDED", callback, StringComparison.Ordinal);
            Assert.Contains("\"oracle timeout\"", callback, StringComparison.Ordinal);
        }

        [Fact]
        public void FeeLiabilitiesAndExternalInteractionsStaySeparated()
        {
            string funds = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Funds.cs"));
            string request = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Request.cs"));
            Assert.Contains("CREDIT_MEMO", funds, StringComparison.Ordinal);
            Assert.Contains("ORACLE_MEMO", funds, StringComparison.Ordinal);
            Assert.Contains("amount % READING_FEE == 0", funds, StringComparison.Ordinal);
            Assert.Contains("AcquireLock();", request, StringComparison.Ordinal);
            Assert.True(
                request.IndexOf("AcquireLock();", StringComparison.Ordinal)
                    < request.IndexOf("ReadOracleRequestFee(oracle)", StringComparison.Ordinal),
                "request lock must be held before the first dynamic Oracle fee call");
            Assert.Contains("PutInteger(PREFIX_PENDING_FEES", request, StringComparison.Ordinal);
            Assert.Contains("GAS.Transfer", request, StringComparison.Ordinal);
            Assert.Contains("requestFromCallback", request, StringComparison.Ordinal);
        }

        [Fact]
        public void AdminAndUpgradePathsKeepProductionSafetyInterlocks()
        {
            string admin = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Admin.cs"));
            string funds = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Funds.cs"));
            string storage = File.ReadAllText(Path.Combine(ContractDir, "MiniAppTarotVrf.Storage.cs"));
            Assert.Contains("internal static void ValidateNotBusy()", storage, StringComparison.Ordinal);
            Assert.Contains("ValidateNotBusy();\n            UInt160 admin = Admin();", storage, StringComparison.Ordinal);
            Assert.Contains("public static void AcceptAdmin()\n        {\n            ValidateNotBusy();",
                admin, StringComparison.Ordinal);
            Assert.Contains("public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)\n        {\n            ValidateNotBusy();",
                funds, StringComparison.Ordinal);
            Assert.Contains("Runtime.CheckWitness(pending)", admin, StringComparison.Ordinal);
            Assert.Contains("Runtime.Time + CHANGE_DELAY_MS", admin, StringComparison.Ordinal);
            Assert.Contains("ExecutionEngine.Assert(IsPaused(), \"pause required\")", admin, StringComparison.Ordinal);
            Assert.Contains("ExecutionEngine.Assert(PendingCount() == 0, \"pending readings exist\")",
                admin, StringComparison.Ordinal);
            Assert.Contains("expectedNef == CryptoLib.Sha256(nef)", admin, StringComparison.Ordinal);
            Assert.Contains("expectedManifest == CryptoLib.Sha256((ByteString)manifest)",
                admin, StringComparison.Ordinal);
        }
    }
}
