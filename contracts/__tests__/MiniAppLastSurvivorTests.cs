using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class LastSurvivorContract : SmartContract
    {
        protected LastSurvivorContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? buyKeys(UInt160 player, BigInteger count);
        public abstract BigInteger? settle();
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? creditOf(UInt160 player);
        public abstract BigInteger? currentRoundId();
        public abstract BigInteger? playerKeys(BigInteger roundId, UInt160 player);
        public abstract BigInteger? keyCost(BigInteger totalKeys, BigInteger count);
        public abstract BigInteger? currentKeyCost(BigInteger count);
    }

    public class MiniAppLastSurvivorTests
    {
        private const long GAS = 100000000;            // 1 GAS base units
        private const long BASE_KEY_PRICE = 10000000;  // 0.1 GAS
        private const long COMMON_DIFF = BASE_KEY_PRICE * 10 / 10000; // 0.1% of base per key
        private const string BUY_MEMO = "miniapp-lastsurvivor:buy";

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

        // The bonding curve documented on the contract, computed independently here
        // so the test fails if either side drifts.
        private static BigInteger ExpectedCost(BigInteger totalKeys, BigInteger count)
        {
            BigInteger firstPrice = BASE_KEY_PRICE + totalKeys * COMMON_DIFF;
            return count * firstPrice + (count * (count - 1) / 2) * COMMON_DIFF;
        }

        [Fact]
        public void LastSurvivor_BuyKeysFollowsBondingCurveAndConsumesCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 1 * GAS);

            BigInteger cost3 = ExpectedCost(0, 3);
            Assert.Equal(cost3, game.keyCost(0, 3));

            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.GAS.Transfer(alice, game.Hash, cost3, BUY_MEMO);
            Assert.True(ok == true, "deposit transfer should succeed");
            Assert.Equal(cost3, game.creditOf(alice));

            Assert.Equal(cost3, game.buyKeys(alice, 3));
            Assert.Equal(BigInteger.Zero, game.creditOf(alice));
            Assert.Equal(BigInteger.One, game.currentRoundId());
            Assert.Equal(new BigInteger(3), game.playerKeys(1, alice));

            // The live price now starts from totalKeys = 3.
            Assert.Equal(ExpectedCost(3, 1), game.currentKeyCost(1));
            Assert.Equal(ExpectedCost(3, 5), game.currentKeyCost(5));

            // Solvency: the whole deposit became pot, all of it still in the contract.
            Assert.Equal(cost3, engine.Native.GAS.BalanceOf(game.Hash));
        }

        [Fact]
        public void LastSurvivor_BuyKeysGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);

            // No deposit credit yet.
            Assert.ThrowsAny<Exception>(() => game.buyKeys(bob, 1));

            engine.Native.GAS.Transfer(bob, game.Hash, BASE_KEY_PRICE, BUY_MEMO);

            // Count bounds: 0 and 1001 are both rejected.
            Assert.ThrowsAny<Exception>(() => game.buyKeys(bob, 0));
            Assert.ThrowsAny<Exception>(() => game.buyKeys(bob, 1001));

            // A different account cannot spend Bob's credit (witness check).
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => game.buyKeys(bob, 1));

            engine.SetTransactionSigners(bob);
            Assert.Equal(new BigInteger(BASE_KEY_PRICE), game.buyKeys(bob, 1));
        }

        [Fact]
        public void LastSurvivor_OnPaymentRejectsDirectNonGasCallers()
        {
            // NOTE: a transfer whose OnNEP17Payment callback FAULTs (wrong memo /
            // wrong asset) hangs the TestEngine host, so those rejections are only
            // exercised live (deploy/scripts/live_validate_lastsurvivor.mjs). What
            // CAN run here is the same guard's first line of defense: a direct
            // invocation is not a GAS callback and must revert before crediting.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => game.onNEP17Payment(bob, BASE_KEY_PRICE, BUY_MEMO));
            Assert.Equal(BigInteger.Zero, game.creditOf(bob));
        }

        [Fact]
        public void LastSurvivor_SettlePaysLastBuyerWholePotAndRollsRound()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 1 * GAS);
            Fund(engine, bob, 1 * GAS);

            // Alice buys 2 keys, then Bob buys 1 — Bob is the last buyer.
            BigInteger costAlice = ExpectedCost(0, 2);
            BigInteger costBob = ExpectedCost(2, 1);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, game.Hash, costAlice, BUY_MEMO);
            game.buyKeys(alice, 2);
            engine.SetTransactionSigners(bob);
            engine.Native.GAS.Transfer(bob, game.Hash, costBob, BUY_MEMO);
            game.buyKeys(bob, 1);

            // The countdown (3 keys x 30s) has not expired yet.
            Assert.ThrowsAny<Exception>(() => game.settle());

            // Push the persisting block past the round deadline.
            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(91));

            BigInteger pot = costAlice + costBob;
            BigInteger bobBefore = engine.Native.GAS.BalanceOf(bob) ?? 0;
            engine.SetTransactionSigners(alice); // settle is permissionless — anyone may call
            Assert.Equal(pot, game.settle());
            // Pull-payment: the winner (Bob) is CREDITED the whole pot, not paid directly,
            // so a contract winner that rejects GAS can never brick settle().
            Assert.Equal(pot, game.creditOf(bob));
            Assert.Equal(bobBefore, engine.Native.GAS.BalanceOf(bob)); // not paid until claimed
            Assert.Equal(new BigInteger(2), game.currentRoundId());

            // The winner claims the pot via Withdraw.
            engine.SetTransactionSigners(bob);
            Assert.Equal(pot, game.withdraw(bob));
            Assert.Equal(bobBefore + pot, engine.Native.GAS.BalanceOf(bob));

            // Solvency: the contract holds nothing after the winner has claimed.
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(game.Hash));

            // The fresh round has no keys to settle.
            Assert.ThrowsAny<Exception>(() => game.settle());
        }

        [Fact]
        public void LastSurvivor_ExpiredRoundBlocksBuysUntilSettled()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 1 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, game.Hash, 3 * BASE_KEY_PRICE, BUY_MEMO);
            game.buyKeys(alice, 1);

            engine.PersistingBlock.Advance(TimeSpan.FromSeconds(31));

            // Round 1 is over: buying must fail until somebody settles.
            Assert.ThrowsAny<Exception>(() => game.buyKeys(alice, 1));
            game.settle();

            // Round 2 starts pristine — base price again, credit still spendable.
            Assert.Equal(new BigInteger(2), game.currentRoundId());
            Assert.Equal(new BigInteger(BASE_KEY_PRICE), game.currentKeyCost(1));
            Assert.Equal(new BigInteger(BASE_KEY_PRICE), game.buyKeys(alice, 1));
            Assert.Equal(BigInteger.One, game.playerKeys(2, alice));
        }

        [Fact]
        public void LastSurvivor_WithdrawRefundsUnusedCredit()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppLastSurvivor");
            var game = engine.Deploy<LastSurvivorContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, game.Hash, 1 * GAS, BUY_MEMO);
            game.buyKeys(alice, 1); // consumes 0.1 GAS into the pot

            BigInteger refund = 1 * GAS - BASE_KEY_PRICE;
            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(refund, game.withdraw(alice));
            Assert.Equal(before + refund, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, game.creditOf(alice));

            // Solvency: only the live pot remains inside the contract.
            Assert.Equal(new BigInteger(BASE_KEY_PRICE), engine.Native.GAS.BalanceOf(game.Hash));

            Assert.ThrowsAny<Exception>(() => game.withdraw(alice));
        }
    }
}
