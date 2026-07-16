using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Neo;
using Neo.SmartContract;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // =======================================================================
    //  platform-contract-library-v2 section 8: the shared CreateContractHash
    //  test-vector JSON, consumed by BOTH this xunit suite (pinning neo-core
    //  Helper.GetContractHash) and framework/test/aa-account-hash.test.ts
    //  (pinning the advisory TS sibling deriveAppAccountHash) — C# /
    //  TestEngine / TS triple agreement, with the sender component MEASURED
    //  (PlatformRegistryHashSemanticsTests), not assumed.
    //
    //  The fixture lives at contracts/__tests__/fixtures/
    //  create-contract-hash-vectors.json; edits to either consumer must keep
    //  the other green.
    // =======================================================================
    public class CreateContractHashVectorTests
    {
        private sealed record HashVector(
            string Id,
            string Source,
            UInt160 DeployerSender,
            uint NefChecksum,
            string ManifestName,
            UInt160 ExpectedHash);

        private static string FixturePath()
        {
            return Path.Combine(
                ContractSourceAssertions.FindRepoRoot(),
                "contracts", "__tests__", "fixtures", "create-contract-hash-vectors.json");
        }

        private static IReadOnlyList<HashVector> LoadVectors()
        {
            string path = FixturePath();
            Assert.True(File.Exists(path), $"Shared hash-vector fixture missing: {path}");
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
            var vectors = new List<HashVector>();
            foreach (JsonElement entry in doc.RootElement.GetProperty("vectors").EnumerateArray())
            {
                vectors.Add(new HashVector(
                    entry.GetProperty("id").GetString()!,
                    entry.GetProperty("source").GetString()!,
                    UInt160.Parse(entry.GetProperty("deployerSender").GetString()!),
                    entry.GetProperty("nefChecksum").GetUInt32(),
                    entry.GetProperty("manifestName").GetString()!,
                    UInt160.Parse(entry.GetProperty("expectedHash").GetString()!)));
            }
            return vectors;
        }

        // Every shared vector must reproduce byte-exactly through neo-core's
        // own derivation. This is the C# leg of the triple agreement; the
        // vitest leg asserts the same JSON through deriveAppAccountHash.
        [Fact]
        public void EveryVector_MatchesNeoCoreHelperGetContractHash()
        {
            var vectors = LoadVectors();
            Assert.True(vectors.Count >= 4,
                $"Fixture must hold the measured vector plus synthetic coverage; found {vectors.Count}");
            foreach (var vector in vectors)
            {
                UInt160 derived = Helper.GetContractHash(
                    vector.DeployerSender, vector.NefChecksum, vector.ManifestName);
                Assert.True(
                    vector.ExpectedHash == derived,
                    $"Vector '{vector.Id}': Helper.GetContractHash disagrees with the shared fixture. " +
                    $"expected={vector.ExpectedHash} derived={derived} " +
                    $"sender={vector.DeployerSender} checksum={vector.NefChecksum} name={vector.ManifestName}");
            }
        }

        // The measured vector must stay anchored to the committed probe NEF —
        // if DeployerProbeFixture.nef is ever rebuilt, its checksum changes and
        // this test names the re-measurement duty (rerun
        // PlatformRegistryHashSemanticsTests, update the fixture in BOTH
        // consumers' shared JSON).
        [Fact]
        public void MeasuredVector_PinsCommittedDeployerProbeNefChecksum()
        {
            var measured = LoadVectors().Single(v => v.Source == "measured");
            Assert.Equal("measured-deployer-probe-child", measured.Id);
            Assert.Equal("DeployerProbeChild", measured.ManifestName);

            string nefPath = Path.Combine(
                ContractSourceAssertions.FindRepoRoot(),
                "contracts", "build", "DeployerProbeFixture.nef");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            var nef = NefFile.Parse(File.ReadAllBytes(nefPath));
            Assert.True(
                nef.CheckSum == measured.NefChecksum,
                "DeployerProbeFixture.nef checksum diverged from the shared hash-vector fixture " +
                $"(nef={nef.CheckSum} fixture={measured.NefChecksum}). Re-run the " +
                "PlatformRegistryHashSemanticsTests measurement and update " +
                "contracts/__tests__/fixtures/create-contract-hash-vectors.json.");
        }

        // Vector hygiene: ids unique, expected hashes unique (a duplicated
        // expectation would let one derivation defect hide behind another
        // vector), and every sender/name pair is exercised at most once.
        [Fact]
        public void Vectors_AreDistinctAndWellFormed()
        {
            var vectors = LoadVectors();
            Assert.Equal(vectors.Count, vectors.Select(v => v.Id).Distinct().Count());
            Assert.Equal(vectors.Count, vectors.Select(v => v.ExpectedHash).Distinct().Count());
            foreach (var vector in vectors)
            {
                Assert.InRange(vector.ManifestName.Length, 1, 64);
                Assert.NotEqual(UInt160.Zero, vector.DeployerSender);
                Assert.NotEqual(UInt160.Zero, vector.ExpectedHash);
            }
        }
    }
}
