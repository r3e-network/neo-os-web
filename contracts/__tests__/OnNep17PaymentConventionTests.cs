using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    /// <summary>
    /// Source-convention guard for the self-contained "money" contracts (those that
    /// receive funds through an OnNEP17Payment callback).
    ///
    /// The crash that took down self-loan v1 was an outbound token transfer performed
    /// (together with a business-logic revert) INSIDE the OnNEP17Payment callback:
    /// it natively crashes the Neo.SmartContract.Testing host, and on-chain it
    /// couples deposit acceptance to a fragile interaction. The convention every
    /// money contract follows is: OnNEP17Payment ONLY validates (caller / memo /
    /// amount) and credits the ledger; all token transfers and business logic live in
    /// DIRECT, witness-gated methods.
    ///
    /// This parameterized test parses each contract's OnNEP17Payment body straight
    /// from source and fails if it contains an outbound asset-moving call. If someone
    /// reintroduces a transfer inside the callback (the self-loan-v1 pattern), this
    /// fails before it can be deployed.
    /// </summary>
    public class OnNep17PaymentConventionTests
    {
        // contracts/ root: the test runs from contracts/__tests__/bin/<cfg>/<tfm>/,
        // so four levels up from the binary base lands on contracts/.
        private static readonly string ContractsRoot = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));

        // The self-contained money contracts and the source file that defines their
        // OnNEP17Payment callback. Platform* kernel contracts and the DevPack base /
        // fixture are intentionally out of scope here.
        public static IEnumerable<object[]> MoneyContracts() => new[]
        {
            new object[] { "MiniAppAimMaster", "MiniAppAimMaster/MiniAppAimMaster.cs" },
            new object[] { "MiniAppBreakupPact", "MiniAppBreakupPact/MiniAppBreakupPact.cs" },
            new object[] { "MiniAppBurnLeague", "MiniAppBurnLeague/MiniAppBurnLeague.cs" },
            new object[] { "MiniAppCoinFlip", "MiniAppCoinFlip/MiniAppCoinFlip.cs" },
            new object[] { "MiniAppColorClash", "MiniAppColorClash/MiniAppColorClash.cs" },
            new object[] { "MiniAppCurveArrow", "MiniAppCurveArrow/MiniAppCurveArrow.cs" },
            new object[] { "MiniAppDailyCheckin", "MiniAppDailyCheckin/MiniAppDailyCheckin.cs" },
            new object[] { "MiniAppDiceGame", "MiniAppDiceGame/MiniAppDiceGame.cs" },
            new object[] { "MiniAppFlappyDash", "MiniAppFlappyDash/MiniAppFlappyDash.cs" },
            new object[] { "MiniAppGame2048", "MiniAppGame2048/MiniAppGame2048.cs" },
            new object[] { "MiniAppGasBox", "MiniAppGasBox/MiniAppGasBox.cs" },
            new object[] { "MiniAppGasBoxV2", "MiniAppGasBoxV2/MiniAppGasBoxV2.cs" },
            new object[] { "MiniAppGovMerc", "MiniAppGovMerc/MiniAppGovMerc.cs" },
            new object[] { "MiniAppLastSurvivor", "MiniAppLastSurvivor/MiniAppLastSurvivor.cs" },
            new object[] { "MiniAppMergeKingdom", "MiniAppMergeKingdom/MiniAppMergeKingdom.cs" },
            new object[] { "MiniAppMilestoneEscrow", "MiniAppMilestoneEscrow/MiniAppMilestoneEscrow.Lifecycle.cs" },
            new object[] { "MiniAppMultisig", "MiniAppMultisig/MiniAppMultisig.cs" },
            new object[] { "MiniAppPetPotion", "MiniAppPetPotion/MiniAppPetPotion.cs" },
            new object[] { "MiniAppQuadraticFunding", "MiniAppQuadraticFunding/MiniAppQuadraticFunding.cs" },
            new object[] { "MiniAppRedEnvelope", "MiniAppRedEnvelope/MiniAppRedEnvelope.cs" },
            new object[] { "MiniAppSelfLoan", "MiniAppSelfLoan/MiniAppSelfLoan.cs" },
            new object[] { "MiniAppSnakeBounty", "MiniAppSnakeBounty/MiniAppSnakeBounty.cs" },
            new object[] { "MiniAppSudoku", "MiniAppSudoku/MiniAppSudoku.cs" },
            new object[] { "MiniAppTarot", "MiniAppTarot/MiniAppTarot.cs" },
            new object[] { "MiniAppTimeCapsule", "MiniAppTimeCapsule/MiniAppTimeCapsule.cs" },
            new object[] { "MiniAppTipJar", "MiniAppTipJar/MiniAppTipJar.cs" },
        };

        // Reviewed exceptions: contracts that DO move funds inside OnNEP17Payment by
        // deliberate, deployed, solvency-validated design. They use strict
        // effect-before-interaction (state written before the transfer) and perform
        // NO business-logic revert after the transfer, so they neither strand funds
        // nor crash the TestEngine happy path.
        //
        // Currently empty: MiniAppTimeCapsule's "fish" discovery fee used to be
        // forwarded straight to the capsule owner inside the callback; it is now
        // credit-only (the fee accrues to the owner's fish-revenue ledger and is pulled
        // via withdrawFishRevenue), so the callback no longer performs a transfer.
        private static readonly HashSet<string> ReviewedTransferExceptions = new();

        // Outbound asset-moving call shapes:
        //   foo.Transfer(...)                       — strongly-typed native helper
        //   Contract.Call(asset, "transfer", ...)   — dynamic NEP-17 transfer
        //   Contract.Call(asset, "transferFrom",…)  — dynamic NEP-17 transferFrom
        private static readonly Regex StrongTransfer = new(@"\.Transfer\s*\(", RegexOptions.Compiled);
        private static readonly Regex DynamicTransfer = new("\"transfer(?:From)?\"", RegexOptions.Compiled);

        [Theory]
        [MemberData(nameof(MoneyContracts))]
        public void OnNep17Payment_HasNoOutboundTransfer(string contract, string relativePath)
        {
            string source = ReadSource(relativePath);
            string body = ExtractMethodBody(source, "OnNEP17Payment");
            Assert.False(
                string.IsNullOrEmpty(body),
                $"{contract}: could not locate an OnNEP17Payment method body in {relativePath}");

            bool hasTransfer = StrongTransfer.IsMatch(body) || DynamicTransfer.IsMatch(body);

            if (ReviewedTransferExceptions.Contains(contract))
            {
                // The exception list must stay honest: if a "reviewed exception" ever
                // stops moving funds in its callback, drop it from the list.
                Assert.True(
                    hasTransfer,
                    $"{contract} is allow-listed as moving funds inside OnNEP17Payment " +
                    "but no transfer was found — remove the stale exception.");
                return;
            }

            Assert.False(
                hasTransfer,
                $"{contract}: OnNEP17Payment must NOT perform a token transfer — it may only " +
                "validate and credit the ledger (the self-loan-v1 transfer-in-callback pattern " +
                "crashes the TestEngine host and couples deposits to a fragile interaction). " +
                "Move the transfer into a direct, witness-gated method.");
        }

        private static string ReadSource(string relativePath)
        {
            string full = Path.Combine(ContractsRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Assert.True(File.Exists(full), $"contract source not found: {full}");
            return File.ReadAllText(full);
        }

        // Returns the brace-balanced body (including the outer braces) of the named
        // method, or "" if not found. Handles partial-class files where the method is
        // one of many.
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
