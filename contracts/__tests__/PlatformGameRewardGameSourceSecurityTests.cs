using System;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Source-security pins for the PlatformGame RewardGame module and the
    /// MiniAppEngineBase shared source — the paths a TestEngine run cannot
    /// exercise (FAULTing NEP-17 callbacks hang the host) plus ordering and
    /// trust-rule pins that keep the design section 3.3 / 3.5 invariants
    /// from silently regressing. Follows the PlatformRegistrySourceSecurityTests
    /// idiom.
    /// </summary>
    public class PlatformGameRewardGameSourceSecurityTests
    {
        private static string Source(string file) =>
            ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformGame", file);

        private static string AllRewardGame() =>
            ContractSourceAssertions.ReadSourcesByPattern("PlatformGame.RewardGame*.cs", "contracts", "platform", "PlatformGame");

        [Fact]
        public void DepositLane_IsCreditOnly_WithLiteralMemoGrammar()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.cs"), "CreditRewardGamePayment");
            Assert.False(string.IsNullOrEmpty(body), "CreditRewardGamePayment body not found");

            // The callback branch validates the memo and credits the ledger
            // ONLY: zero outbound transfers (the self-loan-v1 pattern hangs
            // the TestEngine host and couples deposits to a fragile call).
            Assert.DoesNotMatch(new Regex(@"\.Transfer\s*\("), body);
            Assert.DoesNotContain("\"transfer\"", body);

            // The clone deposit grammar is GAS-only (the pool pays out in GAS).
            Assert.Contains("Runtime.CallingScriptHash == GAS.Hash", body);

            // The memo grammar is literal: pool funding vs entry credit.
            Assert.Contains("appId + \":fund\"", body);
            Assert.Contains("appId + \":entry\"", body);
            Assert.Contains("invalid payment memo", body);

            // Both branches bump the mandatory liability counter.
            Assert.Equal(2, Regex.Matches(body, "AdjustRewardHeld\\(appId, amount\\)").Count);
        }

        [Fact]
        public void Withdraw_CeiOrder_PauseImmune_WitnessBoundDestination()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.Settle.cs"), "Withdraw");
            Assert.False(string.IsNullOrEmpty(body), "Withdraw body not found");

            // Checks-effects-interactions: ledger delete and liability debit
            // both precede the GAS movement.
            int debit = body.IndexOf("Storage.Delete(ctx, key);", StringComparison.Ordinal);
            int held = body.IndexOf("AdjustRewardHeld(appId, -credit);", StringComparison.Ordinal);
            int transfer = body.IndexOf("GAS.Transfer(Runtime.ExecutingScriptHash, account, credit)", StringComparison.Ordinal);
            Assert.True(debit >= 0 && held >= 0 && transfer >= 0 && debit < transfer && held < transfer,
                "Withdraw must debit the ledger and liability counter before moving GAS");

            // The destination is the witnessing account, assert-wrapped;
            // pause state is never consulted on a user exit (anchor invariant).
            Assert.Contains("Runtime.CheckWitness(account)", body);
            Assert.Contains("ExecutionEngine.Assert(", body);
            Assert.DoesNotContain("RequireNotPaused", body);
            Assert.DoesNotContain("RequireRegistryNotPaused", body);
        }

        [Fact]
        public void OnMiniAppResult_OracleGateFirst_BeforeAnyStorageWrite()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.Settle.cs"), "OnMiniAppResult");
            Assert.False(string.IsNullOrEmpty(body), "OnMiniAppResult body not found");

            int oracleGate = body.IndexOf("\"oracle only\"", StringComparison.Ordinal);
            int opGate = body.IndexOf("\"unexpected operation\"", StringComparison.Ordinal);
            int firstWrite = body.IndexOf("Storage.Delete", StringComparison.Ordinal);
            Assert.True(oracleGate >= 0 && opGate >= 0 && firstWrite >= 0,
                "expected oracle gate, operation gate, and context consumption");
            Assert.True(oracleGate < opGate && opGate < firstWrite,
                "the oracle caller gate must precede the operation gate and every storage write");
            Assert.Contains("Runtime.CallingScriptHash == Oracle()", body);
        }

        [Fact]
        public void Settle_AlwaysReleasesReservation_RefundsEntryOnFailure()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.Settle.cs"), "SettleRewardGame");
            Assert.False(string.IsNullOrEmpty(body), "SettleRewardGame body not found");

            // Refund-on-failure (design 3.3): success=false moves the entry
            // back out of the pool into the player's credit and closes the
            // game as Status 4 (refunded) — reversing the start-game move so
            // the liability identity holds.
            Assert.Contains("RG_PREFIX_POOL)) - g.Entry", body);
            Assert.Contains("AddRewardCredit(ctx, appId, g.Player, g.Entry);", body);
            Assert.Contains("g.Status = 4;", body);
            Assert.Contains("g.Status = 2;", body);

            // Pull payment: no transfer anywhere in settlement; the win is a
            // pool drawdown into player credit, never a push.
            Assert.DoesNotMatch(new Regex(@"\.Transfer\s*\("), body);
            Assert.Contains("g.Status == 5", body);
        }

        [Fact]
        public void FinalizeGame_SubmitsOneKernelRequest_AndBindsContext()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.Settle.cs"), "FinalizeGame");
            Assert.False(string.IsNullOrEmpty(body), "FinalizeGame body not found");

            Assert.Contains("\"submitMiniAppRequestFromIntegration\"", body);
            Assert.Contains("player, appId, RG_MODULE_ID, RG_OP_FINALIZE, sealedOpLog", body);
            Assert.Contains("\"kernel request failed\"", body);
            // The op-log is decoded before the kernel call (no unvalidated
            // payload reaches the integration lane).
            int decode = body.IndexOf("HexToBytes(sealedOpLogHex)", StringComparison.Ordinal);
            int submit = body.IndexOf("Contract.Call(", StringComparison.Ordinal);
            Assert.True(decode >= 0 && submit >= 0 && decode < submit,
                "the sealed op-log must be validated before the kernel request");
        }

        [Fact]
        public void RegistryPushLanes_AssertRegistryCallerFirst()
        {
            string descriptor = Source("PlatformGame.RewardGame.Descriptor.cs");
            string activate = ExtractMethodBody(descriptor, "ActivateApp");
            string validate = ExtractMethodBody(descriptor, "ValidateAndApplyDescriptor");
            Assert.False(string.IsNullOrEmpty(activate), "ActivateApp body not found");
            Assert.False(string.IsNullOrEmpty(validate), "ValidateAndApplyDescriptor body not found");

            Assert.StartsWith("{\n            RequireRegistryCaller();", activate
                .Replace("\r\n", "\n"));
            Assert.StartsWith("{\n            RequireRegistryCaller();", validate
                .Replace("\r\n", "\n"));
            Assert.Contains("Runtime.CallingScriptHash == registry", descriptor);
            Assert.Contains("registry not set", descriptor);
            // A registry push never hijacks another module's tenant row.
            Assert.Contains("appId registered to another module", activate);
        }

        [Fact]
        public void DescriptorValidation_CoversEveryEconomicsKeyWithBounds()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.Descriptor.cs"), "ApplyRewardDescriptor");
            Assert.False(string.IsNullOrEmpty(body), "ApplyRewardDescriptor body not found");

            // Every descriptor key family is matched (char-wise, per the
            // nccs string-== hazard documented in the contract).
            string[] stems = { "entry", "reward", "limitMs", "minSolveMs", "targetScore" };
            foreach (string stem in stems)
            {
                Assert.Contains($"DifficultyKeyOf(param, \"{stem}\")", body);
            }
            string[] scalars = { "dailyCap", "undoPenaltyBps", "settleGraceMs" };
            foreach (string scalar in scalars)
            {
                Assert.Contains($"ParamEquals(param, \"{scalar}\")", body);
            }
            string[] bounds =
            {
                "entry out of range", "reward out of range", "limitMs out of range",
                "minSolveMs out of range", "targetScore out of range", "dailyCap out of range",
                "undoPenaltyBps out of range", "settleGraceMs out of range"
            };
            foreach (string bound in bounds)
            {
                Assert.Contains(bound, body);
            }
            // Cross-field consistency + the unknown-key trap are present.
            Assert.Contains("minSolveMs above limitMs", body);
            Assert.Contains("unknown descriptor key", body);
            // The undo penalty stays below a full burn across RG_MAX_UNDOS.
            Assert.Contains("RG_MAX_UNDO_PENALTY_BPS = 3333", Source("PlatformGame.RewardGame.Descriptor.cs"));
        }

        [Fact]
        public void StartGame_ConsultsRegistryPause_OnlyOnTheStartLane()
        {
            string body = ExtractMethodBody(Source("PlatformGame.RewardGame.cs"), "StartGame");
            Assert.False(string.IsNullOrEmpty(body), "StartGame body not found");
            Assert.Contains("RequireRegistryNotPaused(appId);", body);

            // The consult itself is read-only and tolerates an unbound slot.
            string consult = ExtractMethodBody(Source("PlatformGame.RewardGame.Descriptor.cs"), "RequireRegistryNotPaused");
            Assert.Contains("CallFlags.ReadOnly", consult);
            Assert.Contains("registry paused", consult);
        }

        [Fact]
        public void LiabilityCounter_MovesOnEveryExternalLane()
        {
            string main = Source("PlatformGame.RewardGame.cs");
            string settle = Source("PlatformGame.RewardGame.Settle.cs");
            // fund + entry bump it, withdraw debits it — the only three lanes
            // where GAS crosses the module boundary.
            Assert.Equal(2, Regex.Matches(main, "AdjustRewardHeld\\(appId, amount\\)").Count);
            Assert.Contains("AdjustRewardHeld(appId, -credit);", settle);
            Assert.Contains("liability counter underflow", main);
            // The read surface exposes the counter for the invariant suites.
            Assert.Contains("HeldForApp", Source("PlatformGame.RewardGame.Reads.cs"));
        }

        [Fact]
        public void NoFreeDestinationOrDangerousSurface_Anywhere()
        {
            string all = AllRewardGame();
            Assert.DoesNotContain("UInt160 recipient", all);
            Assert.DoesNotContain("ContractManagement.Destroy", all);
            Assert.DoesNotContain("ContractPermission(\"*\", \"*\")", all);

            // The engine base carries no ABI of its own: no public methods,
            // no events, no InitialValue slots (the nccs constraints).
            string engineBase = ContractSourceAssertions.ReadSource(
                "contracts", "MiniApp.DevPack", "MiniAppEngineBase.cs");
            Assert.DoesNotContain("public static", engineBase);
            Assert.DoesNotContain("[InitialValue", engineBase);
            Assert.DoesNotContain("public static event", engineBase);
            Assert.DoesNotContain("UInt160 recipient", engineBase);
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
