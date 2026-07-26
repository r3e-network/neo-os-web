using System;
using System.IO;
using System.Numerics;
using System.Text;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformVestingContract : SmartContract
    {
        protected PlatformVestingContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerApp(string appId, UInt160 appAdmin);
        public abstract void setAppPaused(string appId, bool paused);
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? createStream(string appId, UInt160 creator, UInt160 beneficiary, UInt160 asset,
            BigInteger totalAmount, BigInteger rateAmount, BigInteger intervalSeconds, string title, string notes);
        public abstract BigInteger? claimStream(string appId, UInt160 beneficiary, BigInteger streamId);
        public abstract BigInteger? cancelStream(string appId, UInt160 creator, BigInteger streamId);
        public abstract BigInteger? withdrawCredit(string appId, UInt160 payer, UInt160 asset, BigInteger amount);
        public abstract BigInteger? creditOf(string appId, UInt160 asset, UInt160 payer);
        public abstract BigInteger? creditLiabilityOf(string appId, UInt160 asset);
        public abstract BigInteger? streamLiabilityOf(string appId, UInt160 asset);
        public abstract BigInteger? totalCreditLiability(UInt160 asset);
        public abstract BigInteger? totalStreams(string appId);
        public abstract BigInteger? claimableOf(string appId, BigInteger streamId);
        public abstract object? getStreamDetails(string appId, BigInteger streamId);
        public abstract object[]? getUserStreams(string appId, UInt160 creator, BigInteger offset, BigInteger limit);
        public abstract object[]? getBeneficiaryStreams(string appId, UInt160 beneficiary, BigInteger offset, BigInteger limit);
    }

    public class PlatformVestingTests
    {
        private const long GAS = 100_000_000;
        private const string AppA = "vesting-a";
        private const string AppB = "vesting-b";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformVestingContract Vesting = null!;
            public UInt160 Alice = null!;
            public UInt160 Bob = null!;
        }

        private static (NefFile nef, ContractManifest manifest) Load()
        {
            string nefPath = Path.Combine(BuildDir, "PlatformVesting.nef");
            string manifestPath = Path.Combine(BuildDir, "PlatformVesting.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static World Setup()
        {
            var engine = new TestEngine(true)
            {
                Fee = 2_000L * GAS
            };
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load();
            var vesting = engine.Deploy<PlatformVestingContract>(nef, manifest);
            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            vesting.registerApp(AppA, alice);
            vesting.registerApp(AppB, alice);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, alice, 100 * GAS, null);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, bob, 10 * GAS, null);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, alice, 100, null);
            return new World { Engine = engine, Vesting = vesting, Alice = alice, Bob = bob };
        }

        private static void DepositGas(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.GAS.Transfer(
                world.Alice, world.Vesting.Hash, amount, appId + ":fund") == true);
        }

        private static void DepositNeo(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.NEO.Transfer(
                world.Alice, world.Vesting.Hash, amount, appId + ":fund") == true);
        }

        [Fact]
        public void Credits_AreIsolatedAcrossAssetsAndTenants()
        {
            World world = Setup();
            DepositGas(world, AppA, 3 * GAS);
            DepositGas(world, AppB, 4 * GAS);
            DepositNeo(world, AppA, 7);

            Assert.Equal(new BigInteger(3 * GAS), world.Vesting.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS), world.Vesting.creditOf(AppB, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(7), world.Vesting.creditOf(AppA, world.Engine.Native.NEO.Hash, world.Alice));
            Assert.Equal(new BigInteger(7 * GAS), world.Vesting.totalCreditLiability(world.Engine.Native.GAS.Hash));
            Assert.Equal(new BigInteger(7), world.Vesting.totalCreditLiability(world.Engine.Native.NEO.Hash));

            world.Engine.SetTransactionSigners(world.Alice);
            world.Vesting.setAppPaused(AppA, true);
            Assert.Equal(new BigInteger(1 * GAS), world.Vesting.withdrawCredit(AppA, world.Alice, world.Engine.Native.GAS.Hash, GAS));
            Assert.Equal(new BigInteger(2 * GAS), world.Vesting.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS), world.Vesting.creditOf(AppB, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(6 * GAS), world.Vesting.totalCreditLiability(world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void Stream_ClaimAndCancelKeepLiabilitiesExact()
        {
            World world = Setup();
            DepositGas(world, AppA, 10 * GAS);

            world.Engine.SetTransactionSigners(world.Alice);
            BigInteger streamId = world.Vesting.createStream(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash, 4 * GAS, 2 * GAS, 1, "Salary", "Weekly stream")!.Value;

            Assert.Equal(BigInteger.One, streamId);
            Assert.Equal(new BigInteger(6 * GAS), world.Vesting.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS), world.Vesting.streamLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
            Assert.Equal(BigInteger.One, world.Vesting.totalStreams(AppA));
            Assert.Single(world.Vesting.getUserStreams(AppA, world.Alice, 0, 10)!);
            Assert.Single(world.Vesting.getBeneficiaryStreams(AppA, world.Bob, 0, 10)!);

            world.Engine.PersistingBlock.Advance(TimeSpan.FromSeconds(1));
            world.Engine.SetTransactionSigners(world.Bob);
            Assert.Equal(new BigInteger(2 * GAS), world.Vesting.claimStream(AppA, world.Bob, streamId));
            Assert.Equal(new BigInteger(2 * GAS), world.Vesting.streamLiabilityOf(AppA, world.Engine.Native.GAS.Hash));

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(new BigInteger(2 * GAS), world.Vesting.cancelStream(AppA, world.Alice, streamId));
            Assert.Equal(BigInteger.Zero, world.Vesting.streamLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
            Assert.Equal(BigInteger.Zero, world.Vesting.claimableOf(AppA, streamId));
        }

        [Fact]
        public void DirectCallbackInvocationCannotForgeCredit()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.ThrowsAny<Exception>(() => world.Vesting.onNEP17Payment(
                world.Alice, GAS, AppA + ":fund"));
            Assert.Equal(BigInteger.Zero, world.Vesting.totalCreditLiability(world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void ByteArrayFundingMemoRoutesToTheSameTenantLedger()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            byte[] memo = Encoding.UTF8.GetBytes(AppA + ":fund");

            Assert.True(world.Engine.Native.GAS.Transfer(world.Alice, world.Vesting.Hash, GAS, memo) == true);
            Assert.Equal(new BigInteger(GAS), world.Vesting.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(GAS), world.Vesting.creditLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
        }
    }
}
