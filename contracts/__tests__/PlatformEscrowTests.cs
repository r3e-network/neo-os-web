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
    public abstract class PlatformEscrowContract : SmartContract
    {
        protected PlatformEscrowContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerApp(string appId, UInt160 appAdmin);
        public abstract void setAppPaused(string appId, bool paused);
        public abstract void setDescriptor(string appId, string key, object value);
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object? data);
        public abstract BigInteger? createEscrow(string appId, UInt160 creator, UInt160 beneficiary, UInt160 asset,
            BigInteger totalAmount, object[] milestoneAmounts, string title, string notes);
        public abstract BigInteger? createEscrowWithApprovers(string appId, UInt160 creator, UInt160 beneficiary, UInt160 asset,
            BigInteger totalAmount, object[] milestoneAmounts, object[] approvers, BigInteger approvalThreshold, string title, string notes);
        public abstract void approveMilestone(string appId, UInt160 creator, BigInteger escrowId, BigInteger milestoneIndex);
        public abstract void claimMilestone(string appId, UInt160 beneficiary, BigInteger escrowId, BigInteger milestoneIndex);
        public abstract void cancelEscrow(string appId, UInt160 creator, BigInteger escrowId);
        public abstract void reclaimApprovedMilestone(string appId, UInt160 creator, BigInteger escrowId, BigInteger milestoneIndex);
        public abstract BigInteger? withdrawCredit(string appId, UInt160 payer, UInt160 asset, BigInteger amount);
        public abstract BigInteger? creditOf(string appId, UInt160 asset, UInt160 payer);
        public abstract BigInteger? creditLiabilityOf(string appId, UInt160 asset);
        public abstract BigInteger? escrowLiabilityOf(string appId, UInt160 asset);
        public abstract BigInteger? totalEscrowLiability(UInt160 asset);
        public abstract BigInteger? totalEscrows(string appId);
        public abstract object? getEscrowDetails(string appId, BigInteger escrowId);
        public abstract object? getMilestoneDetails(string appId, BigInteger escrowId, BigInteger milestoneIndex);
    }

    public class PlatformEscrowTests
    {
        private const long GAS = 100_000_000;
        private const string AppA = "escrow-a";
        private const string AppB = "escrow-b";

        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformEscrowContract Escrow = null!;
            public UInt160 Alice = null!;
            public UInt160 Bob = null!;
        }

        private static (NefFile nef, ContractManifest manifest) Load()
        {
            string nefPath = Path.Combine(BuildDir, "PlatformEscrow.nef");
            string manifestPath = Path.Combine(BuildDir, "PlatformEscrow.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        private static World Setup()
        {
            var engine = new TestEngine(true) { Fee = 2_000L * GAS };
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load();
            var escrow = engine.Deploy<PlatformEscrowContract>(nef, manifest);
            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            escrow.registerApp(AppA, alice);
            escrow.registerApp(AppB, alice);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, alice, 100 * GAS, null);
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, bob, 10 * GAS, null);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, alice, 100, null);
            return new World { Engine = engine, Escrow = escrow, Alice = alice, Bob = bob };
        }

        private static void DepositGas(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.GAS.Transfer(
                world.Alice, world.Escrow.Hash, amount, appId + ":fund") == true);
        }

        [Fact]
        public void CreditsAndEscrowLiabilitiesStayTenantAndAssetScoped()
        {
            World world = Setup();
            DepositGas(world, AppA, 8 * GAS);
            DepositGas(world, AppB, 5 * GAS);

            world.Engine.SetTransactionSigners(world.Alice);
            BigInteger escrowId = world.Escrow.createEscrow(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash,
                4 * GAS, new object[] { new BigInteger(1 * GAS), new BigInteger(3 * GAS) },
                "Delivery", "Two releases")!.Value;

            Assert.Equal(BigInteger.One, escrowId);
            Assert.Equal(new BigInteger(4 * GAS), world.Escrow.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(5 * GAS), world.Escrow.creditOf(AppB, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS), world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
            Assert.Equal(new BigInteger(4 * GAS), world.Escrow.totalEscrowLiability(world.Engine.Native.GAS.Hash));
            Assert.Equal(BigInteger.One, world.Escrow.totalEscrows(AppA));
        }

        [Fact]
        public void ApproveClaimAndCancelKeepLiabilityExact()
        {
            World world = Setup();
            DepositGas(world, AppA, 10 * GAS);
            world.Engine.SetTransactionSigners(world.Alice);
            BigInteger escrowId = world.Escrow.createEscrow(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash,
                4 * GAS, new object[] { new BigInteger(2 * GAS), new BigInteger(2 * GAS) },
                "Milestones", "Acceptance")!.Value;

            world.Escrow.approveMilestone(AppA, world.Alice, escrowId, 1);
            world.Engine.PersistingBlock.Advance(TimeSpan.FromSeconds(1));
            world.Engine.SetTransactionSigners(world.Bob);
            world.Escrow.claimMilestone(AppA, world.Bob, escrowId, 1);
            Assert.Equal(new BigInteger(2 * GAS), world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));

            world.Engine.SetTransactionSigners(world.Alice);
            world.Escrow.cancelEscrow(AppA, world.Alice, escrowId);
            Assert.Equal(BigInteger.Zero, world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
            Assert.Equal(BigInteger.Zero, world.Escrow.totalEscrowLiability(world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void ExitsRemainAvailableWhileTenantIsPaused()
        {
            World world = Setup();
            DepositGas(world, AppA, 3 * GAS);
            world.Engine.SetTransactionSigners(world.Alice);
            BigInteger escrowId = world.Escrow.createEscrow(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash,
                2 * GAS, new object[] { new BigInteger(2 * GAS) }, "Paused", "Exit")!.Value;
            world.Escrow.approveMilestone(AppA, world.Alice, escrowId, 1);
            world.Escrow.setAppPaused(AppA, true);

            world.Engine.SetTransactionSigners(world.Bob);
            world.Escrow.claimMilestone(AppA, world.Bob, escrowId, 1);
            Assert.Equal(BigInteger.Zero, world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void ApprovedMilestoneCanBeReclaimedAfterConfiguredGrace()
        {
            World world = Setup();
            DepositGas(world, AppA, 2 * GAS);
            world.Engine.SetTransactionSigners(world.Alice);
            world.Escrow.setDescriptor(AppA, "escrow:approvalGraceMs", new BigInteger(1));
            BigInteger escrowId = world.Escrow.createEscrow(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash,
                2 * GAS, new object[] { new BigInteger(2 * GAS) }, "Recovery", "Timeout")!.Value;
            world.Escrow.approveMilestone(AppA, world.Alice, escrowId, 1);
            world.Engine.PersistingBlock.Advance(TimeSpan.FromMilliseconds(1));

            world.Escrow.reclaimApprovedMilestone(AppA, world.Alice, escrowId, 1);
            Assert.Equal(BigInteger.Zero, world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
            Assert.NotNull(world.Escrow.getEscrowDetails(AppA, escrowId));
        }

        [Fact]
        public void MultiApproverMilestoneRequiresThresholdAndRejectsDuplicates()
        {
            World world = Setup();
            var secondApprover = TestEngine.GetNewSigner().Account;
            world.Engine.SetTransactionSigners(world.Engine.ValidatorsAddress);
            world.Engine.Native.NEO.Transfer(world.Engine.ValidatorsAddress, secondApprover, 10, null);
            DepositGas(world, AppA, 3 * GAS);

            world.Engine.SetTransactionSigners(world.Alice);
            BigInteger escrowId = world.Escrow.createEscrowWithApprovers(
                AppA, world.Alice, world.Bob, world.Engine.Native.GAS.Hash,
                2 * GAS, new object[] { new BigInteger(2 * GAS) },
                new object[] { world.Alice, secondApprover }, 2,
                "Two-person approval", "Both approvers required")!.Value;

            world.Escrow.approveMilestone(AppA, world.Alice, escrowId, 1);
            Assert.ThrowsAny<Exception>(() => world.Escrow.claimMilestone(AppA, world.Bob, escrowId, 1));
            Assert.ThrowsAny<Exception>(() => world.Escrow.approveMilestone(AppA, world.Alice, escrowId, 1));

            world.Engine.SetTransactionSigners(secondApprover);
            world.Escrow.approveMilestone(AppA, secondApprover, escrowId, 1);
            world.Engine.SetTransactionSigners(world.Bob);
            world.Escrow.claimMilestone(AppA, world.Bob, escrowId, 1);
            Assert.Equal(BigInteger.Zero, world.Escrow.escrowLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void DirectCallbackInvocationCannotForgeCredit()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.ThrowsAny<Exception>(() => world.Escrow.onNEP17Payment(
                world.Alice, GAS, AppA + ":fund"));
            Assert.Equal(BigInteger.Zero, world.Escrow.creditLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
        }

        [Fact]
        public void ByteArrayFundingMemoRoutesToTheSameTenantLedger()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            byte[] memo = Encoding.UTF8.GetBytes(AppA + ":fund");

            Assert.True(world.Engine.Native.GAS.Transfer(world.Alice, world.Escrow.Hash, GAS, memo) == true);
            Assert.Equal(new BigInteger(GAS), world.Escrow.creditOf(AppA, world.Engine.Native.GAS.Hash, world.Alice));
            Assert.Equal(new BigInteger(GAS), world.Escrow.creditLiabilityOf(AppA, world.Engine.Native.GAS.Hash));
        }
    }
}
