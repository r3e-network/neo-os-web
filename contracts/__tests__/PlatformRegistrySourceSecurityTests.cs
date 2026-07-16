using System;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Source-security pins for the PlatformRegistry spine — the paths a
    /// TestEngine run cannot exercise (FAULTing NEP-17 callbacks inside real
    /// transfers hang the host) plus ordering and trust-rule pins that keep
    /// the design's invariants from silently regressing.
    /// </summary>
    public class PlatformRegistrySourceSecurityTests
    {
        private static string Source(string file) =>
            ContractSourceAssertions.ReadSource("contracts", "platform", "PlatformRegistry", file);

        private static string AllSources() =>
            ContractSourceAssertions.ReadSourcesInDirectory("contracts", "platform", "PlatformRegistry");

        [Fact]
        public void OnNep17Payment_PauseGateFirst_ThenCallerGate_CreditOnly()
        {
            string body = ExtractMethodBody(Source("PlatformRegistry.Credit.cs"), "OnNEP17Payment");
            Assert.False(string.IsNullOrEmpty(body), "OnNEP17Payment body not found");

            // Ordering (the MiniAppCredits pin): pause gate BEFORE the
            // GAS-caller gate, both before any state write.
            int pauseGate = body.IndexOf("registry paused", StringComparison.Ordinal);
            int callerGate = body.IndexOf("only GAS accepted", StringComparison.Ordinal);
            int creditWrite = body.IndexOf("OnCredited(", StringComparison.Ordinal);
            Assert.True(pauseGate >= 0 && callerGate >= 0 && creditWrite >= 0, "expected gates and credit write");
            Assert.True(pauseGate < callerGate && callerGate < creditWrite,
                "OnNEP17Payment must gate pause, then caller, then credit");

            // Credit-only: zero outbound transfers inside the callback — the
            // fundEnginePool forward happens AFTER the callback returns.
            Assert.DoesNotMatch(new Regex(@"\.Transfer\s*\("), body);
            Assert.DoesNotContain("\"transfer\"", body);

            // The transit branch validates the note byte-for-byte and credits
            // nothing (no liability write inside the branch).
            int transit = body.IndexOf("PREFIX_TREASURY_TRANSIT", StringComparison.Ordinal);
            Assert.True(transit >= 0 && transit < body.IndexOf("ValidateAppIdFormat", StringComparison.Ordinal),
                "transit hop must be handled before the memo credit path");
            Assert.Contains("unexpected payer during treasury hop", body);
            Assert.Contains("unexpected amount during treasury hop", body);

            // Finding 3: the callback does NOT clear the transit note — the
            // in-flight lock is held across the engine forward so a reentrant
            // fundEnginePool trips the guard. fundEnginePool clears it after.
            Assert.DoesNotContain("Storage.Delete(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT)", body);

            // The liability counter moves with every credit.
            Assert.Contains("PREFIX_CREDIT_LIABILITY", body);
        }

        [Fact]
        public void WithdrawCredit_CeiOrder_PauseImmune_PayerBound()
        {
            string body = ExtractMethodBody(Source("PlatformRegistry.Credit.cs"), "WithdrawCredit");
            Assert.False(string.IsNullOrEmpty(body), "WithdrawCredit body not found");

            // Checks-effects-interactions: ledger debit precedes the transfer.
            int debit = body.IndexOf("DebitCredit(", StringComparison.Ordinal);
            int transfer = body.IndexOf("GAS.Transfer(Runtime.ExecutingScriptHash, payer, amount)", StringComparison.Ordinal);
            Assert.True(debit >= 0 && transfer >= 0 && debit < transfer,
                "WithdrawCredit must debit the ledger before moving GAS");

            // Pause-immune (anchor invariant): no pause consult in the exit.
            Assert.DoesNotContain("RequireNotGloballyPaused", body);
            Assert.DoesNotContain("registry paused", body);

            // Destination is the witnessing payer, assert-wrapped.
            Assert.Contains("Runtime.CheckWitness(payer)", body);
            Assert.Contains("ExecutionEngine.Assert(", body);
        }

        [Fact]
        public void SpendLanes_PauseImmune_DestinationIsRegisteredPayoutOnly()
        {
            string treasury = Source("PlatformRegistry.Treasury.cs");
            string spendBody = ExtractMethodBody(treasury, "SpendToPayout");
            string executeBody = ExtractMethodBody(treasury, "ExecuteSpend");
            string relayBody = ExtractMethodBody(treasury, "RelayPayout");

            // Exits never consult pause state (anchor invariant).
            Assert.DoesNotContain("RequireNotGloballyPaused", spendBody);
            Assert.DoesNotContain("RequireAppNotPaused", spendBody);
            Assert.DoesNotContain("RequireNotGloballyPaused", executeBody);

            // Both lanes converge on the single relay whose destination is
            // ALWAYS the stored payout address — never a caller value.
            Assert.Contains("RelayPayout(", spendBody);
            Assert.Contains("RelayPayout(", executeBody);
            Assert.Contains("UInt160 payout = PayoutAddressOf(appId)", relayBody);
            Assert.Contains("Contract.Call(account, \"executeTransfer\", CallFlags.All, asset, payout, amount)", relayBody);

            // Above-threshold (or cumulative-window-exceeding) spends are
            // pushed into the timelock pair, and executeSpend consumes the
            // pending slot BEFORE relaying (CEI).
            Assert.Contains("window spend budget exceeded", spendBody);
            int consume = executeBody.IndexOf("Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_SPEND, appId))", StringComparison.Ordinal);
            int relay = executeBody.IndexOf("RelayPayout(", StringComparison.Ordinal);
            Assert.True(consume >= 0 && relay >= 0 && consume < relay,
                "ExecuteSpend must consume the pending spend before relaying");
        }

        [Fact]
        public void FundEnginePool_EngineBoundDestination_TransitNoteOrdering_MemoLiteral()
        {
            string body = ExtractMethodBody(Source("PlatformRegistry.Treasury.cs"), "FundEnginePool");
            Assert.False(string.IsNullOrEmpty(body), "FundEnginePool body not found");

            // Destination is the registered engine row's hash, memo is the
            // 'appId:credit' grammar — both literal, never parameters.
            Assert.Contains("GAS.Transfer(Runtime.ExecutingScriptHash, row.Hash, amount, appId + \":credit\")", body);

            // Transit ordering (finding 3): the in-flight lock is HELD across
            // the forward. Guard -> note set -> relay -> forward -> note delete,
            // so a reentrant engine callback trips the still-live lock.
            int guard = body.IndexOf("treasury hop in progress", StringComparison.Ordinal);
            int setNote = body.IndexOf("Storage.Put(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT", StringComparison.Ordinal);
            int relay = body.IndexOf("Contract.Call(account, \"executeTransfer\"", StringComparison.Ordinal);
            int forward = body.IndexOf("engine pool transfer failed", StringComparison.Ordinal);
            int clearNote = body.IndexOf("Storage.Delete(Storage.CurrentContext, PREFIX_TREASURY_TRANSIT)", StringComparison.Ordinal);
            Assert.True(guard >= 0 && setNote >= 0 && relay >= 0 && forward >= 0 && clearNote >= 0,
                "expected the full transit sequence");
            Assert.True(guard < setNote && setNote < relay && relay < forward && forward < clearNote,
                "FundEnginePool ordering: guard -> note -> relay -> forward -> clear-note");
        }

        [Fact]
        public void ExecuteAppAdminChange_PushesRotationIntoMintedShim()
        {
            // Resolved objection 5: the rotation execute path must push
            // onAdminRotated into the shim so the escape key never drifts.
            string body = ExtractMethodBody(Source("PlatformRegistry.Governance.cs"), "ExecuteAppAdminChange");
            Assert.Contains("Contract.Call(account, \"onAdminRotated\", CallFlags.All, pending.Value)", body);
            int store = body.IndexOf("Storage.Put(Storage.CurrentContext, AppKey(PREFIX_APP_ADMIN, appId)", StringComparison.Ordinal);
            int push = body.IndexOf("onAdminRotated", StringComparison.Ordinal);
            Assert.True(store >= 0 && push >= 0 && store < push,
                "the registry row updates before the shim push in the same transaction");
        }

        [Fact]
        public void MintAccount_HandshakeAfterDeploy_ActualHashRecorded()
        {
            string body = ExtractMethodBody(Source("PlatformRegistry.Accounts.cs"), "MintAccount");
            int deploy = body.IndexOf("ContractManagement.Deploy(", StringComparison.Ordinal);
            int handshake = body.IndexOf("bindRegistry", StringComparison.Ordinal);
            int record = body.IndexOf("AppKey(PREFIX_APP_ACCOUNT, appId), account", StringComparison.Ordinal);
            int reverse = body.IndexOf("AccountKey(PREFIX_APP_ID_BY_ACCOUNT, account), appId", StringComparison.Ordinal);
            Assert.True(deploy >= 0 && handshake >= 0 && record >= 0 && reverse >= 0,
                "expected deploy, handshake, row record, and reverse index");
            Assert.True(deploy < handshake && handshake < record && record < reverse,
                "mint ordering: deploy -> bind handshake -> record actual hash -> reverse index");
            // The recorded hash is the DEPLOYED one, never a prediction.
            Assert.Contains("deployed.Hash", body);
            Assert.DoesNotContain("PredictedAccountHash(", body);
        }

        [Fact]
        public void Update_IsAdminGatedTimelockedAndHashPinned_NoDestroyAnywhere()
        {
            string governance = Source("PlatformRegistry.Governance.cs");
            ContractSourceAssertions.AssertHasPublicStaticMethod(governance, "void", "Update");
            string body = ExtractMethodBody(governance, "Update");
            Assert.Contains("ValidateAdmin();", body);
            Assert.Contains("no upgrade scheduled", body);
            Assert.Contains("timelock active", body);
            Assert.Contains("upgrade data mismatch", body);
            Assert.Contains("ContractManagement.Update", body);
            Assert.DoesNotContain("ContractManagement.Destroy", AllSources());
        }

        [Fact]
        public void TimelockConstant_MatchesAuditedPlatformGameValue()
        {
            string core = Source("PlatformRegistry.cs");
            Assert.Contains("TIMELOCK_DELAY_MS = 86400000", core);
            // Fee + threshold policy constants pinned to the design values.
            Assert.Contains("FEE_LITE_REGISTRATION = 100_000_000", core);
            Assert.Contains("FEE_ACCOUNT_MINT = 1_000_000_000", core);
            Assert.Contains("DEFAULT_SPEND_THRESHOLD = 10_000_000_000", core);
        }

        [Fact]
        public void GetGlobalPause_PinsTheShapeTheAppAccountConsumes()
        {
            // The AppAccount escape hatch pins [paused(bool), pausedAt(ms)];
            // this is the registry side of that contract.
            string body = ExtractMethodBody(Source("PlatformRegistry.Directory.cs"), "GetGlobalPause");
            Assert.Contains("return new object[] { paused, pausedAt }", body);
        }

        [Fact]
        public void NoFreeDestinationParameterAnywhere()
        {
            // Fleet invariant: destinations are role-bound; the literal free
            // destination parameter is banned across every registry partial.
            Assert.DoesNotContain("UInt160 recipient", AllSources());
        }

        [Fact]
        public void ContractPermissions_AreNarrow()
        {
            string core = Source("PlatformRegistry.cs");
            Assert.DoesNotContain("ContractPermission(\"*\", \"*\")", core);
            Assert.Contains("[ContractPermission(\"0xd2a4cff31913016155e38e474a2c06d08be276cf\", \"transfer\")]", core);
            Assert.Contains("[ContractPermission(\"0xfffdc93764dbaddd97c48f252a53ea4643faa3fd\", \"deploy\", \"getContract\", \"update\")]", core);
            Assert.Contains("[ContractPermission(\"*\", \"activateApp\", \"validateAndApplyDescriptor\", \"bindRegistry\", \"onAdminRotated\", \"executeTransfer\", \"update\")]", core);
        }

        [Fact]
        public void ArtifactValidation_HappensAtProposeTime()
        {
            // The splice-fuzz rule: every structural check runs when the
            // artifact is PROPOSED, so a malformed template can never reach
            // the active slot that minting reads.
            string body = ExtractMethodBody(Source("PlatformRegistry.Accounts.cs"), "ProposeAppAccountArtifact");
            Assert.Contains("ValidateArtifact(nef, manifestFirstHalf, manifestSecondHalf)", body);
            string validate = ExtractMethodBody(Source("PlatformRegistry.Accounts.cs"), "ValidateArtifact");
            Assert.Contains("invalid nef magic", validate);
            Assert.Contains("first half must end at the manifest name", validate);
            Assert.Contains("second half must open with the name-closing quote", validate);
            Assert.Contains("JsonDeserialize", validate);
            Assert.Contains("manifest name is not splice-addressable", validate);
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
