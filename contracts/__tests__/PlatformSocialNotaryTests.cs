using System.Numerics;
using Neo;
using Neo.SmartContract.Testing;
using Xunit;
using static NeoMiniAppPlatform.Contracts.Tests.RegistryHarness;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class PlatformSocialNotaryContract : SmartContract
    {
        protected PlatformSocialNotaryContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract void registerApp(string appId, BigInteger appType, UInt160 appAdmin, string config);
        public abstract void setAppPaused(string appId, bool paused);
        public abstract void setPaused(bool paused);
        public abstract void notarize(string appId, UInt160 submitter, byte[] digest);
        public abstract object[]? getNotarization(string appId, byte[] digest);
        public abstract bool? isNotarized(string appId, byte[] digest);
        public abstract BigInteger? notarizationCount(string appId);
    }

    public class PlatformSocialNotaryTests
    {
        private const string AppA = "notary-a";
        private const string AppB = "notary-b";
        private const int AppTypeNotary = 4;

        private sealed class World
        {
            public TestEngine Engine = null!;
            public PlatformSocialNotaryContract Social = null!;
            public UInt160 Admin = null!;
            public UInt160 Alice = null!;
            public UInt160 Bob = null!;
        }

        private static World Setup()
        {
            var engine = new TestEngine(true);
            engine.Fee = 1_000L * GAS_UNIT;
            engine.SetTransactionSigners(engine.ValidatorsAddress);
            var (nef, manifest) = Load("PlatformSocial");
            var social = engine.Deploy<PlatformSocialNotaryContract>(nef, manifest);
            var alice = TestEngine.GetNewSigner().Account;
            var bob = TestEngine.GetNewSigner().Account;
            social.registerApp(AppA, AppTypeNotary, alice, "");
            social.registerApp(AppB, AppTypeNotary, bob, "");
            return new World
            {
                Engine = engine,
                Social = social,
                Admin = engine.ValidatorsAddress,
                Alice = alice,
                Bob = bob,
            };
        }

        private static byte[] Digest(byte value) => Enumerable.Repeat(value, 32).ToArray();

        [Fact]
        public void Notarize_StoresImmutableTenantScopedProof()
        {
            World w = Setup();
            byte[] digest = Digest(0x11);
            w.Engine.SetTransactionSigners(w.Alice);
            w.Social.notarize(AppA, w.Alice, digest);

            Assert.True(w.Social.isNotarized(AppA, digest));
            Assert.Equal(BigInteger.One, w.Social.notarizationCount(AppA));
            object[] row = w.Social.getNotarization(AppA, digest)!;
            Assert.Equal(w.Alice, AsHash(row[0]));
            Assert.True(AsInt(row[1]) > 0);
            Assert.True(AsInt(row[2]) >= 0);
            Assert.True(AsBool(row[3]));
            AssertRevert("digest already notarized", () => w.Social.notarize(AppA, w.Alice, digest));
        }

        [Fact]
        public void Notarize_IsolatesIdenticalDigestsAcrossTenants()
        {
            World w = Setup();
            byte[] digest = Digest(0x22);
            w.Engine.SetTransactionSigners(w.Alice);
            w.Social.notarize(AppA, w.Alice, digest);
            w.Engine.SetTransactionSigners(w.Bob);
            w.Social.notarize(AppB, w.Bob, digest);

            Assert.Equal(w.Alice, AsHash(w.Social.getNotarization(AppA, digest)![0]));
            Assert.Equal(w.Bob, AsHash(w.Social.getNotarization(AppB, digest)![0]));
            Assert.Equal(BigInteger.One, w.Social.notarizationCount(AppA));
            Assert.Equal(BigInteger.One, w.Social.notarizationCount(AppB));
        }

        [Fact]
        public void Notarize_EnforcesDigestWitnessTypeAndPauseBoundaries()
        {
            World w = Setup();
            byte[] digest = Digest(0x33);
            w.Engine.SetTransactionSigners(w.Bob);
            AssertRevert("submitter witness required", () => w.Social.notarize(AppA, w.Alice, digest));
            AssertRevert("invalid submitter", () => w.Social.notarize(AppA, UInt160.Zero, digest));
            w.Engine.SetTransactionSigners(w.Alice);
            AssertRevert("digest must be 32 bytes", () => w.Social.notarize(AppA, w.Alice, new byte[31]));

            w.Engine.SetTransactionSigners(w.Admin);
            w.Social.registerApp("wrong-type", 1, w.Alice, "");
            w.Engine.SetTransactionSigners(w.Alice);
            AssertRevert("wrong app type", () => w.Social.notarize("wrong-type", w.Alice, digest));
            w.Social.setAppPaused(AppA, true);
            AssertRevert("app paused", () => w.Social.notarize(AppA, w.Alice, digest));
            w.Social.setAppPaused(AppA, false);
            w.Engine.SetTransactionSigners(w.Admin);
            w.Social.setPaused(true);
            w.Engine.SetTransactionSigners(w.Alice);
            AssertRevert("platform paused", () => w.Social.notarize(AppA, w.Alice, digest));
        }

        [Fact]
        public void GetNotarization_ReturnsExplicitMissingState()
        {
            World w = Setup();
            object[] row = w.Social.getNotarization(AppA, Digest(0x44))!;
            Assert.Equal(UInt160.Zero, AsHash(row[0]));
            Assert.Equal(BigInteger.Zero, AsInt(row[1]));
            Assert.Equal(BigInteger.Zero, AsInt(row[2]));
            Assert.False(AsBool(row[3]));
            Assert.False(w.Social.isNotarized(AppA, Digest(0x44)));
        }
    }
}
