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
    /// <summary>
    /// Testing wrapper for the compiled GameOracleMockFixture kernel stand-in used by
    /// every skill-game contract test suite. submitMiniAppRequestFromIntegration hands
    /// back an incrementing requestId; deliver / deliverLegacy invoke the game's
    /// onMiniAppResult / onOracleResult callbacks FROM this contract so the game's
    /// caller==Oracle() gate is a real cross-contract check.
    /// </summary>
    public abstract class GameOracleMockFixtureContract : SmartContract
    {
        protected GameOracleMockFixtureContract(SmartContractInitialize initialize) : base(initialize) { }

        public abstract BigInteger? submitMiniAppRequestFromIntegration(
            UInt160 requester, string appId, string moduleId, string operation, byte[] payload);

        public abstract void deliver(UInt160 consumer, BigInteger requestId, string appId,
            string moduleId, string operation, UInt160 requester, bool success, byte[] result, string error);

        public abstract void deliverLegacy(UInt160 consumer, BigInteger requestId,
            string operation, bool success, byte[] result, string error);

        // Convenience PascalCase shims so the test suites read naturally.
        public void Deliver(UInt160 consumer, BigInteger requestId, string appId,
            string moduleId, string operation, UInt160 requester, bool success, byte[] result, string error) =>
            deliver(consumer, requestId, appId, moduleId, operation, requester, success, result, error);

        public void DeliverLegacy(UInt160 consumer, BigInteger requestId,
            string operation, bool success, byte[] result, string error) =>
            deliverLegacy(consumer, requestId, operation, success, result, error);
    }

    internal static class GameOracleMockFixture
    {
        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        public static GameOracleMockFixtureContract Deploy(TestEngine engine, UInt160 deployer)
        {
            string nefPath = Path.Combine(BuildDir, "GameOracleMockFixture.nef");
            string manifestPath = Path.Combine(BuildDir, "GameOracleMockFixture.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            var nef = NefFile.Parse(File.ReadAllBytes(nefPath));
            var manifest = ContractManifest.Parse(File.ReadAllText(manifestPath));
            engine.SetTransactionSigners(deployer);
            return engine.Deploy<GameOracleMockFixtureContract>(nef, manifest);
        }
    }
}
