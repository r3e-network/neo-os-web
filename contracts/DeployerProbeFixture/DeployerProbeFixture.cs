using System.ComponentModel;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Measurement probe for the platform-contract-library-v2 section 4.1
    /// hash-determinism question: when a CONTRACT (rather than a transaction
    /// signer directly) initiates ContractManagement.Deploy, which sender does
    /// Neo core fold into CreateContractHash — the transaction sender, or the
    /// calling contract's own script hash? The probe forwards a caller-supplied
    /// artifact to ContractManagement.Deploy from its own execution context and
    /// returns the hash the chain actually assigned, so the paired TestEngine
    /// test (PlatformRegistryHashSemanticsTests) can compare that observed hash
    /// against both candidate derivations and pin the real semantics before any
    /// prediction helper is written. Never deployed to any network.
    /// </summary>
    [DisplayName("DeployerProbeFixture")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Contract-initiated deploy probe for the section 4.1 hash-semantics measurement test; never deployed.")]
    // ContractManagement.deploy for the contract-initiated deploy under measurement.
    [ContractPermission("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd", "deploy")]
    public class DeployerProbeFixture : SmartContract
    {
        /// <summary>
        /// Deploy the supplied artifact from THIS contract's execution context and
        /// return the hash the chain assigned to the freshly deployed contract.
        /// </summary>
        public static UInt160 DeployChild(ByteString nef, string manifest)
        {
            Contract deployed = ContractManagement.Deploy(nef, manifest);
            return deployed.Hash;
        }
    }
}
