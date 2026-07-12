using System;
using System.IO;
using System.Linq;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class CreditsContract : SmartContract
    {
        protected CreditsContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? postSettlement(BigInteger epoch, UInt160[] users, object[] deltas);
        public abstract BigInteger? exit(UInt160 user);
        public abstract void setSettler(UInt160 settlerKey);
        public abstract void setPaused(bool paused);
        public abstract void withdrawGas(UInt160 to, BigInteger amount);
        public abstract UInt160? getOwner();
        public abstract UInt160? settler();
        public abstract bool? isPaused();
        public abstract BigInteger? settledBalanceOf(UInt160 user);
        public abstract BigInteger? currentEpoch();
        public abstract BigInteger? lastSettlementAt();
        public abstract BigInteger? totalGasCollected();
        public abstract BigInteger? totalSettledCredits();
        public abstract BigInteger? heldGas();
        public abstract BigInteger? exitLiabilityGas();
        public abstract BigInteger? creditsForGas(BigInteger gasAmount);
        public abstract BigInteger? creditsPerGas();
        public abstract BigInteger? gasPerCredit();
        public abstract BigInteger? maxSettlementBatch();
    }

    public class MiniAppCreditsTests
    {
        private const long GAS = 100_000_000;      // 1 GAS in base units
        private const long UNIT = 2_000_000;       // GAS base units per credit (1e8 / 50)
        private const string BUY_MEMO = "miniapp-credits:buy";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        /// <summary>Deploys as the validators account, so owner == ValidatorsAddress.</summary>
        private static (TestEngine engine, CreditsContract credits) DeployCredits()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppCredits");
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var credits = engine.Deploy<CreditsContract>(nef, manifest);
            return (engine, credits);
        }

        private static void Fund(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        private static void Buy(TestEngine engine, CreditsContract credits, UInt160 buyer, BigInteger gasAmount)
        {
            engine.SetTransactionSigners(buyer);
            bool? ok = engine.Native.GAS.Transfer(buyer, credits.Hash, gasAmount, BUY_MEMO);
            Assert.True(ok == true, "purchase transfer should succeed");
        }

        private static void AssertRevert(string reason, Action act)
        {
            var ex = Assert.ThrowsAny<Exception>(act);
            Assert.Equal($"ABORTMSG is executed. Reason: {reason}", ex.Message);
        }

        [Fact]
        public void Credits_PurchaseMintsAtFixedRate()
        {
            var (engine, credits) = DeployCredits();
            Assert.Equal(engine.ValidatorsAddress, credits.getOwner());
            Assert.Equal(new BigInteger(50), credits.creditsPerGas());
            Assert.Equal(new BigInteger(UNIT), credits.gasPerCredit());

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 5 * GAS);

            // 1 GAS mints exactly 50 credits.
            Buy(engine, credits, alice, 1 * GAS);
            Assert.Equal(new BigInteger(50), credits.settledBalanceOf(alice));
            Assert.Equal(new BigInteger(1 * GAS), credits.totalGasCollected());
            Assert.Equal(new BigInteger(50), credits.totalSettledCredits());
            Assert.Equal(new BigInteger(50 * UNIT), credits.exitLiabilityGas());
            Assert.Equal(new BigInteger(1 * GAS), credits.heldGas());

            // Exactly one credit unit (0.02 GAS) mints one more credit.
            Buy(engine, credits, alice, UNIT);
            Assert.Equal(new BigInteger(51), credits.settledBalanceOf(alice));

            // A non-multiple floors: 0.025 GAS mints 1 credit, the 0.005 GAS
            // remainder stays as owner surplus (heldGas > exitLiabilityGas).
            Buy(engine, credits, alice, 2_500_000);
            Assert.Equal(new BigInteger(52), credits.settledBalanceOf(alice));
            Assert.Equal(new BigInteger(1 * GAS + UNIT + 2_500_000), credits.totalGasCollected());
            Assert.Equal(new BigInteger(52), credits.totalSettledCredits());
            Assert.Equal(credits.totalGasCollected(), credits.heldGas());
            Assert.Equal(new BigInteger(500_000), credits.heldGas() - credits.exitLiabilityGas());

            // The contract genuinely holds every purchase GAS unit.
            Assert.Equal(credits.heldGas(), engine.Native.GAS.BalanceOf(credits.Hash));

            // Second buyer accumulates independently.
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            Buy(engine, credits, bob, 4_000_000);
            Assert.Equal(new BigInteger(2), credits.settledBalanceOf(bob));
            Assert.Equal(new BigInteger(54), credits.totalSettledCredits());

            // Rate helper mirrors the mint math exactly (floor + dust boundary).
            Assert.Equal(BigInteger.Zero, credits.creditsForGas(UNIT - 1));
            Assert.Equal(BigInteger.One, credits.creditsForGas(UNIT));
            Assert.Equal(BigInteger.One, credits.creditsForGas(2_500_000));
            Assert.Equal(new BigInteger(50), credits.creditsForGas(1 * GAS));
            Assert.Equal(new BigInteger(75), credits.creditsForGas(GAS + GAS / 2));
            Assert.Equal(BigInteger.Zero, credits.creditsForGas(0));
            Assert.Equal(BigInteger.Zero, credits.creditsForGas(-1));
        }

        [Fact]
        public void Credits_PurchaseGuards()
        {
            // NOTE: a GAS transfer whose OnNEP17Payment callback FAULTs (dust /
            // wrong memo / paused) hangs the TestEngine host, so those rejections
            // are pinned at source level (MiniAppCreditsSourceSecurityTests) and
            // exercised here through the direct-invocation path: a direct call is
            // not a GAS callback and must revert before crediting anything.
            var (engine, credits) = DeployCredits();
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);

            engine.SetTransactionSigners(bob);
            AssertRevert("only GAS accepted", () => credits.onNEP17Payment(bob, UNIT, BUY_MEMO));
            Assert.Equal(BigInteger.Zero, credits.settledBalanceOf(bob));

            // The pause gate sits in FRONT of the caller gate: while paused the
            // callback dies on "contract paused" before anything else, so a real
            // purchase transfer FAULTs and the sender keeps their GAS.
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            credits.setPaused(true);
            Assert.Equal(true, credits.isPaused());
            engine.SetTransactionSigners(bob);
            AssertRevert("contract paused", () => credits.onNEP17Payment(bob, UNIT, BUY_MEMO));

            // Unpaused again, real purchases work.
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            credits.setPaused(false);
            Buy(engine, credits, bob, UNIT);
            Assert.Equal(BigInteger.One, credits.settledBalanceOf(bob));
        }

        [Fact]
        public void Credits_SettlementAuthEpochsAndDebits()
        {
            var (engine, credits) = DeployCredits();
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Buy(engine, credits, alice, 2 * GAS); // 100 credits

            // A random signer is neither settler nor owner.
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            AssertRevert("settler or owner witness required",
                () => credits.postSettlement(1, new[] { alice }, new object[] { -10 }));

            // Owner can settle, but only at exactly currentEpoch + 1.
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            AssertRevert("invalid epoch",
                () => credits.postSettlement(0, new[] { alice }, new object[] { -10 }));
            AssertRevert("invalid epoch",
                () => credits.postSettlement(2, new[] { alice }, new object[] { -10 }));

            Assert.Equal(BigInteger.Zero, credits.lastSettlementAt());
            Assert.Equal(new BigInteger(10),
                credits.postSettlement(1, new[] { alice }, new object[] { -10 }));
            Assert.Equal(BigInteger.One, credits.currentEpoch());
            Assert.Equal(new BigInteger(90), credits.settledBalanceOf(alice));
            Assert.Equal(new BigInteger(90), credits.totalSettledCredits());
            Assert.True(credits.lastSettlementAt() > 0);

            // Replaying the same epoch is rejected (monotonic, no gaps).
            AssertRevert("invalid epoch",
                () => credits.postSettlement(1, new[] { alice }, new object[] { -10 }));

            // Settler management: owner-only, must be a real key.
            var sam = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            AssertRevert("owner witness required", () => credits.setSettler(sam));
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            AssertRevert("invalid settler", () => credits.setSettler(UInt160.Zero));
            credits.setSettler(sam);
            Assert.Equal(sam, credits.settler());

            // The designated settler can post the next epoch...
            engine.SetTransactionSigners(sam);
            Assert.Equal(new BigInteger(20),
                credits.postSettlement(2, new[] { alice }, new object[] { -20 }));
            Assert.Equal(new BigInteger(70), credits.settledBalanceOf(alice));
            Assert.Equal(new BigInteger(2), credits.currentEpoch());

            // ...while unrelated signers still cannot.
            engine.SetTransactionSigners(mallory);
            AssertRevert("settler or owner witness required",
                () => credits.postSettlement(3, new[] { alice }, new object[] { -1 }));
        }

        [Fact]
        public void Credits_SettlementPayloadGuards()
        {
            var (engine, credits) = DeployCredits();
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            Buy(engine, credits, alice, 1 * GAS); // 50 credits

            engine.SetTransactionSigners(engine.ValidatorsAddress);

            AssertRevert("length mismatch",
                () => credits.postSettlement(1, new[] { alice }, new object[] { -1, -2 }));
            AssertRevert("batch size out of range",
                () => credits.postSettlement(1, new UInt160[0], new object[0]));

            var tooManyUsers = Enumerable.Repeat(alice, 501).ToArray();
            var tooManyDeltas = Enumerable.Repeat((object)(-1), 501).ToArray();
            AssertRevert("batch size out of range",
                () => credits.postSettlement(1, tooManyUsers, tooManyDeltas));

            // Deltas are SPEND-ONLY: zero and positive values are rejected so a
            // compromised settler key can never mint exitable credits.
            AssertRevert("delta must be negative",
                () => credits.postSettlement(1, new[] { alice }, new object[] { 0 }));
            AssertRevert("delta must be negative",
                () => credits.postSettlement(1, new[] { alice }, new object[] { 5 }));
            AssertRevert("invalid user",
                () => credits.postSettlement(1, new[] { UInt160.Zero }, new object[] { -1 }));

            // Nothing was applied by the rejected batches.
            Assert.Equal(new BigInteger(50), credits.settledBalanceOf(alice));
            Assert.Equal(BigInteger.Zero, credits.currentEpoch());

            // Duplicate rows apply sequentially within one batch.
            Assert.Equal(new BigInteger(20), credits.postSettlement(
                1, new[] { alice, alice }, new object[] { -10, -10 }));
            Assert.Equal(new BigInteger(30), credits.settledBalanceOf(alice));

            // Overspend CLAMPS at zero instead of aborting the checkpoint: only
            // the 30 remaining credits are debited from a -80 delta.
            Assert.Equal(new BigInteger(30), credits.postSettlement(
                2, new[] { alice }, new object[] { -80 }));
            Assert.Equal(BigInteger.Zero, credits.settledBalanceOf(alice));
            Assert.Equal(BigInteger.Zero, credits.totalSettledCredits());
            Assert.Equal(new BigInteger(2), credits.currentEpoch());

            // A batch touching only zero-balance users still advances the epoch
            // (all debits clamp to zero, totalDebited == 0).
            Assert.Equal(BigInteger.Zero, credits.postSettlement(
                3, new[] { alice }, new object[] { -5 }));
            Assert.Equal(new BigInteger(3), credits.currentEpoch());
        }

        [Fact]
        public void Credits_ExitReturnsSettledBalanceEvenWhilePaused()
        {
            var (engine, credits) = DeployCredits();
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            Buy(engine, credits, alice, 1 * GAS); // 50 credits == 1 GAS of backing

            // Another signer cannot trigger Alice's exit.
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            AssertRevert("user witness required", () => credits.exit(alice));

            // Alice exits her full settled balance at the fixed rate.
            engine.SetTransactionSigners(alice);
            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(new BigInteger(1 * GAS), credits.exit(alice));
            Assert.Equal(before + 1 * GAS, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, credits.settledBalanceOf(alice));
            Assert.Equal(BigInteger.Zero, credits.totalSettledCredits());
            Assert.Equal(BigInteger.Zero, credits.heldGas());
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(credits.Hash));
            AssertRevert("no settled credits", () => credits.exit(alice));

            // Pause blocks purchases + settlements — but NEVER the exit hatch.
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            Buy(engine, credits, bob, UNIT * 5); // 5 credits
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            credits.setPaused(true);
            engine.SetTransactionSigners(bob);
            Assert.Equal(new BigInteger(5 * UNIT), credits.exit(bob));
            Assert.Equal(BigInteger.Zero, credits.settledBalanceOf(bob));
        }

        [Fact]
        public void Credits_WithdrawGasRespectsExitLiability()
        {
            var (engine, credits) = DeployCredits();
            var alice = TestEngine.GetNewSigner().Account;
            var treasury = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);
            Buy(engine, credits, alice, 2 * GAS); // 100 credits, fully exit-backed

            // Not the owner.
            engine.SetTransactionSigners(alice);
            AssertRevert("owner witness required", () => credits.withdrawGas(treasury, 1));

            // Owner cannot touch GAS that still backs settled credits.
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            AssertRevert("amount must be > 0", () => credits.withdrawGas(treasury, 0));
            AssertRevert("invalid recipient", () => credits.withdrawGas(UInt160.Zero, 1));
            AssertRevert("amount exceeds exit-backed surplus", () => credits.withdrawGas(treasury, 1));

            // Settling 50 spent credits frees exactly 1 GAS of surplus.
            credits.postSettlement(1, new[] { alice }, new object[] { -50 });
            Assert.Equal(new BigInteger(1 * GAS), credits.exitLiabilityGas());
            AssertRevert("amount exceeds exit-backed surplus",
                () => credits.withdrawGas(treasury, 1 * GAS + 1));
            credits.withdrawGas(treasury, 1 * GAS);
            Assert.Equal(new BigInteger(1 * GAS), engine.Native.GAS.BalanceOf(treasury));
            Assert.Equal(new BigInteger(1 * GAS), credits.heldGas());
            AssertRevert("amount exceeds exit-backed surplus", () => credits.withdrawGas(treasury, 1));

            // The remaining GAS is exactly Alice's exit backing — and it pays out.
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(1 * GAS), credits.exit(alice));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(credits.Hash));

            // Sub-credit purchase remainders are withdrawable surplus too.
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            Buy(engine, credits, bob, 2_500_000); // 1 credit + 0.005 GAS remainder
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            AssertRevert("amount exceeds exit-backed surplus", () => credits.withdrawGas(treasury, 500_001));
            credits.withdrawGas(treasury, 500_000);
            Assert.Equal(credits.exitLiabilityGas(), credits.heldGas());
        }

        [Fact]
        public void Credits_PauseBlocksSettlementNotReads()
        {
            var (engine, credits) = DeployCredits();
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            Buy(engine, credits, alice, 1 * GAS);

            engine.SetTransactionSigners(engine.ValidatorsAddress);
            credits.setPaused(true);

            // Even an owner-signed settlement is blocked while paused.
            AssertRevert("contract paused",
                () => credits.postSettlement(1, new[] { alice }, new object[] { -10 }));

            // Reads stay fully live while paused.
            Assert.Equal(true, credits.isPaused());
            Assert.Equal(new BigInteger(50), credits.settledBalanceOf(alice));
            Assert.Equal(BigInteger.Zero, credits.currentEpoch());
            Assert.Equal(new BigInteger(1 * GAS), credits.totalGasCollected());
            Assert.Equal(new BigInteger(50), credits.creditsForGas(1 * GAS));

            // Unpausing restores settlement.
            credits.setPaused(false);
            Assert.Equal(new BigInteger(10),
                credits.postSettlement(1, new[] { alice }, new object[] { -10 }));
            Assert.Equal(new BigInteger(40), credits.settledBalanceOf(alice));
        }
    }
}
