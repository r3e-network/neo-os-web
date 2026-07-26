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
    public abstract class MoneyBaseFixtureContract : SmartContract
    {
        protected MoneyBaseFixtureContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract void pay(UInt160 from, UInt160 to, BigInteger amount);
        public abstract BigInteger? roll(BigInteger bound);
        public abstract BigInteger? creditOf(UInt160 account);
    }

    /// <summary>
    /// TestEngine proof for contracts/MiniApp.DevPack/MiniAppMoneyBase.cs via its
    /// reference contract MiniAppMoneyBaseFixture (compiled by contracts/build.sh
    /// into contracts/build/, like every other contract NEF these suites load).
    /// </summary>
    public class MiniAppMoneyBaseTests
    {
        private const long GAS = 100000000; // 1 GAS base units
        private const string DEPOSIT_MEMO = "miniapp-moneybase:deposit";

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

        [Fact]
        public void MoneyBase_DepositCreditsLedgerAndWithdrawRefunds()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMoneyBaseFixture");
            var money = engine.Deploy<MoneyBaseFixtureContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 3 * GAS);

            // Deposits accumulate in the credit ledger.
            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.GAS.Transfer(alice, money.Hash, 1 * GAS, DEPOSIT_MEMO);
            Assert.True(ok == true, "deposit transfer should succeed");
            engine.Native.GAS.Transfer(alice, money.Hash, GAS / 2, DEPOSIT_MEMO);
            Assert.Equal(new BigInteger(3 * GAS / 2), money.creditOf(alice));
            Assert.Equal(new BigInteger(3 * GAS / 2), engine.Native.GAS.BalanceOf(money.Hash));

            // Nobody else can pull Alice's credit (witness check in WithdrawGasCredit).
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => money.withdraw(alice));

            // Withdraw refunds the whole credit and empties the ledger entry.
            engine.SetTransactionSigners(alice);
            BigInteger before = engine.Native.GAS.BalanceOf(alice) ?? 0;
            Assert.Equal(new BigInteger(3 * GAS / 2), money.withdraw(alice));
            Assert.Equal(before + 3 * GAS / 2, engine.Native.GAS.BalanceOf(alice));
            Assert.Equal(BigInteger.Zero, money.creditOf(alice));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(money.Hash));

            // Empty credit cannot be withdrawn again.
            Assert.ThrowsAny<Exception>(() => money.withdraw(alice));
        }

        [Fact]
        public void MoneyBase_ByteArrayMemoCreditsTheSameLedger()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMoneyBaseFixture");
            var money = engine.Deploy<MoneyBaseFixtureContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);

            engine.SetTransactionSigners(alice);
            Assert.True(engine.Native.GAS.Transfer(
                alice,
                money.Hash,
                GAS,
                System.Text.Encoding.UTF8.GetBytes(DEPOSIT_MEMO)) == true);

            Assert.Equal(new BigInteger(GAS), money.creditOf(alice));
        }

        [Fact]
        public void MoneyBase_PayConsumesCreditAndMovesRealGas()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMoneyBaseFixture");
            var money = engine.Deploy<MoneyBaseFixtureContract>(nef, manifest);

            var alice = TestEngine.GetNewSigner().Account;
            var carol = TestEngine.GetNewSigner().Account;
            Fund(engine, alice, 2 * GAS);

            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, money.Hash, 1 * GAS, DEPOSIT_MEMO);

            // ConsumeGasCredit + TransferGasChecked: a real GAS payment to Carol.
            money.pay(alice, carol, 4 * GAS / 10);
            Assert.Equal(new BigInteger(4 * GAS / 10), engine.Native.GAS.BalanceOf(carol));
            Assert.Equal(new BigInteger(6 * GAS / 10), money.creditOf(alice));

            // Solvency: the contract holds exactly the outstanding credit.
            Assert.Equal(new BigInteger(6 * GAS / 10), engine.Native.GAS.BalanceOf(money.Hash));

            // Pool a second depositor so an overspend would be covered by the
            // contract's GAS balance if the ledger check were missing: Alice must
            // still be stopped by HER credit, not by the contract running dry.
            var dave = TestEngine.GetNewSigner().Account;
            Fund(engine, dave, 2 * GAS);
            engine.SetTransactionSigners(dave);
            engine.Native.GAS.Transfer(dave, money.Hash, 1 * GAS, DEPOSIT_MEMO);

            // Spending past Alice's credit balance reverts.
            engine.SetTransactionSigners(alice);
            Assert.ThrowsAny<Exception>(() => money.pay(alice, carol, 1 * GAS));
            Assert.Equal(new BigInteger(1 * GAS), money.creditOf(dave));
            // Zero/negative amounts revert.
            Assert.ThrowsAny<Exception>(() => money.pay(alice, carol, 0));
            Assert.ThrowsAny<Exception>(() => money.pay(alice, carol, -1));

            // Nobody else can spend Alice's credit (witness check).
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => money.pay(alice, mallory, GAS / 10));
            Assert.Equal(new BigInteger(6 * GAS / 10), money.creditOf(alice));
        }

        [Fact]
        public void MoneyBase_OnPaymentRejectsDirectNonGasCallers()
        {
            // NOTE: a transfer whose OnNEP17Payment callback FAULTs (wrong memo /
            // wrong asset) hangs the TestEngine host, so CreditGasDeposit's memo and
            // asset rejections can only be asserted through this direct-call vector:
            // any invocation that is not a callback from the native GAS contract
            // must revert before touching the credit ledger.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMoneyBaseFixture");
            var money = engine.Deploy<MoneyBaseFixtureContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => money.onNEP17Payment(bob, GAS / 10, DEPOSIT_MEMO));
            Assert.Equal(BigInteger.Zero, money.creditOf(bob));
        }

        [Fact]
        public void MoneyBase_RollStaysWithinBound()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppMoneyBaseFixture");
            var money = engine.Deploy<MoneyBaseFixtureContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);

            // Invariant-style randomness asserts: whatever the beacon yields, the
            // roll must stay inside [0, bound).
            foreach (long bound in new long[] { 2, 13, 78, 1000000 })
            {
                BigInteger? rolled = money.roll(bound);
                Assert.NotNull(rolled);
                Assert.True(rolled >= 0 && rolled < bound, $"roll {rolled} outside [0, {bound})");
            }

            // A bound of one only has one outcome.
            Assert.Equal(BigInteger.Zero, money.roll(1));

            // Degenerate bounds are rejected.
            Assert.ThrowsAny<Exception>(() => money.roll(0));
            Assert.ThrowsAny<Exception>(() => money.roll(-7));
        }
    }
}
