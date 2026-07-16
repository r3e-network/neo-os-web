using System;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Source-security pins for the AppAccount treasury shim — the paths a
    /// TestEngine run cannot exercise (a FAULTing NEP-17 callback inside a real
    /// token transfer hangs the host) plus ordering and constant pins that keep
    /// the design's trust rules from silently regressing.
    /// </summary>
    public class AppAccountSourceSecurityTests
    {
        private static string CoreSource() =>
            ContractSourceAssertions.ReadSource("contracts", "platform", "AppAccount", "AppAccount.cs");

        private static string SpendSource() =>
            ContractSourceAssertions.ReadSource("contracts", "platform", "AppAccount", "AppAccount.Spend.cs");

        private static string AllSources() =>
            ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "AppAccount");

        [Fact]
        public void OnNep17Payment_AcceptOnly_GasOrNeoGate_NoOutboundTransfer_NoPauseGate()
        {
            string body = ExtractMethodBody(CoreSource(), "OnNEP17Payment");
            Assert.False(string.IsNullOrEmpty(body), "OnNEP17Payment body not found in AppAccount.cs");

            // v1 asset gate: GAS/NEO only, rejected before any state or event.
            Assert.Contains("only GAS or NEO accepted", body);
            Assert.Contains("GAS.Hash", body);
            Assert.Contains("NEO.Hash", body);

            // Accept-only: zero outbound transfers inside the callback.
            Assert.DoesNotMatch(new Regex(@"\.Transfer\s*\("), body);
            Assert.DoesNotContain("\"transfer\"", body);

            // Deliberately NO pause gate: pausing intake would FAULT the
            // from == null GAS-claim callback minted by every outbound NEO
            // movement and brick NEO exits.
            Assert.DoesNotContain("IsPaused", body);
            Assert.DoesNotContain("PREFIX_PAUSED", body);

            // Attribution event fires on every accepted deposit, and a null
            // `from` (native GAS claim) is tolerated rather than rejected.
            Assert.Contains("OnReceived(", body);
            Assert.Contains("from == null", body);
        }

        [Fact]
        public void ExecuteTransfer_RegistryGateComesBeforePauseAndTransfer()
        {
            string body = ExtractMethodBody(SpendSource(), "ExecuteTransfer");
            Assert.False(string.IsNullOrEmpty(body), "ExecuteTransfer body not found in AppAccount.Spend.cs");

            Assert.Contains("Runtime.CallingScriptHash == RegistryOf()", body);
            int registryGate = body.IndexOf("registry only", StringComparison.Ordinal);
            int pauseGate = body.IndexOf("account paused", StringComparison.Ordinal);
            int transfer = body.IndexOf("TransferAsset(", StringComparison.Ordinal);
            Assert.True(registryGate >= 0 && pauseGate >= 0 && transfer >= 0,
                "expected registry gate, pause gate, and transfer in ExecuteTransfer");
            Assert.True(registryGate < pauseGate && pauseGate < transfer,
                "ExecuteTransfer must gate caller==registry first, then pause, then move funds");
        }

        [Fact]
        public void EscapeExecute_WitnessThenRegistryPauseConsultThenRoleBoundExit()
        {
            string body = ExtractMethodBody(SpendSource(), "EscapeExecute");
            Assert.False(string.IsNullOrEmpty(body), "EscapeExecute body not found in AppAccount.Spend.cs");

            int witness = body.IndexOf("Runtime.CheckWitness(admin)", StringComparison.Ordinal);
            int consult = body.IndexOf("getGlobalPause", StringComparison.Ordinal);
            int window = body.IndexOf("escape window not open", StringComparison.Ordinal);
            int transfer = body.IndexOf("TransferAsset(asset, admin, amount)", StringComparison.Ordinal);
            Assert.True(witness >= 0, "escape hatch must demand the app admin witness");
            Assert.True(consult >= 0, "escape hatch must consult the registry's getGlobalPause read");
            Assert.True(window >= 0, "escape hatch must enforce the timelock window");
            Assert.True(transfer >= 0, "escape destination must be the stored app admin (role-bound)");
            Assert.True(witness < consult && consult < window && window < transfer,
                "EscapeExecute ordering: witness -> pause consult -> window check -> transfer");

            // Pause-immunity: the local paused flag must NOT gate the exit.
            Assert.DoesNotContain("IsPaused", body);
            Assert.DoesNotContain("account paused", body);
        }

        [Fact]
        public void EscapeTimelock_MirrorsFrameworkAaEscapeConstant()
        {
            // framework/utils/aa-account.ts:18 pins 30 days (seconds); the
            // contract carries the same window in milliseconds.
            string framework = ContractSourceAssertions.ReadSource("framework", "utils", "aa-account.ts");
            Assert.Contains("AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS = 30 * 24 * 60 * 60", framework);

            const long expectedMs = 30L * 24 * 60 * 60 * 1000;
            Assert.Equal(2_592_000_000L, expectedMs);
            Assert.Contains("ESCAPE_TIMELOCK_MS = 2_592_000_000", SpendSource());
        }

        [Fact]
        public void RegistryPauseReadAbi_IsPinnedInSource()
        {
            // The registry contract (Stage B) must ship this exact [Safe] read:
            //   getGlobalPause() -> [paused(bool), pausedAt(ms)]
            string spend = SpendSource();
            Assert.Contains("\"getGlobalPause\"", spend);
            Assert.Contains("[paused(bool), pausedAt(ms)]", spend);
            Assert.Contains("CallFlags.ReadOnly", spend);
        }

        [Fact]
        public void Update_IsRegistryGated_AndNoDestroyExists()
        {
            string all = AllSources();
            ContractSourceAssertions.AssertHasPublicStaticMethod(all, "void", "Update");
            Assert.Contains("ValidateAdmin();", all);
            Assert.Contains("ContractManagement.Update", all);
            Assert.DoesNotContain("ContractManagement.Destroy", all);

            // The update authority IS the registry caller: platform timelock and
            // per-app consent are enforced registry-side before the relay.
            string gate = ExtractMethodBody(SpendSource(), "ValidateAdmin");
            Assert.Contains("Runtime.CallingScriptHash == RegistryOf()", gate);
            Assert.Contains("registry only", gate);
        }

        [Fact]
        public void NoFreeDestinationParameterAnywhere()
        {
            // Fleet invariant: destinations are role-bound; the literal free
            // destination parameter is banned across all AppAccount partials.
            Assert.DoesNotContain("UInt160 recipient", AllSources());
        }

        [Fact]
        public void ContractPermissions_AreNarrow()
        {
            string core = CoreSource();
            Assert.DoesNotContain("ContractPermission(\"*\", \"*\")", core);
            // Named-method grants only: native transfers, the registry pause
            // read, and ContractManagement.update.
            Assert.Contains("[ContractPermission(\"0xd2a4cff31913016155e38e474a2c06d08be276cf\", \"transfer\")]", core);
            Assert.Contains("[ContractPermission(\"0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5\", \"transfer\")]", core);
            Assert.Contains("[ContractPermission(\"0xfffdc93764dbaddd97c48f252a53ea4643faa3fd\", \"update\")]", core);
            Assert.Contains("[ContractPermission(\"*\", \"getGlobalPause\")]", core);
        }

        // Brace-balanced body extraction (the OnNep17PaymentConventionTests idiom).
        private static string ExtractMethodBody(string source, string methodName)
        {
            var signature = new Regex(
                @"\b" + Regex.Escape(methodName) + @"\s*\([^)]*\)\s*\{",
                RegexOptions.Compiled);
            Match m = signature.Match(source);
            if (!m.Success) return string.Empty;

            int open = source.IndexOf('{', m.Index);
            if (open < 0) return string.Empty;

            int depth = 0;
            for (int i = open; i < source.Length; i++)
            {
                char c = source[i];
                if (c == '{') depth++;
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0) return source.Substring(open, i - open + 1);
                }
            }
            return string.Empty;
        }
    }
}
