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
    public abstract class TipJarContract : SmartContract
    {
        protected TipJarContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? registerDeveloper(UInt160 wallet, string name, string role);
        public abstract BigInteger? tip(UInt160 tipper, BigInteger devId, BigInteger amount, bool anonymous);
        public abstract BigInteger? withdrawTips(BigInteger devId);
        public abstract BigInteger? withdraw(UInt160 account);
        public abstract BigInteger? creditOf(UInt160 tipper);
        public abstract BigInteger? developerIdOf(UInt160 wallet);
        public abstract BigInteger? totalDevelopers();
        public abstract BigInteger? totalDonated();
        public abstract BigInteger? tipsCount();
        public abstract BigInteger? minTip();
    }

    public class MiniAppTipJarTests
    {
        private const long GAS = 100000000; // 1 GAS base units
        private const long MIN_TIP = 100000; // 0.001 GAS
        private const string TIP_MEMO = "miniapp-devtipping:tip";

        // The TipJar NEF is produced into the shared contracts/build dir by
        // contracts/build.sh, like every other contract artifact these suites load.
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
        public void TipJar_RegisterTipWithdrawLifecycle()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTipJar");
            var jar = engine.Deploy<TipJarContract>(nef, manifest);
            Assert.Equal(new BigInteger(MIN_TIP), jar.minTip());

            var dave = TestEngine.GetNewSigner().Account;   // developer
            var alice = TestEngine.GetNewSigner().Account;   // tipper
            Fund(engine, dave, 1 * GAS);
            Fund(engine, alice, 2 * GAS);

            // Developer self-registers exactly once.
            engine.SetTransactionSigners(dave);
            Assert.Equal(BigInteger.One, jar.registerDeveloper(dave, "Dave", "Core"));
            Assert.Equal(BigInteger.One, jar.developerIdOf(dave));
            Assert.Equal(BigInteger.One, jar.totalDevelopers());
            Assert.ThrowsAny<Exception>(() => jar.registerDeveloper(dave, "Dave Again", "Core"));

            // Tipper deposits 1 GAS of credit and sends two tips.
            engine.SetTransactionSigners(alice);
            bool? ok = engine.Native.GAS.Transfer(alice, jar.Hash, 1 * GAS, TIP_MEMO);
            Assert.True(ok == true, "deposit transfer should succeed");
            Assert.Equal(new BigInteger(1 * GAS), jar.creditOf(alice));

            Assert.Equal(BigInteger.One, jar.tip(alice, 1, 4 * GAS / 10, false));
            Assert.Equal(new BigInteger(2), jar.tip(alice, 1, 1 * GAS / 10, true));
            Assert.Equal(new BigInteger(5 * GAS / 10), jar.creditOf(alice));
            Assert.Equal(new BigInteger(5 * GAS / 10), jar.totalDonated());
            Assert.Equal(new BigInteger(2), jar.tipsCount());

            // The developer withdraws the accrued 0.5 GAS to their wallet.
            engine.SetTransactionSigners(dave);
            BigInteger daveBefore = engine.Native.GAS.BalanceOf(dave) ?? 0;
            Assert.Equal(new BigInteger(5 * GAS / 10), jar.withdrawTips(1));
            Assert.Equal(daveBefore + 5 * GAS / 10, engine.Native.GAS.BalanceOf(dave));
            Assert.ThrowsAny<Exception>(() => jar.withdrawTips(1)); // nothing claimable left

            // Solvency: only Alice's unspent credit remains in the contract...
            Assert.Equal(new BigInteger(5 * GAS / 10), engine.Native.GAS.BalanceOf(jar.Hash));

            // ...and she can reclaim it in full.
            engine.SetTransactionSigners(alice);
            Assert.Equal(new BigInteger(5 * GAS / 10), jar.withdraw(alice));
            Assert.Equal(BigInteger.Zero, jar.creditOf(alice));
            Assert.Equal(BigInteger.Zero, engine.Native.GAS.BalanceOf(jar.Hash));
        }

        [Fact]
        public void TipJar_TipGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTipJar");
            var jar = engine.Deploy<TipJarContract>(nef, manifest);

            var dave = TestEngine.GetNewSigner().Account;
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, dave, 1 * GAS);
            Fund(engine, alice, 2 * GAS);

            engine.SetTransactionSigners(dave);
            jar.registerDeveloper(dave, "Dave", "Core");

            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, jar.Hash, 1 * GAS, TIP_MEMO);

            // Below the 0.001 GAS minimum.
            Assert.ThrowsAny<Exception>(() => jar.tip(alice, 1, MIN_TIP - 1, false));
            // Unknown developer.
            Assert.ThrowsAny<Exception>(() => jar.tip(alice, 99, MIN_TIP, false));
            // More than the prepaid credit.
            Assert.ThrowsAny<Exception>(() => jar.tip(alice, 1, 2 * GAS, false));

            // Another account cannot spend Alice's credit (witness check).
            var mallory = TestEngine.GetNewSigner().Account;
            engine.SetTransactionSigners(mallory);
            Assert.ThrowsAny<Exception>(() => jar.tip(alice, 1, MIN_TIP, false));

            Assert.Equal(new BigInteger(1 * GAS), jar.creditOf(alice));
            Assert.Equal(BigInteger.Zero, jar.totalDonated());
        }

        [Fact]
        public void TipJar_RegisterGuards()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTipJar");
            var jar = engine.Deploy<TipJarContract>(nef, manifest);

            var dave = TestEngine.GetNewSigner().Account;
            Fund(engine, dave, 1 * GAS);
            engine.SetTransactionSigners(dave);

            // Empty and oversized names are rejected.
            Assert.ThrowsAny<Exception>(() => jar.registerDeveloper(dave, "", "Core"));
            Assert.ThrowsAny<Exception>(() => jar.registerDeveloper(dave, new string('x', 65), "Core"));
            Assert.ThrowsAny<Exception>(() => jar.registerDeveloper(dave, "Dave", new string('x', 65)));

            // A wallet can only be registered under its own witness.
            var mallory = TestEngine.GetNewSigner().Account;
            Assert.ThrowsAny<Exception>(() => jar.registerDeveloper(mallory, "Mallory", "Core"));

            Assert.Equal(BigInteger.Zero, jar.totalDevelopers());

            // Two distinct developers get sequential ids.
            jar.registerDeveloper(dave, "Dave", "Core");
            engine.SetTransactionSigners(mallory);
            Assert.Equal(new BigInteger(2), jar.registerDeveloper(mallory, "Mallory", "Design"));
            Assert.Equal(new BigInteger(2), jar.developerIdOf(mallory));
        }

        [Fact]
        public void TipJar_WithdrawTipsRequiresDeveloperWitness()
        {
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTipJar");
            var jar = engine.Deploy<TipJarContract>(nef, manifest);

            var dave = TestEngine.GetNewSigner().Account;
            var alice = TestEngine.GetNewSigner().Account;
            Fund(engine, dave, 1 * GAS);
            Fund(engine, alice, 1 * GAS);

            engine.SetTransactionSigners(dave);
            jar.registerDeveloper(dave, "Dave", "Core");
            engine.SetTransactionSigners(alice);
            engine.Native.GAS.Transfer(alice, jar.Hash, GAS / 2, TIP_MEMO);
            jar.tip(alice, 1, GAS / 2, false);

            // Alice (not the developer) cannot pull Dave's claimable tips.
            Assert.ThrowsAny<Exception>(() => jar.withdrawTips(1));
            // Unknown developer id.
            Assert.ThrowsAny<Exception>(() => jar.withdrawTips(42));

            engine.SetTransactionSigners(dave);
            Assert.Equal(new BigInteger(GAS / 2), jar.withdrawTips(1));
        }

        [Fact]
        public void TipJar_OnPaymentRejectsDirectNonGasCallers()
        {
            // NOTE: a transfer whose OnNEP17Payment callback FAULTs (wrong memo /
            // wrong asset) hangs the TestEngine host, so those rejections are only
            // exercised live (deploy/scripts/live_validate_tipjar.mjs). What CAN run
            // here is the same guard's first line of defense: a direct invocation
            // is not a GAS callback and must revert before crediting.
            var engine = new TestEngine(true);
            var (nef, manifest) = Load("MiniAppTipJar");
            var jar = engine.Deploy<TipJarContract>(nef, manifest);

            var bob = TestEngine.GetNewSigner().Account;
            Fund(engine, bob, 1 * GAS);
            engine.SetTransactionSigners(bob);
            Assert.ThrowsAny<Exception>(() => jar.onNEP17Payment(bob, MIN_TIP, TIP_MEMO));
            Assert.Equal(BigInteger.Zero, jar.creditOf(bob));
        }
    }
}
