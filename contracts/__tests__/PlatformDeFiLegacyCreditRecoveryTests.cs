using System;
using System.IO;
using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformDeFiLegacyCreditFixtureContract : SmartContract
    {
        protected PlatformDeFiLegacyCreditFixtureContract(
            SmartContractInitialize initialize) : base(initialize) { }

        public abstract void setPaused(bool paused);
        public abstract void sweepGas(UInt160 recipient, BigInteger amount);
        public abstract void update(byte[] nef, string manifest);
    }

    public abstract class PlatformDeFiLegacyCreditRecoveryContract : SmartContract
    {
        protected PlatformDeFiLegacyCreditRecoveryContract(
            SmartContractInitialize initialize) : base(initialize) { }

        public abstract bool? isPaused();
        public abstract void setPaused(bool paused);
        public abstract BigInteger? legacyCreditRecoveryState();
        public abstract byte[]? legacyCreditSnapshotHash();
        public abstract BigInteger? legacyNeoCreditLiability();
        public abstract BigInteger? legacyGasCreditLiability();
        public abstract BigInteger? legacyNeoCreditRows();
        public abstract BigInteger? legacyGasCreditRows();
        public abstract BigInteger? getLegacyNeoCredit(UInt160 payer);
        public abstract BigInteger? getLegacyGasCredit(UInt160 payer);
        public abstract BigInteger? totalNeoCreditLiability();
        public abstract BigInteger? totalGasCreditLiability();
        public abstract void initializeLegacyCreditRecovery(
            UInt160[] neoPayers,
            UInt160[] gasPayers,
            byte[] snapshotHash);
        public abstract void activateLegacyCreditRecovery();
        public abstract BigInteger? withdrawLegacyNeoCredit(
            UInt160 payer,
            BigInteger amount);
        public abstract BigInteger? withdrawLegacyGasCredit(
            UInt160 payer,
            BigInteger amount);
    }

    public class PlatformDeFiLegacyCreditRecoveryTests
    {
        private const long LegacyGasCredit = 16L * GAS_UNIT;
        private const long BackingGap = 134_226_336;
        private const string TopUpMemo = "platform-defi:legacy-credit-topup";

        private sealed class UpgradeWorld
        {
            public TestEngine Engine = null!;
            public PlatformDeFiLegacyCreditRecoveryContract DeFi = null!;
            public UInt160 Alice = null!;
            public byte[] SnapshotHash = null!;
        }

        private static (byte[] nef, string manifest) CurrentArtifact()
        {
            var (_, manifest) = Load("PlatformDeFi");
            byte[] nef = File.ReadAllBytes(
                Path.Combine(BuildDir, "PlatformDeFi.nef"));
            return (nef, manifest.ToJson().ToString());
        }

        private static UpgradeWorld UpgradeUnderbackedLegacyCredit()
        {
            var engine = new TestEngine(true);
            engine.Fee = 2_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (fixtureNef, fixtureManifest) =
                Load("PlatformDeFiLegacyCreditFixture");
            var fixture = engine.Deploy<PlatformDeFiLegacyCreditFixtureContract>(
                fixtureNef,
                fixtureManifest);
            UInt160 alice = TestEngine.GetNewSigner().Account;

            engine.Native.GAS.Transfer(
                engine.ValidatorsAddress,
                alice,
                LegacyGasCredit,
                null);
            engine.SetTransactionSigners(alice);
            Assert.True(engine.Native.GAS.Transfer(
                alice,
                fixture.Hash,
                LegacyGasCredit,
                "legacy-credit") == true);

            engine.SetTransactionSigners(engine.ValidatorsAddress);
            fixture.sweepGas(engine.ValidatorsAddress, BackingGap);
            fixture.setPaused(true);
            var (nef, manifest) = CurrentArtifact();
            fixture.update(nef, manifest);

            var defi = engine.FromHash<PlatformDeFiLegacyCreditRecoveryContract>(
                fixture.Hash,
                false);
            return new UpgradeWorld
            {
                Engine = engine,
                DeFi = defi,
                Alice = alice,
                SnapshotHash = new byte[32],
            };
        }

        [Fact]
        public void UpgradeRequiresSnapshotBackingThenPreservesLegacyWithdrawal()
        {
            UpgradeWorld world = UpgradeUnderbackedLegacyCredit();

            Assert.True(world.DeFi.isPaused());
            Assert.Equal(BigInteger.One, world.DeFi.legacyCreditRecoveryState());

            world.DeFi.initializeLegacyCreditRecovery(
                Array.Empty<UInt160>(),
                new[] { world.Alice },
                world.SnapshotHash);
            Assert.Equal(new BigInteger(2), world.DeFi.legacyCreditRecoveryState());
            Assert.Equal(BigInteger.Zero, world.DeFi.legacyNeoCreditLiability());
            Assert.Equal(new BigInteger(LegacyGasCredit), world.DeFi.legacyGasCreditLiability());
            Assert.Equal(BigInteger.Zero, world.DeFi.legacyNeoCreditRows());
            Assert.Equal(BigInteger.One, world.DeFi.legacyGasCreditRows());
            Assert.Equal(
                new BigInteger(LegacyGasCredit),
                world.DeFi.getLegacyGasCredit(world.Alice));
            Assert.Equal(BigInteger.Zero, world.DeFi.totalGasCreditLiability());

            AssertRevert(
                "GAS credit insolvent",
                () => world.DeFi.activateLegacyCreditRecovery());
            AssertRevert(
                "legacy credit recovery not active",
                () => world.DeFi.setPaused(false));

            world.Engine.SetTransactionSigners(world.Alice);
            AssertRevert(
                "legacy recovery not active",
                () => world.DeFi.withdrawLegacyGasCredit(
                    world.Alice,
                    LegacyGasCredit));

            world.Engine.SetTransactionSigners(world.Engine.ValidatorsAddress);
            Assert.True(world.Engine.Native.GAS.Transfer(
                world.Engine.ValidatorsAddress,
                world.DeFi.Hash,
                BackingGap,
                TopUpMemo) == true);
            Assert.Equal(BigInteger.Zero, world.DeFi.totalGasCreditLiability());
            world.DeFi.activateLegacyCreditRecovery();
            Assert.Equal(new BigInteger(3), world.DeFi.legacyCreditRecoveryState());

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(
                new BigInteger(LegacyGasCredit),
                world.DeFi.withdrawLegacyGasCredit(
                    world.Alice,
                    LegacyGasCredit));
            Assert.Equal(new BigInteger(4), world.DeFi.legacyCreditRecoveryState());
            Assert.Equal(BigInteger.Zero, world.DeFi.legacyGasCreditLiability());
            Assert.Equal(BigInteger.Zero, world.DeFi.getLegacyGasCredit(world.Alice));

            world.Engine.SetTransactionSigners(world.Engine.ValidatorsAddress);
            world.DeFi.setPaused(false);
            Assert.False(world.DeFi.isPaused());
        }

        [Fact]
        public void SnapshotRejectsDuplicatePayers()
        {
            UpgradeWorld world = UpgradeUnderbackedLegacyCredit();

            AssertRevert(
                "duplicate legacy payer",
                () => world.DeFi.initializeLegacyCreditRecovery(
                    Array.Empty<UInt160>(),
                    new[] { world.Alice, world.Alice },
                    world.SnapshotHash));
            Assert.Equal(BigInteger.One, world.DeFi.legacyCreditRecoveryState());
        }

        [Fact]
        public void FreshDeploymentStartsRecoveryComplete()
        {
            var engine = new TestEngine(true);
            engine.Fee = 2_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load("PlatformDeFi");
            var defi = engine.Deploy<PlatformDeFiLegacyCreditRecoveryContract>(
                nef,
                manifest);

            Assert.Equal(new BigInteger(4), defi.legacyCreditRecoveryState());
            Assert.False(defi.isPaused());
            defi.setPaused(true);
            defi.setPaused(false);
            Assert.False(defi.isPaused());
        }
    }
}
