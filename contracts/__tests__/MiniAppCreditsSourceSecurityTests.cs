using System;
using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Source-level security pins for MiniAppCredits. These complement the
    /// TestEngine suite because a GAS transfer whose OnNEP17Payment callback
    /// FAULTs (dust / wrong memo / paused) hangs the TestEngine host, so the
    /// purchase-rejection guards are pinned here at source level instead. They
    /// also freeze the custody-model invariants (spend-only settlement deltas,
    /// pause-immune exit, solvency-guarded owner withdrawal) against refactors.
    /// </summary>
    public class MiniAppCreditsSourceSecurityTests
    {
        private static readonly string RepoRoot = ContractSourceAssertions.FindRepoRoot();
        private static readonly string ContractDir = Path.Combine(RepoRoot, "contracts", "MiniAppCredits");

        private static string Source(string file) => File.ReadAllText(Path.Combine(ContractDir, file));

        [Fact]
        public void PurchaseCallbackIsPauseGatedGasOnlyAndCreditOnly()
        {
            string core = Source("MiniAppCredits.cs");
            string body = ExtractMethodBody(core, "OnNEP17Payment");
            Assert.False(string.IsNullOrEmpty(body), "OnNEP17Payment body not found");

            // Pause gate FIRST: a paused purchase FAULTs before any other check,
            // so the transfer reverts and the buyer keeps their GAS.
            int paused = body.IndexOf("\"contract paused\"", StringComparison.Ordinal);
            int gasOnly = body.IndexOf("Runtime.CallingScriptHash == GAS.Hash", StringComparison.Ordinal);
            Assert.True(paused >= 0 && gasOnly > paused,
                "the pause gate must run before the GAS-caller gate in OnNEP17Payment");

            // GAS only, memo-gated, dust-rejected, floor rate.
            Assert.Contains("(string)data == BUY_MEMO", body, StringComparison.Ordinal);
            Assert.Contains("amount / GAS_PER_CREDIT", body, StringComparison.Ordinal);
            Assert.Contains("credits >= 1", body, StringComparison.Ordinal);
            Assert.Contains("BUY_MEMO = \"miniapp-credits:buy\"", core, StringComparison.Ordinal);

            // CREDIT ONLY: no outbound transfer inside the callback (also
            // enforced fleet-wide by OnNep17PaymentConventionTests).
            Assert.False(Regex.IsMatch(body, @"\.Transfer\s*\(") || body.Contains("\"transfer\""),
                "OnNEP17Payment must not move funds");
        }

        [Fact]
        public void PurchaseRateConstantsStayFixed()
        {
            string core = Source("MiniAppCredits.cs");
            Assert.Contains("CREDITS_PER_GAS = 50", core, StringComparison.Ordinal);
            Assert.Contains("GAS_PER_CREDIT = 2_000_000", core, StringComparison.Ordinal);
        }

        [Fact]
        public void SettlementIsOperatorGatedSpendOnlyMonotonicAndBounded()
        {
            string settlement = Source("MiniAppCredits.Settlement.cs");
            string body = ExtractMethodBody(settlement, "PostSettlement");
            Assert.False(string.IsNullOrEmpty(body), "PostSettlement body not found");

            Assert.Contains("ExecutionEngine.Assert(!IsPaused(), \"contract paused\")", body, StringComparison.Ordinal);
            Assert.Contains("ValidateOperator();", body, StringComparison.Ordinal);
            // Monotonic, gap-free epochs kill replays and reordering.
            Assert.Contains("epoch == current + 1", body, StringComparison.Ordinal);
            // Spend-only deltas: a compromised settler key cannot mint exitable
            // credits, so it can never drain the contract's GAS through Exit.
            Assert.Contains("delta < 0", body, StringComparison.Ordinal);
            // Bounded batches keep one call inside tx script / stack limits.
            Assert.Contains("users.Length > 0 && users.Length <= MAX_BATCH", body, StringComparison.Ordinal);
            // Overspend clamps instead of aborting the whole checkpoint.
            Assert.Contains("balance < spend ? balance : spend", body, StringComparison.Ordinal);
        }

        [Fact]
        public void ExitStaysLiveWhilePausedWithEffectsBeforeTransfer()
        {
            string settlement = Source("MiniAppCredits.Settlement.cs");
            string body = ExtractMethodBody(settlement, "Exit");
            Assert.False(string.IsNullOrEmpty(body), "Exit body not found");

            // The user escape hatch must NOT be pause-gated: a pause can never
            // trap user funds.
            Assert.DoesNotContain("IsPaused", body, StringComparison.Ordinal);
            Assert.Contains("Runtime.CheckWitness(user)", body, StringComparison.Ordinal);
            Assert.Contains("credits * GAS_PER_CREDIT", body, StringComparison.Ordinal);

            // Checks-effects-interactions: the balance is deleted before the
            // outbound GAS transfer, so reentrancy sees zero and aborts.
            int delete = body.IndexOf("Storage.Delete", StringComparison.Ordinal);
            int transfer = body.IndexOf("Contract.Call(GAS.Hash, \"transfer\"", StringComparison.Ordinal);
            Assert.True(delete >= 0 && transfer > delete,
                "Exit must zero the balance before transferring GAS");
        }

        [Fact]
        public void OwnerWithdrawalIsSolvencyGuardedAndUpgradeIsOwnerGated()
        {
            string admin = Source("MiniAppCredits.Admin.cs");

            // The owner can only sweep the surplus above the exit liability, so
            // every settled credit stays redeemable for GAS at the fixed rate.
            string withdraw = ExtractMethodBody(admin, "WithdrawGas");
            Assert.Contains("ValidateOwner();", withdraw, StringComparison.Ordinal);
            Assert.Contains("PREFIX_TOTAL_CREDITS) * GAS_PER_CREDIT", withdraw, StringComparison.Ordinal);
            Assert.Contains("held - amount >= liability", withdraw, StringComparison.Ordinal);

            string update = ExtractMethodBody(admin, "Update");
            Assert.Contains("ValidateOwner();", update, StringComparison.Ordinal);
            Assert.Contains("ContractManagement.Update", update, StringComparison.Ordinal);

            // No self-destruct path anywhere in the contract.
            foreach (string file in Directory.GetFiles(ContractDir, "*.cs"))
            {
                Assert.DoesNotContain("ContractManagement.Destroy", File.ReadAllText(file), StringComparison.Ordinal);
            }
        }

        // Brace-balanced body (including outer braces) of the named method, or
        // "" when missing — same extraction approach as the fleet-wide
        // OnNep17PaymentConventionTests.
        private static string ExtractMethodBody(string source, string methodName)
        {
            var signature = new Regex(@"\b" + Regex.Escape(methodName) + @"\s*\([^)]*\)\s*\{");
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
