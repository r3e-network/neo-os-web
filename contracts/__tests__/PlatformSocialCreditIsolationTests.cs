using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformSocialCreditContract : SmartContract
    {
        protected PlatformSocialCreditContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerApp(string appId, BigInteger appType, UInt160 appAdmin, string config);
        public abstract void setAppPaused(string appId, bool paused);
        public abstract void onNEP17Payment(UInt160 from, BigInteger amount, object data);
        public abstract BigInteger? getDirectGasCredit(string appId, UInt160 payer);
        public abstract BigInteger? getDirectNeoCredit(string appId, UInt160 payer);
        public abstract BigInteger? gasCreditLiabilityOf(string appId);
        public abstract BigInteger? neoCreditLiabilityOf(string appId);
        public abstract BigInteger? totalGasCreditLiability();
        public abstract BigInteger? totalNeoCreditLiability();
        public abstract BigInteger? withdrawGasCredit(string appId, UInt160 user, BigInteger amount);
        public abstract BigInteger? withdrawNeoCredit(string appId, UInt160 user, BigInteger amount);
        public abstract BigInteger? createEnvelope(string appId, UInt160 creator, BigInteger packetCount, BigInteger expiryMs);
        public abstract BigInteger? createTrust(string appId, UInt160 owner, UInt160 heir, BigInteger heartbeatIntervalMs);
    }

    public class PlatformSocialCreditIsolationTests
    {
        private const string EnvelopeA = "envelope-a";
        private const string EnvelopeB = "envelope-b";
        private const string TrustA = "trust-a";
        private const string TrustB = "trust-b";
        private const long HeartbeatMinMs = 604_800_000L;

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformSocialCreditContract Social = null!;
            public UInt160 Alice = null!;
            public UInt160 Bob = null!;
        }

        private static World Setup()
        {
            var engine = new TestEngine(true);
            engine.Fee = 2_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load("PlatformSocial");
            var social = engine.Deploy<PlatformSocialCreditContract>(nef, manifest);
            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            social.registerApp(EnvelopeA, 1, alice, "");
            social.registerApp(EnvelopeB, 1, alice, "");
            social.registerApp(TrustA, 2, alice, "");
            social.registerApp(TrustB, 2, alice, "");
            engine.Native.GAS.Transfer(engine.ValidatorsAddress, alice, 20 * GAS_UNIT, null);
            engine.Native.NEO.Transfer(engine.ValidatorsAddress, alice, 20, null);
            return new World { Engine = engine, Social = social, Alice = alice, Bob = bob };
        }

        private static void DepositGas(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.GAS.Transfer(
                world.Alice,
                world.Social.Hash,
                amount,
                appId + ":credit") == true);
        }

        private static void DepositNeo(World world, string appId, BigInteger amount)
        {
            world.Engine.SetTransactionSigners(world.Alice);
            Assert.True(world.Engine.Native.NEO.Transfer(
                world.Alice,
                world.Social.Hash,
                amount,
                appId + ":credit") == true);
        }

        [Fact]
        public void GasCredit_IsolatedByTenantAndLiabilityTracksWithdrawals()
        {
            World world = Setup();
            DepositGas(world, EnvelopeA, 2 * GAS_UNIT);
            DepositGas(world, EnvelopeB, 3 * GAS_UNIT);

            Assert.Equal(new BigInteger(2 * GAS_UNIT), world.Social.getDirectGasCredit(EnvelopeA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.Social.getDirectGasCredit(EnvelopeB, world.Alice));
            Assert.Equal(new BigInteger(2 * GAS_UNIT), world.Social.gasCreditLiabilityOf(EnvelopeA));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.Social.gasCreditLiabilityOf(EnvelopeB));
            Assert.Equal(new BigInteger(5 * GAS_UNIT), world.Social.totalGasCreditLiability());

            world.Engine.SetTransactionSigners(world.Alice);
            world.Social.setAppPaused(EnvelopeA, true);
            Assert.Equal(new BigInteger(GAS_UNIT), world.Social.withdrawGasCredit(EnvelopeA, world.Alice, GAS_UNIT));
            Assert.Equal(new BigInteger(GAS_UNIT), world.Social.getDirectGasCredit(EnvelopeA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.Social.getDirectGasCredit(EnvelopeB, world.Alice));
            Assert.Equal(new BigInteger(4 * GAS_UNIT), world.Social.totalGasCreditLiability());
        }

        [Fact]
        public void EnvelopeConsumption_CannotSpendAnotherTenantCredit()
        {
            World world = Setup();
            DepositGas(world, EnvelopeA, 2 * GAS_UNIT);
            DepositGas(world, EnvelopeB, 3 * GAS_UNIT);

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(BigInteger.One, world.Social.createEnvelope(EnvelopeA, world.Alice, 1, 60_000));
            Assert.Equal(BigInteger.Zero, world.Social.getDirectGasCredit(EnvelopeA, world.Alice));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.Social.getDirectGasCredit(EnvelopeB, world.Alice));
            Assert.Equal(BigInteger.Zero, world.Social.gasCreditLiabilityOf(EnvelopeA));
            Assert.Equal(new BigInteger(3 * GAS_UNIT), world.Social.totalGasCreditLiability());
        }

        [Fact]
        public void NeoCredit_IsolatedByTenantAndTrustConsumesOnlyItsTenant()
        {
            World world = Setup();
            DepositNeo(world, TrustA, 3);
            DepositNeo(world, TrustB, 2);

            Assert.Equal(new BigInteger(3), world.Social.getDirectNeoCredit(TrustA, world.Alice));
            Assert.Equal(new BigInteger(2), world.Social.getDirectNeoCredit(TrustB, world.Alice));
            Assert.Equal(new BigInteger(5), world.Social.totalNeoCreditLiability());

            world.Engine.SetTransactionSigners(world.Alice);
            Assert.Equal(BigInteger.One, world.Social.createTrust(
                TrustA,
                world.Alice,
                world.Bob,
                HeartbeatMinMs));
            Assert.Equal(BigInteger.Zero, world.Social.getDirectNeoCredit(TrustA, world.Alice));
            Assert.Equal(new BigInteger(2), world.Social.getDirectNeoCredit(TrustB, world.Alice));
            Assert.Equal(BigInteger.Zero, world.Social.neoCreditLiabilityOf(TrustA));
            Assert.Equal(new BigInteger(2), world.Social.totalNeoCreditLiability());
        }

        [Fact]
        public void DirectCallsCannotForgeTokenCredit()
        {
            World world = Setup();
            world.Engine.SetTransactionSigners(world.Alice);
            AssertRevert("unsupported asset", () => world.Social.onNEP17Payment(world.Alice, GAS_UNIT, EnvelopeA + ":credit"));
            Assert.Equal(BigInteger.Zero, world.Social.totalGasCreditLiability());
            Assert.Equal(BigInteger.Zero, world.Social.totalNeoCreditLiability());
        }
    }
}
