using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppFactory : SmartContract
    {
        // ===================================================================
        //  A11 fix: per-user unique, digest-verified artifact deployment
        //
        //  The original artifact path deployed a SINGLE fixed NEF stored on the
        //  template (RegisterTemplateArtifact). Neo derives a contract's hash
        //  deterministically as Hash160(deployer || nef.checksum || name); with a
        //  fixed NEF + name the hash is identical for every caller, so only the
        //  FIRST deploy from a template could succeed and every subsequent one
        //  reverted with "contract already exists" — bricking the shared-template
        //  "everyone deploys their own token" model.
        //
        //  Fix: every instance uses the governed template NEF and an otherwise
        //  identical manifest whose name is the unique packageId. Neo includes
        //  the manifest name in the contract hash, so this preserves one reviewed
        //  executable while yielding a distinct address for every package. Before
        //  deploying we VERIFY both template provenance and that the recorded
        //  `digest` binds the supplied artifact and init params:
        //      digest == Base64Encode(Sha256(nef || manifest || initParamsJson))
        //  A mismatch reverts, so a deployment cannot be recorded against an
        //  artifact that differs from what the signed plan committed to.
        // ===================================================================
        public static UInt160 DeployArtifactFromTemplate(
            string templateId, string packageId, string digest, string initParamsJson,
            ByteString nef, string manifest)
        {
            UInt160 creator = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized creator");
            ValidateDeploymentInputs(templateId, packageId, digest, initParamsJson);
            ExecutionEngine.Assert(GetTemplateRaw(templateId) != null, "template not found");
            ExecutionEngine.Assert(nef != null && nef.Length > 0, "nef required");
            ExecutionEngine.Assert(manifest != null && manifest.Length > 0 && manifest.Length <= MAX_MANIFEST_LENGTH, "invalid manifest");
            ValidateGovernedArtifact(templateId, packageId, nef, manifest);

            StorageMap deployments = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT);
            ExecutionEngine.Assert(deployments.Get(packageId) == null, "package already deployed");

            // A11-Low: verify the recorded digest binds the actual artifact + init params.
            ExecutionEngine.Assert(digest == ComputeArtifactDigest(nef, manifest, initParamsJson), "digest mismatch");

            // The governed NEF stays identical; packageId is the manifest name, so
            // Neo's deterministic contract hash remains unique per package.
            Contract deployed = ContractManagement.Deploy(nef, manifest, initParamsJson);
            UInt160 deployedHash = deployed.Hash;

            DeploymentRecord record = new DeploymentRecord
            {
                TemplateId = templateId,
                PackageId = packageId,
                Digest = digest,
                InitParams = initParamsJson,
                Creator = creator,
                DeployedHash = deployedHash,
                CreatedAt = Runtime.Time,
            };
            deployments.Put(packageId, StdLib.Serialize(record));
            BigInteger index = DeploymentCount();
            new StorageMap(Storage.CurrentContext, PREFIX_DEPLOY_INDEX).Put(index.ToByteArray(), packageId);
            Storage.Put(Storage.CurrentContext, PREFIX_DEPLOY_COUNT, index + 1);

            OnTokenDeployed(templateId, packageId, deployedHash, creator);
            return deployedHash;
        }

        // Deterministic, off-chain-reproducible binding of digest -> artifact+params.
        private static string ComputeArtifactDigest(ByteString nef, string manifest, string initParamsJson)
        {
            ByteString preimage = Helper.Concat(
                Helper.Concat(nef, (ByteString)manifest),
                (ByteString)initParamsJson);
            return StdLib.Base64Encode(CryptoLib.Sha256(preimage));
        }

        private static void ValidateGovernedArtifact(
            string templateId, string packageId, ByteString nef, string manifest)
        {
            ByteString governedNef = new StorageMap(
                Storage.CurrentContext, PREFIX_TEMPLATE_NEF).Get(templateId);
            ByteString governedManifestRaw = new StorageMap(
                Storage.CurrentContext, PREFIX_TEMPLATE_MANIFEST).Get(templateId);
            ExecutionEngine.Assert(
                governedNef != null && governedManifestRaw != null,
                "template artifact required");
            ExecutionEngine.Assert(
                StdLib.MemoryCompare(CryptoLib.Sha256(nef), CryptoLib.Sha256(governedNef)) == 0,
                "nef does not match template");

            Map<string, object> governed =
                (Map<string, object>)StdLib.JsonDeserialize((string)governedManifestRaw);
            Map<string, object> candidate =
                (Map<string, object>)StdLib.JsonDeserialize(manifest);
            ExecutionEngine.Assert(governed != null && candidate != null, "invalid manifest json");

            object governedNameValue = governed["name"];
            object candidateNameValue = candidate["name"];
            ExecutionEngine.Assert(
                governedNameValue != null && candidateNameValue != null,
                "manifest name required");
            string governedName = (string)governedNameValue;
            string candidateName = (string)candidateNameValue;
            ExecutionEngine.Assert(candidateName == packageId, "manifest name must equal package id");

            candidate["name"] = governedName;
            ExecutionEngine.Assert(
                StdLib.MemoryCompare(
                    CryptoLib.Sha256(StdLib.JsonSerialize(candidate)),
                    CryptoLib.Sha256(StdLib.JsonSerialize(governed))) == 0,
                "manifest does not match template");
        }
    }
}
