using System;
using System.IO;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ABI binding for MiniAppFactory (only the members the A11 regression needs).
    public abstract class FactoryContract : SmartContract
    {
        protected FactoryContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract UInt160? admin();
        public abstract void registerTemplate(string templateId, string standard, string version,
            string nefHash, string manifestHash, string configSchemaHash);
        public abstract void registerTemplateArtifact(string templateId, byte[] nef, string manifest);
        public abstract bool? templateExists(string templateId);
        public abstract UInt160? deployFromTemplate(string templateId, string packageId, string digest, string initParamsJson);
        public abstract UInt160? deployArtifactFromTemplate(string templateId, string packageId, string digest,
            string initParamsJson, byte[] nef, string manifest);
        public abstract BigInteger? deploymentCount();
        public abstract Neo.VM.Types.Map? getDeployment(string packageId);
    }

    public class Fix_factory_Tests
    {
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

        // Raw .nef file bytes + manifest json text exactly as the on-chain caller
        // passes them to deployArtifactFromTemplate.
        private static (byte[] nef, string manifest) RawArtifact(string name)
        {
            string nefPath = Path.Combine(BuildDir, name + ".nef");
            string manifestPath = Path.Combine(BuildDir, name + ".manifest.json");
            return (File.ReadAllBytes(nefPath), File.ReadAllText(manifestPath));
        }

        // Mirror of MiniAppFactory.ComputeArtifactDigest:
        //   Base64(Sha256(nef || utf8(manifest) || utf8(initParams)))
        private static string ExpectedDigest(byte[] nef, string manifest, string initParams)
        {
            byte[] m = Encoding.UTF8.GetBytes(manifest);
            byte[] p = Encoding.UTF8.GetBytes(initParams);
            byte[] preimage = new byte[nef.Length + m.Length + p.Length];
            Buffer.BlockCopy(nef, 0, preimage, 0, nef.Length);
            Buffer.BlockCopy(m, 0, preimage, nef.Length, m.Length);
            Buffer.BlockCopy(p, 0, preimage, nef.Length + m.Length, p.Length);
            return Convert.ToBase64String(SHA256.HashData(preimage));
        }

        private static FactoryContract DeployFactory(TestEngine engine, out UInt160 adminAccount)
        {
            // The deployer (current signer) becomes admin via _deploy.
            adminAccount = engine.ValidatorsAddress;
            engine.SetTransactionSigners(adminAccount);
            var (nef, manifest) = Load("MiniAppFactory");
            return engine.Deploy<FactoryContract>(nef, manifest);
        }

        // A11 HIGH: two different users each deploy their OWN unique NEF from the
        // same shared artifact-backed template. The deterministic deploy hash is a
        // function of the NEF, so distinct NEFs must yield distinct, non-colliding
        // hashes and BOTH deployments must succeed (the original code deployed one
        // fixed stored NEF, so only the first caller could ever succeed).
        [Fact]
        public void Factory_ArtifactDeploysAreUniquePerUser_NoHashCollision()
        {
            var engine = new TestEngine(true);
            var factory = DeployFactory(engine, out UInt160 admin);

            engine.SetTransactionSigners(admin);
            factory.registerTemplate("tpl-token", "NEP-17", "1.0.0", "", "", "");
            // Flip HasArtifact = true (the artifact bytes themselves are unused by
            // the per-user deploy path, but the template must be artifact-backed).
            var (seedNef, seedManifest) = RawArtifact("MiniAppTarot");
            factory.registerTemplateArtifact("tpl-token", seedNef, seedManifest);

            // User A deploys their own NEF; User B deploys a DIFFERENT NEF.
            var (nefA, manA) = RawArtifact("MiniAppTarot");
            var (nefB, manB) = RawArtifact("MiniAppCoinFlip");
            string paramsA = "{\"name\":\"AAA\"}";
            string paramsB = "{\"name\":\"BBB\"}";
            string digestA = ExpectedDigest(nefA, manA, paramsA);
            string digestB = ExpectedDigest(nefB, manB, paramsB);

            engine.SetTransactionSigners(admin); // admin acts as user A here
            UInt160? hashA = factory.deployArtifactFromTemplate("tpl-token", "pkg-A", digestA, paramsA, nefA, manA);
            Assert.NotNull(hashA);
            Assert.NotEqual(UInt160.Zero, hashA);

            UInt160? hashB = factory.deployArtifactFromTemplate("tpl-token", "pkg-B", digestB, paramsB, nefB, manB);
            Assert.NotNull(hashB);
            Assert.NotEqual(UInt160.Zero, hashB);

            // The crux of the fix: the two deployments do NOT collide.
            Assert.NotEqual(hashA, hashB);
            Assert.Equal(new BigInteger(2), factory.deploymentCount());
        }

        // A11-Low: the recorded digest must bind the actual artifact + init params.
        // A wrong digest is rejected BEFORE any contract is deployed.
        [Fact]
        public void Factory_ArtifactDeployRejectsDigestMismatch()
        {
            var engine = new TestEngine(true);
            var factory = DeployFactory(engine, out UInt160 admin);

            engine.SetTransactionSigners(admin);
            factory.registerTemplate("tpl-token", "NEP-17", "1.0.0", "", "", "");
            var (nef, manifest) = RawArtifact("MiniAppTarot");
            factory.registerTemplateArtifact("tpl-token", nef, manifest);

            string wrongDigest = "not-the-real-digest";
            var ex = Assert.ThrowsAny<Exception>(() =>
                factory.deployArtifactFromTemplate("tpl-token", "pkg-X", wrongDigest, "{}", nef, manifest));
            Assert.Equal("ABORTMSG is executed. Reason: digest mismatch", ex.Message);
            // Nothing was recorded.
            Assert.Equal(BigInteger.Zero, factory.deploymentCount());
        }

        // Tampering with init params after computing the digest also fails the bind.
        [Fact]
        public void Factory_ArtifactDeployDetectsInitParamTampering()
        {
            var engine = new TestEngine(true);
            var factory = DeployFactory(engine, out UInt160 admin);

            engine.SetTransactionSigners(admin);
            factory.registerTemplate("tpl-token", "NEP-17", "1.0.0", "", "", "");
            var (nef, manifest) = RawArtifact("MiniAppTarot");
            factory.registerTemplateArtifact("tpl-token", nef, manifest);

            string committedParams = "{\"supply\":\"100\"}";
            string digest = ExpectedDigest(nef, manifest, committedParams);
            // Deploy with the committed digest but DIFFERENT init params -> mismatch.
            var ex = Assert.ThrowsAny<Exception>(() =>
                factory.deployArtifactFromTemplate("tpl-token", "pkg-T", digest, "{\"supply\":\"999\"}", nef, manifest));
            Assert.Equal("ABORTMSG is executed. Reason: digest mismatch", ex.Message);
        }

        // The legacy fixed-NEF path must no longer be reachable for artifact
        // templates (it was the colliding/bricking path); callers are pushed to the
        // unique per-user entrypoint instead.
        [Fact]
        public void Factory_LegacyDeployRejectsArtifactTemplates()
        {
            var engine = new TestEngine(true);
            var factory = DeployFactory(engine, out UInt160 admin);

            engine.SetTransactionSigners(admin);
            factory.registerTemplate("tpl-token", "NEP-17", "1.0.0", "", "", "");
            var (nef, manifest) = RawArtifact("MiniAppTarot");
            factory.registerTemplateArtifact("tpl-token", nef, manifest);

            var ex = Assert.ThrowsAny<Exception>(() =>
                factory.deployFromTemplate("tpl-token", "pkg-legacy", "digest", "{}"));
            Assert.Equal("ABORTMSG is executed. Reason: use DeployArtifactFromTemplate for artifact templates", ex.Message);
        }

        // Record-only (metadata) templates still work through the legacy path and
        // the same package cannot be deployed twice.
        [Fact]
        public void Factory_RecordOnlyDeployStillWorksAndIsIdempotentPerPackage()
        {
            var engine = new TestEngine(true);
            var factory = DeployFactory(engine, out UInt160 admin);

            engine.SetTransactionSigners(admin);
            factory.registerTemplate("tpl-meta", "NEP-17", "1.0.0", "nh", "mh", "ch");
            Assert.True(factory.templateExists("tpl-meta"));

            UInt160? recorded = factory.deployFromTemplate("tpl-meta", "pkg-1", "digest-1", "{}");
            Assert.Equal(UInt160.Zero, recorded);
            Assert.Equal(new BigInteger(1), factory.deploymentCount());

            // Re-using a packageId is rejected.
            var ex = Assert.ThrowsAny<Exception>(() =>
                factory.deployFromTemplate("tpl-meta", "pkg-1", "digest-1", "{}"));
            Assert.Equal("ABORTMSG is executed. Reason: package already deployed", ex.Message);
        }
    }
}
