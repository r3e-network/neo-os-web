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
        //  Fix: the caller supplies their OWN NEF + manifest (their token name /
        //  symbol / supply are baked in, yielding a distinct checksum + name and
        //  therefore a distinct, non-colliding deployment hash). Before deploying
        //  we VERIFY the recorded `digest` actually binds the supplied artifact and
        //  init params (closing the A11-Low "digest never verified" gap):
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

            StorageMap deployments = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT);
            ExecutionEngine.Assert(deployments.Get(packageId) == null, "package already deployed");

            // A11-Low: verify the recorded digest binds the actual artifact + init params.
            ExecutionEngine.Assert(digest == ComputeArtifactDigest(nef, manifest, initParamsJson), "digest mismatch");

            // Each user's NEF is distinct, so the deterministic deploy hash does not
            // collide across users deploying from the same shared template.
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
    }
}
