using System;
using System.IO;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    // ABI binding for the DeployerProbeFixture measurement probe.
    public abstract class DeployerProbeContract : SmartContract
    {
        protected DeployerProbeContract(SmartContractInitialize initialize) : base(initialize) { }
        public abstract UInt160? deployChild(byte[] nef, string manifest);
    }

    // =======================================================================
    //  platform-contract-library-v2 section 4.1 rule 1: the measurement test
    //  that pins the sender component of CreateContractHash for a
    //  CONTRACT-initiated ContractManagement.Deploy — written before any
    //  prediction helper.
    //
    //  MEASURED OUTCOME (TestEngine, Neo.SmartContract.Testing 3.9.1;
    //  probe = committed contracts/build/DeployerProbeFixture.nef, child =
    //  the same NEF under manifest name "DeployerProbeChild"):
    //
    //    txSender (ValidatorsAddress) 0x9f8f056a53e39585c7bb52886418c7bed83d126b
    //    probe contract hash          0x53c7aadbd57d1e4e07026b75d2e8a2ac4852fb9c
    //    observed child hash          0xd1e0d8ac8fa2faa36809e823b86c858bcb0c63b8
    //    derived from txSender        0xd1e0d8ac8fa2faa36809e823b86c858bcb0c63b8  <- MATCH
    //    derived from calling contract 0x201876fd7a8405573d90c29d101ed60fd6f54b7a  <- NO MATCH
    //
    //  FACT: Neo N3 folds the TRANSACTION SENDER — not the calling contract's
    //  hash — into CreateContractHash when a contract initiates
    //  ContractManagement.Deploy. This confirms both judges' reading of Neo
    //  core and rejects RADE's on-chain preimage reconstruction premise.
    //
    //  DESIGN CONSEQUENCE (section 4.1 rule 4): a registry contract CANNOT
    //  predict its own mint addresses on-chain from its own hash. Off-chain
    //  precomputability survives only by routing minting through a fixed
    //  transaction-sender lane: the platform pipeline deployer, predicted via
    //  state.CreateContractHash(deployer, nef.Checksum, name) exactly as
    //  deploy_selected_miniapp_contracts.go already does. The registry row
    //  stays the address-of-record (rule 2); no address is published before
    //  materialization (rule 3).
    // =======================================================================
    public class PlatformRegistryHashSemanticsTests
    {
        private static readonly string BuildDir = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "build"));

        private const string ChildName = "DeployerProbeChild";

        private sealed record Measurement(
            UInt160 Observed,
            UInt160 FromTxSender,
            UInt160 FromCallingContract,
            UInt160 TxSender,
            UInt160 ProbeHash);

        private static Measurement Measure()
        {
            var engine = new TestEngine(true);
            UInt160 txSender = engine.ValidatorsAddress;
            engine.SetTransactionSigners(txSender);

            string nefPath = Path.Combine(BuildDir, "DeployerProbeFixture.nef");
            string manifestPath = Path.Combine(BuildDir, "DeployerProbeFixture.manifest.json");
            Assert.True(File.Exists(nefPath), $"NEF missing: {nefPath}");
            byte[] probeNefBytes = File.ReadAllBytes(nefPath);
            var probeNef = NefFile.Parse(probeNefBytes);
            var probeManifest = ContractManifest.Parse(File.ReadAllText(manifestPath));

            var probe = engine.Deploy<DeployerProbeContract>(probeNef, probeManifest);

            // Control: a DIRECT (transaction-initiated) deploy trivially derives its
            // hash from the transaction sender. This anchors the derivation helper.
            Assert.Equal(
                Helper.GetContractHash(txSender, probeNef.CheckSum, probeManifest.Name),
                probe.Hash);

            // Child artifact: the probe's own NEF under a distinct manifest name, so
            // the child hash cannot collide with the already-deployed probe.
            var childManifest = ContractManifest.Parse(File.ReadAllText(manifestPath));
            childManifest.Name = ChildName;
            string childManifestJson = childManifest.ToJson().ToString();

            UInt160? observed = probe.deployChild(probeNefBytes, childManifestJson);
            Assert.NotNull(observed);
            Assert.NotEqual(UInt160.Zero, observed);

            UInt160 fromTxSender = Helper.GetContractHash(txSender, probeNef.CheckSum, ChildName);
            UInt160 fromCallingContract = Helper.GetContractHash(probe.Hash, probeNef.CheckSum, ChildName);

            // The two candidate derivations must be distinguishable or the
            // measurement is meaningless.
            Assert.NotEqual(fromTxSender, fromCallingContract);

            return new Measurement(observed!, fromTxSender, fromCallingContract, txSender, probe.Hash);
        }

        // Passing = the transaction sender IS the CreateContractHash sender for a
        // contract-initiated deploy. If Neo core ever changes this, the failure
        // message carries all values needed to re-record the measurement.
        [Fact]
        public void ContractInitiatedDeploy_ChildHashDerivesFromTransactionSender()
        {
            var m = Measure();
            Assert.True(
                m.Observed == m.FromTxSender,
                "MEASUREMENT CHANGED: contract-initiated ContractManagement.Deploy no longer " +
                "derives the child hash from the transaction sender. " +
                $"observed={m.Observed} fromTxSender={m.FromTxSender} " +
                $"fromCallingContract={m.FromCallingContract} txSender={m.TxSender} probeHash={m.ProbeHash}. " +
                "Re-measure and revisit section 4.1 rule 4 (mint routing through the fixed pipeline deployer).");
        }

        // Passing = the calling contract's hash is NOT the CreateContractHash
        // sender: a registry cannot predict its own mint addresses from its own
        // hash on-chain. Complementary to the test above — together the pair
        // names the measured semantics.
        [Fact]
        public void ContractInitiatedDeploy_ChildHashDoesNotDeriveFromCallingContract()
        {
            var m = Measure();
            Assert.True(
                m.Observed != m.FromCallingContract,
                "MEASUREMENT CHANGED: contract-initiated ContractManagement.Deploy now derives " +
                "the child hash from the CALLING CONTRACT. " +
                $"observed={m.Observed} fromTxSender={m.FromTxSender} " +
                $"fromCallingContract={m.FromCallingContract} txSender={m.TxSender} probeHash={m.ProbeHash}. " +
                "On-chain registry-side prediction would now be possible — revisit section 4.1 rule 4.");
        }

        // Exactly-one-candidate guard: the observed hash must match precisely one
        // of the two derivations, so the pair above can never both pass vacuously.
        [Fact]
        public void ContractInitiatedDeploy_ObservedHashMatchesExactlyOneCandidate()
        {
            var m = Measure();
            bool matchesTxSender = m.Observed == m.FromTxSender;
            bool matchesCallingContract = m.Observed == m.FromCallingContract;
            Assert.True(
                matchesTxSender ^ matchesCallingContract,
                $"observed={m.Observed} must equal exactly one candidate; " +
                $"fromTxSender={m.FromTxSender} fromCallingContract={m.FromCallingContract}");
        }
    }
}
