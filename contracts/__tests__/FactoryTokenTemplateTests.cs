using System;
using System.IO;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Neo;
using Neo.Extensions;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;
using VmMap = Neo.VM.Types.Map;
using TextJsonSerializer = System.Text.Json.JsonSerializer;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public abstract class FactoryNep17TemplateContract : SmartContract
    {
        protected FactoryNep17TemplateContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract string? name();
        public abstract string? symbol();
        public abstract BigInteger? decimals();
        public abstract BigInteger? totalSupply();
        public abstract BigInteger? balanceOf(UInt160 account);
        public abstract UInt160? owner();
        public abstract UInt160? treasury();
        public abstract bool? mintable();
        public abstract bool? paused();
        public abstract bool? transfer(UInt160 from, UInt160 to, BigInteger amount, object? data);
        public abstract void mint(UInt160 to, BigInteger amount);
        public abstract void burn(UInt160 from, BigInteger amount);
        public abstract void setPaused(bool paused);
    }

    public abstract class FactoryNep11TemplateContract : SmartContract
    {
        protected FactoryNep11TemplateContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract string? name();
        public abstract string? symbol();
        public abstract BigInteger? decimals();
        public abstract BigInteger? totalSupply();
        public abstract BigInteger? balanceOf(UInt160 account);
        public abstract UInt160? ownerOf(byte[] tokenId);
        public abstract UInt160? owner();
        public abstract BigInteger? maxSupply();
        public abstract BigInteger? royaltyBps();
        public abstract string? baseUri();
        public abstract bool? transferable();
        public abstract bool? paused();
        public abstract VmMap? properties(byte[] tokenId);
        public abstract void mint(UInt160 to, byte[] tokenId);
        public abstract bool? transfer(UInt160 to, byte[] tokenId, object? data);
        public abstract void burn(byte[] tokenId);
        public abstract void setPaused(bool paused);
    }

    public class FactoryTokenTemplateTests
    {
        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private static (NefFile nef, ContractManifest manifest) Load(string name)
        {
            return (
                NefFile.Parse(File.ReadAllBytes(Path.Combine(BuildDir, name + ".nef"))),
                ContractManifest.Parse(File.ReadAllText(
                    Path.Combine(BuildDir, name + ".manifest.json"))));
        }

        private static (byte[] nef, string manifest) Raw(string name)
        {
            return (
                File.ReadAllBytes(Path.Combine(BuildDir, name + ".nef")),
                File.ReadAllText(Path.Combine(BuildDir, name + ".manifest.json")));
        }

        private static string InstanceManifest(string baseManifest, string packageId)
        {
            JsonObject manifest = JsonNode.Parse(baseManifest)!.AsObject();
            manifest["name"] = packageId;
            return manifest.ToJsonString();
        }

        private static string Digest(byte[] nef, string manifest, string initParams)
        {
            byte[] manifestBytes = Encoding.UTF8.GetBytes(manifest);
            byte[] paramsBytes = Encoding.UTF8.GetBytes(initParams);
            byte[] preimage = new byte[nef.Length + manifestBytes.Length + paramsBytes.Length];
            System.Buffer.BlockCopy(nef, 0, preimage, 0, nef.Length);
            System.Buffer.BlockCopy(manifestBytes, 0, preimage, nef.Length, manifestBytes.Length);
            System.Buffer.BlockCopy(paramsBytes, 0, preimage, nef.Length + manifestBytes.Length, paramsBytes.Length);
            return Convert.ToBase64String(SHA256.HashData(preimage));
        }

        private static string HashBase64(UInt160 account) =>
            Convert.ToBase64String(account.ToArray());

        private static (TestEngine engine, FactoryContract factory, UInt160 admin) DeployFactory()
        {
            var engine = new TestEngine(true);
            UInt160 admin = engine.ValidatorsAddress;
            engine.SetTransactionSigners(admin);
            var (nef, manifest) = Load("MiniAppFactory");
            return (engine, engine.Deploy<FactoryContract>(nef, manifest), admin);
        }

        private static UInt160 DeployTemplate(
            TestEngine engine,
            FactoryContract factory,
            UInt160 admin,
            string templateId,
            string standard,
            string artifactName,
            string packageId,
            string initParams)
        {
            var (nef, baseManifest) = Raw(artifactName);
            engine.SetTransactionSigners(admin);
            factory.registerTemplate(templateId, standard, "1.0.0", "", "", "");
            factory.registerTemplateArtifact(templateId, nef, baseManifest);
            string manifest = InstanceManifest(baseManifest, packageId);
            string digest = Digest(nef, manifest, initParams);
            UInt160? deployed = factory.deployArtifactFromTemplate(
                templateId, packageId, digest, initParams, nef, manifest);
            Assert.NotNull(deployed);
            Assert.NotEqual(UInt160.Zero, deployed);
            return deployed!;
        }

        [Fact]
        public void Nep17Template_DeploysThroughFactoryAndEnforcesCoreLifecycle()
        {
            var (engine, factory, admin) = DeployFactory();
            UInt160 recipient = UInt160.Parse("0x1111111111111111111111111111111111111111");
            string initParams = TextJsonSerializer.Serialize(new
            {
                name = "Neo Credits",
                symbol = "NEOC",
                decimals = 8,
                initialSupplyUnits = "100000000000000",
                ownerHashBase64 = HashBase64(admin),
                treasuryHashBase64 = HashBase64(admin),
                mintable = true,
            });

            UInt160 hash = DeployTemplate(
                engine,
                factory,
                admin,
                "tpl.nep17.asset.v1",
                "NEP-17",
                "FactoryNep17Token",
                "pkg-nep17-a",
                initParams);
            var token = engine.FromHash<FactoryNep17TemplateContract>(hash, false);

            Assert.Equal("Neo Credits", token.name());
            Assert.Equal("NEOC", token.symbol());
            Assert.Equal(new BigInteger(8), token.decimals());
            Assert.Equal(new BigInteger(100000000000000), token.totalSupply());
            Assert.Equal(token.totalSupply(), token.balanceOf(admin));
            Assert.Equal(admin, token.owner());
            Assert.Equal(admin, token.treasury());
            Assert.True(token.mintable());

            engine.SetTransactionSigners(admin);
            Assert.True(token.transfer(admin, recipient, 25, null));
            Assert.Equal(new BigInteger(25), token.balanceOf(recipient));
            token.mint(recipient, 75);
            Assert.Equal(new BigInteger(100), token.balanceOf(recipient));
            token.burn(admin, 50);
            Assert.Equal(new BigInteger(100000000000025), token.totalSupply());

            token.setPaused(true);
            Assert.True(token.paused());
            var paused = Assert.ThrowsAny<Exception>(() =>
                token.transfer(admin, recipient, 1, null));
            Assert.Equal("ABORTMSG is executed. Reason: paused", paused.Message);
        }

        [Fact]
        public void Nep11Template_DeploysUniqueTransferableAndSoulboundCollections()
        {
            var (engine, factory, admin) = DeployFactory();
            UInt160 collector = UInt160.Parse("0x2222222222222222222222222222222222222222");
            string commonName = "Neo Builder Pass";

            string transferableInit = TextJsonSerializer.Serialize(new
            {
                collectionName = commonName,
                symbol = "NBP",
                maxSupply = 5000,
                royaltyBps = 250,
                baseUri = "https://assets.neomini.app/nft/neo-builder-pass/",
                ownerHashBase64 = HashBase64(admin),
                transferPolicy = "transferable",
            });
            UInt160 transferableHash = DeployTemplate(
                engine,
                factory,
                admin,
                "tpl.nep11.collection.v1",
                "NEP-11",
                "FactoryNep11Collection",
                "pkg-nep11-transferable",
                transferableInit);
            var collection = engine.FromHash<FactoryNep11TemplateContract>(
                transferableHash, false);
            byte[] tokenId = Encoding.UTF8.GetBytes("edition-1");

            Assert.Equal(commonName, collection.name());
            Assert.Equal("NBP", collection.symbol());
            Assert.Equal(BigInteger.Zero, collection.decimals());
            Assert.Equal(new BigInteger(5000), collection.maxSupply());
            Assert.Equal(new BigInteger(250), collection.royaltyBps());
            Assert.True(collection.transferable());

            engine.SetTransactionSigners(admin);
            collection.mint(admin, tokenId);
            Assert.Equal(BigInteger.One, collection.totalSupply());
            Assert.Equal(admin, collection.ownerOf(tokenId));
            Assert.True(collection.transfer(collector, tokenId, null));
            Assert.Equal(collector, collection.ownerOf(tokenId));
            Assert.Equal(BigInteger.One, collection.balanceOf(collector));
            Assert.NotNull(collection.properties(tokenId));

            string soulboundInit = TextJsonSerializer.Serialize(new
            {
                collectionName = "Neo Soulbound Pass",
                symbol = "NSP",
                maxSupply = 100,
                royaltyBps = 0,
                baseUri = "https://assets.neomini.app/nft/neo-soulbound-pass/",
                ownerHashBase64 = HashBase64(admin),
                transferPolicy = "soulbound",
            });
            var (nef, baseManifest) = Raw("FactoryNep11Collection");
            string secondPackage = "pkg-nep11-soulbound";
            string secondManifest = InstanceManifest(baseManifest, secondPackage);
            string secondDigest = Digest(nef, secondManifest, soulboundInit);
            UInt160? soulboundHash = factory.deployArtifactFromTemplate(
                "tpl.nep11.collection.v1",
                secondPackage,
                secondDigest,
                soulboundInit,
                nef,
                secondManifest);
            Assert.NotNull(soulboundHash);
            Assert.NotEqual(transferableHash, soulboundHash);

            var soulbound = engine.FromHash<FactoryNep11TemplateContract>(
                soulboundHash!, false);
            byte[] soulToken = Encoding.UTF8.GetBytes("soul-1");
            soulbound.mint(admin, soulToken);
            var blocked = Assert.ThrowsAny<Exception>(() =>
                soulbound.transfer(collector, soulToken, null));
            Assert.Equal("ABORTMSG is executed. Reason: soulbound", blocked.Message);
            Assert.Equal(admin, soulbound.ownerOf(soulToken));
        }
    }
}
