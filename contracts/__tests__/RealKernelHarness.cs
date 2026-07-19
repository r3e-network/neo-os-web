using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Numerics;
using System.Text;
using Neo;
using Neo.Cryptography.ECC;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.Wallets;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ===================================================================
    //  REAL MiniApp-OS kernel harness for the joint PlatformGame <->
    //  MorpheusOracle integration tests (design section 8 layer 1, the
    //  GameOracleMockFixture counterpart that deploys the REAL kernel).
    //
    //  Fixture provenance (contracts/__tests__/fixtures/real-kernel/):
    //    copied 2026-07-17 from the morpheus repo build of CURRENT source
    //    (neo-morpheus-oracle/contracts/__tests__/Generated/, 70-method ABI
    //    with the rich 8-arg onMiniAppResult dispatch — NOT the retired
    //    testnet uc1 build 0x4b88... which only calls legacy onOracleResult):
    //      MorpheusOracle.nef           sha256 b38914cd9f1d734771c1fd0171313117943643f3092c62cd4dbee928ab077694
    //      MorpheusOracle.manifest.json sha256 0ad9d552b4248d448471f65b596df7d531f42df6075cd8eb3c82161f000b2f7f
    //  Lane M1 may regenerate the artifacts; re-copy + refresh the shasums.
    //
    //  The binding below is a deliberate SUBSET of the 70-method ABI: only
    //  the surface this integration drives. Method names match the manifest
    //  ABI names exactly (the platform test-project idiom).
    // ===================================================================
    public abstract class RealKernelContract : SmartContract
    {
        protected RealKernelContract(SmartContractInitialize initialize) : base(initialize) { }

        // admin / verifier / updater
        public abstract UInt160? admin();
        public abstract void setUpdater(UInt160 updater);
        public abstract void setRuntimeVerificationPublicKey(ECPoint publicKey);
        // module + app registration
        public abstract void registerSystemModule(string moduleId, string endpoint, string schemaHash);
        public abstract void registerMiniApp(string appId, UInt160 appAdmin, UInt160 feePayer, UInt160 callbackContract, string metadataUri, string metadataHash);
        public abstract void grantModuleToMiniApp(string appId, string moduleId);
        public abstract bool? isModuleGrantedToMiniApp(string appId, string moduleId);
        // reads
        public abstract BigInteger? feeCreditOf(UInt160 payer);
        public abstract BigInteger? getMiniAppRequestCount(string appId);
        public abstract BigInteger? getMiniAppFulfilledCount(string appId);
        public abstract IList<object>? getRequest(BigInteger requestId);
        // request lifecycle
        public abstract BigInteger? submitMiniAppRequestFromIntegration(UInt160 requester, string appId, string moduleId, string operation, byte[] payload);
        public abstract void fulfillRequest(BigInteger requestId, bool success, byte[] result, string error, byte[] verificationSignature);

        public delegate void delMiniAppRequestQueued(BigInteger? requestId, string? appId, string? moduleId, string? operation, UInt160? requester, UInt160? sponsor, byte[]? payload);
        [DisplayName("MiniAppRequestQueued")]
        public event delMiniAppRequestQueued? OnMiniAppRequestQueued;
    }

    // Loader + deploy for the real-kernel fixture pair (the
    // GameOracleMockFixture.Deploy idiom, pointed at fixtures/real-kernel).
    internal static class RealKernelFixture
    {
        private static readonly string FixtureDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..",
                "__tests__", "fixtures", "real-kernel"));

        public static (NefFile nef, ContractManifest manifest) Load()
        {
            string nefPath = Path.Combine(FixtureDir, "MorpheusOracle.nef");
            string manifestPath = Path.Combine(FixtureDir, "MorpheusOracle.manifest.json");
            Assert.True(File.Exists(nefPath), $"real-kernel NEF missing: {nefPath}");
            Assert.True(File.Exists(manifestPath), $"real-kernel manifest missing: {manifestPath}");
            return (NefFile.Parse(File.ReadAllBytes(nefPath)),
                    ContractManifest.Parse(File.ReadAllText(manifestPath)));
        }

        public static RealKernelContract Deploy(TestEngine engine, UInt160 deployer)
        {
            var (nef, manifest) = Load();
            engine.SetTransactionSigners(deployer);
            return engine.Deploy<RealKernelContract>(nef, manifest);
        }
    }

    // Test-side twin of the kernel's ComputeFulfillmentDigest
    // (morpheus repo contracts/MorpheusOracle/MorpheusOracle.Fulfillment.cs:45-75,
    // mirrored by MorpheusOracleCallbackDispatchTests). The payload is:
    //   "miniapp-os-fulfillment-v1" (25 ASCII bytes)
    //   requestId          u256 BE (32)
    //   sha256(appId)      (32)
    //   sha256(moduleId)   (32)
    //   sha256(operation)  (32)
    //   success            (1: 0x01/0x00)
    //   sha256(result)     (32)
    //   sha256(error)      (32)
    //   executingScriptHash (20, the kernel's own hash — replay-binds the
    //                        signature to this deployment)
    //   network magic      (4 LE — replay-binds to this network)
    // and the digest is sha256 of the concatenation. The kernel verifies it
    // with CryptoLib.VerifyWithECDsa(.., secp256r1SHA256) in FulfillRequest.
    internal static class FulfillmentDigest
    {
        public const string Domain = "miniapp-os-fulfillment-v1";

        public static byte[] Compute(
            BigInteger requestId, string appId, string moduleId, string operation,
            bool success, byte[] result, string error, byte[] scriptHashLe, uint network)
        {
            var payload = new List<byte>();
            payload.AddRange(Encoding.ASCII.GetBytes(Domain));
            payload.AddRange(ToUInt256BE(requestId));
            payload.AddRange(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(appId)));
            payload.AddRange(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(moduleId)));
            payload.AddRange(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(operation)));
            payload.Add(success ? (byte)0x01 : (byte)0x00);
            payload.AddRange(System.Security.Cryptography.SHA256.HashData(result ?? Array.Empty<byte>()));
            payload.AddRange(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(error ?? "")));
            payload.AddRange(scriptHashLe);
            payload.Add((byte)(network & 0xFF));
            payload.Add((byte)((network >> 8) & 0xFF));
            payload.Add((byte)((network >> 16) & 0xFF));
            payload.Add((byte)((network >> 24) & 0xFF));
            return System.Security.Cryptography.SHA256.HashData(payload.ToArray());
        }

        // Crypto.Sign occasionally emits a signature the managed verifier
        // rejects; re-sign until it round-trips locally so the suite stays
        // deterministic (the morpheus lane's SignVerified idiom).
        public static byte[] SignVerified(byte[] digest, KeyPair key)
        {
            for (int attempt = 0; attempt < 16; attempt++)
            {
                byte[] signature = Neo.Cryptography.Crypto.Sign(
                    digest, key.PrivateKey, ECCurve.Secp256r1);
                if (Neo.Cryptography.Crypto.VerifySignature(digest, signature, key.PublicKey))
                    return signature;
            }
            throw new InvalidOperationException("could not produce a locally verifiable signature");
        }

        // Mirrors the contract's ToUInt256Bytes: big-endian 32-byte encoding.
        private static byte[] ToUInt256BE(BigInteger value)
        {
            byte[] raw = value.ToByteArray(); // little-endian, two's complement
            byte[] outp = new byte[32];
            for (int i = 0; i < raw.Length && i < 32; i++) outp[31 - i] = raw[i];
            return outp;
        }
    }
}
