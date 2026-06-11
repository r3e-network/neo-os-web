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
    public abstract class TarotContract : SmartContract
    {
        protected TarotContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? draw(UInt160 player);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract void withdrawRevenue(UInt160 to);
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? revenue();
        public abstract BigInteger? readingsCount();
        public abstract BigInteger? drawFee();
        public abstract BigInteger? playerReadingCount(UInt160 player);
        public abstract BigInteger[]? getPlayerReadings(UInt160 player, BigInteger offset, BigInteger limit);
        // Maps come back as raw Neo.VM.Types.Map — the only map binding the
        // testing framework's converter supports.
        public abstract Neo.VM.Types.Map? getReading(BigInteger readingId);
    }

    public class MiniAppTarotTests
    {
        // The contract hardcodes Owner = NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32
        // (UInt160 form as TestEngine/CheckWitness sees it).
        private static readonly UInt160 OwnerHash = UInt160.Parse("0x6d0656f6dd91469db1c90cc1e574380613f43738");
        private const long GAS = 100000000;        // 1 GAS base units
        private const long DRAW_FEE = 10000000;    // 0.1 GAS
        private const string DRAW_MEMO = "miniapp-tarot:draw";
        private const int DECK_SIZE = 78;

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

        private static void Fund(TestEngine engine, UInt160 to, BigInteger gas)
        {
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, to, gas, null);
        }

        private static BigInteger[] CardsOf(TarotContract tarot, UInt160 expectedPlayer, BigInteger readingId)
        {
            Neo.VM.Types.Map? reading = tarot.getReading(readingId);
            Assert.NotNull(reading);
            UInt160 player = new UInt160(reading![(Neo.VM.Types.PrimitiveType)"player"].GetSpan());
            Assert.Equal(expectedPlayer, player);
            var cards = (Neo.VM.Types.Array)reading[(Neo.VM.Types.PrimitiveType)"cards"];
            return cards.Select(item => item.GetInteger()).ToArray();
        }

        [Fact]
        public void Tarot_DepositDrawAndRandomnessInvariants()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTarot");
            var tarot = engine.Deploy<TarotContract>(nef, manifest);
            Assert.Equal(new BigInteger(DRAW_FEE), tarot.drawFee());

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 5 * GAS);

            // Deposit three draws' worth of fee.
            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.GAS.Transfer(alice, tarot.Hash, 3 * DRAW_FEE, DRAW_MEMO);
            Assert.True(ok == true, "deposit transfer should succeed");
            Assert.Equal(new BigInteger(3 * DRAW_FEE), tarot.creditOf(alice));

            for (int i = 1; i <= 3; i++)
            {
                Assert.Equal(new BigInteger(i), tarot.draw(alice));

                // Invariant-style randomness asserts: the cards themselves are
                // entropy-driven, but every reading must hold three DISTINCT cards
                // each inside the 78-card deck.
                BigInteger[] cards = CardsOf(tarot, alice, i);
                Assert.Equal(3, cards.Length);
                Assert.Equal(3, cards.Distinct().Count());
                Assert.All(cards, card => Assert.True(card >= 0 && card < DECK_SIZE, $"card {card} outside deck"));
            }

            Assert.Equal(new BigInteger(3), tarot.readingsCount());
            Assert.Equal(new BigInteger(3), tarot.playerReadingCount(alice));
            Assert.Equal(BigInteger.Zero, tarot.creditOf(alice));
            Assert.Equal(new BigInteger(3 * DRAW_FEE), tarot.revenue());

            // Solvency: everything the contract holds is exactly the accrued revenue.
            Assert.Equal(new BigInteger(3 * DRAW_FEE), engine.Native.GAS.BalanceOf(tarot.Hash));

            BigInteger[]? readings = tarot.getPlayerReadings(alice, 0, 10);
            Assert.NotNull(readings);
            Assert.Equal(new BigInteger[] { 1, 2, 3 }, readings);
        }

        [Fact]
        public void Tarot_DrawRequiresFullPrepaidFee()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTarot");
            var tarot = engine.Deploy<TarotContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);

            // No credit at all.
            Assert.ThrowsAny<Exception>(() => tarot.draw(bob));

            // A partial fee is not enough either.
            engine.Native.GAS.Transfer(bob, tarot.Hash, DRAW_FEE / 2, DRAW_MEMO);
            Assert.ThrowsAny<Exception>(() => tarot.draw(bob));
            Assert.Equal(new BigInteger(DRAW_FEE / 2), tarot.creditOf(bob));
        }

        [Fact]
        public void Tarot_OnPaymentRejectsDirectNonGasCallers()
        {
            // NOTE: a transfer whose OnNEP17Payment callback FAULTs (wrong memo /
            // wrong asset) hangs the TestEngine host, so those rejections are only
            // exercised live (deploy/scripts/live_validate_tarot.mjs). What CAN run
            // here is the same guard's first line of defense: a direct invocation
            // is not a GAS callback and must revert before crediting.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTarot");
            var tarot = engine.Deploy<TarotContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => tarot.onNEP17Payment(bob, DRAW_FEE, DRAW_MEMO));
            Assert.Equal(BigInteger.Zero, tarot.creditOf(bob));
        }

        [Fact]
        public void Tarot_RevenueWithdrawIsOwnerOnly()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTarot");
            var tarot = engine.Deploy<TarotContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var payee = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 1 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, tarot.Hash, DRAW_FEE, DRAW_MEMO);
            tarot.draw(alice);
            Assert.Equal(new BigInteger(DRAW_FEE), tarot.revenue());

            // A stranger cannot drain the revenue.
            Assert.ThrowsAny<Exception>(() => tarot.withdrawRevenue(alice));

            // The owner can, to any recipient address.
            engine.SetTransactionSigners(OwnerHash);
            tarot.withdrawRevenue(payee);
            Assert.Equal(BigInteger.Zero, tarot.revenue());
            Assert.Equal(new BigInteger(DRAW_FEE), engine.Native.GAS.BalanceOf(payee));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(tarot.Hash));

            // Nothing left to withdraw.
            Assert.ThrowsAny<Exception>(() => tarot.withdrawRevenue(payee));
        }

        [Fact]
        public void Tarot_WithdrawRefundsUnusedCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTarot");
            var tarot = engine.Deploy<TarotContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 1 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, tarot.Hash, DRAW_FEE * 5 / 2, DRAW_MEMO); // 0.25 GAS
            tarot.draw(alice);

            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(new BigInteger(DRAW_FEE * 3 / 2), tarot.withdraw(alice)); // 0.15 GAS back
            Assert.Equal(before + DRAW_FEE * 3 / 2, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, tarot.creditOf(alice));

            // Solvency: only the accrued draw fee remains inside the contract.
            Assert.Equal(new BigInteger(DRAW_FEE), engine.Native.GAS.BalanceOf(tarot.Hash));

            // Empty credit cannot be withdrawn again.
            Assert.ThrowsAny<Exception>(() => tarot.withdraw(alice));
        }
    }
}
