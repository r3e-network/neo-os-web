using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Event delegates
    // ===================================================================
    public delegate void TemplateRegisteredHandler(string templateId, string standard, string version);
    public delegate void TemplateArtifactSetHandler(string templateId, BigInteger nefLength);
    public delegate void TokenDeployedHandler(string templateId, string packageId, UInt160 deployedHash, UInt160 creator);
    public delegate void DeploymentRecordedHandler(string templateId, string packageId, string digest, UInt160 creator);
    public delegate void MiniAppCreatedHandler(string templateId, string packageId, string digest, UInt160 creator);
    public delegate void AdminChangedHandler(UInt160 oldAdmin, UInt160 newAdmin);

    // ===================================================================
    //  MiniAppFactory
    //
    //  Template registry + factory backing the three "factory" miniapps:
    //    - Asset Factory   (NEP-17 tokens)   -> deployFromTemplate
    //    - NFT Factory      (NEP-11 collections) -> deployFromTemplate
    //    - MiniApp Factory  (miniapp instances)  -> createMiniAppFromTemplate
    //
    //  The factory miniapps build a deterministic deployment "plan" off-chain
    //  (apps/shared/factory/factoryPlan.ts) whose deploymentCall targets this
    //  contract with (templateId, packageId, digest, initParamsJson). The user
    //  signs the plan and the call is executed on-chain (e.g. via OneGate).
    //
    //  Admins preload templates. A template may be:
    //    - metadata-only (nef/manifest/config hashes recorded) -> deploy is
    //      RECORDED (registry coordination), or
    //    - artifact-backed (full NEF + manifest stored) -> deployFromTemplate
    //      performs a REAL ContractManagement.Deploy and returns the new hash.
    //
    //  STORAGE LAYOUT
    //    0x01            admin
    //    0x10/0x11/0x12  template record / nef / manifest (by templateId)
    //    0x13/0x14       template index / count
    //    0x20/0x21/0x22  deployment record / index / count (by packageId)
    //    0x30/0x31/0x32  miniapp record / index / count (by packageId)
    // ===================================================================
    [DisplayName("MiniAppFactory")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Template registry + factory for NEP-17, NEP-11, and miniapp instances created from preloaded on-chain templates.")]
    // ContractManagement.deploy for artifact-backed template deployment.
    [ContractPermission("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd", "deploy")]
    public class MiniAppFactory : SmartContract
    {
        // ---- storage prefixes ----
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_TEMPLATE = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_TEMPLATE_NEF = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_TEMPLATE_MANIFEST = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_TEMPLATE_INDEX = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_TEMPLATE_COUNT = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_DEPLOYMENT = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_DEPLOY_INDEX = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_DEPLOY_COUNT = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_MINIAPP = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_MINIAPP_INDEX = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_MINIAPP_COUNT = new byte[] { 0x32 };

        // ---- limits ----
        private const int MAX_ID_LENGTH = 128;
        private const int MAX_HASH_LENGTH = 70;
        private const int MAX_JSON_LENGTH = 8192;
        private const int MAX_MANIFEST_LENGTH = 65536;

        // ---- events ----
        [DisplayName("TemplateRegistered")] public static event TemplateRegisteredHandler OnTemplateRegistered;
        [DisplayName("TemplateArtifactSet")] public static event TemplateArtifactSetHandler OnTemplateArtifactSet;
        [DisplayName("TokenDeployed")] public static event TokenDeployedHandler OnTokenDeployed;
        [DisplayName("DeploymentRecorded")] public static event DeploymentRecordedHandler OnDeploymentRecorded;
        [DisplayName("MiniAppCreated")] public static event MiniAppCreatedHandler OnMiniAppCreated;
        [DisplayName("AdminChanged")] public static event AdminChangedHandler OnAdminChanged;

        // ===================================================================
        //  Records
        // ===================================================================
        public struct TemplateRecord
        {
            public string TemplateId;
            public string Standard;          // "NEP-17" | "NEP-11" | "miniapp"
            public string Version;
            public string NefHash;
            public string ManifestHash;
            public string ConfigSchemaHash;
            public bool HasArtifact;
            public BigInteger CreatedAt;
        }

        public struct DeploymentRecord
        {
            public string TemplateId;
            public string PackageId;
            public string Digest;
            public string InitParams;
            public UInt160 Creator;
            public UInt160 DeployedHash;     // UInt160.Zero when record-only
            public BigInteger CreatedAt;
        }

        public struct MiniAppRecord
        {
            public string TemplateId;
            public string PackageId;
            public string Digest;
            public string InitParams;
            public UInt160 Creator;
            public BigInteger CreatedAt;
        }

        // ===================================================================
        //  Lifecycle
        // ===================================================================
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)Runtime.Transaction.Sender);
        }

        [Safe]
        public static UInt160 Admin()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        public static void SetAdmin(UInt160 newAdmin)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(newAdmin != null && newAdmin.IsValid && newAdmin != UInt160.Zero, "invalid admin");
            UInt160 old = Admin();
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, (ByteString)newAdmin);
            OnAdminChanged(old, newAdmin);
        }

        public static void Update(ByteString nefFile, string manifest)
        {
            ValidateAdmin();
            ContractManagement.Update(nefFile, manifest, null);
        }

        private static void ValidateAdmin()
        {
            UInt160 admin = Admin();
            ExecutionEngine.Assert(admin != null && admin.IsValid, "admin not set");
            ExecutionEngine.Assert(Runtime.CheckWitness(admin), "unauthorized");
        }

        // ===================================================================
        //  Template registry (admin)
        // ===================================================================
        public static void RegisterTemplate(
            string templateId, string standard, string version,
            string nefHash, string manifestHash, string configSchemaHash)
        {
            ValidateAdmin();
            ValidateId(templateId, "invalid template id");
            ExecutionEngine.Assert(standard != null && standard.Length > 0 && standard.Length <= 32, "invalid standard");
            ExecutionEngine.Assert(version != null && version.Length > 0 && version.Length <= 32, "invalid version");
            ValidateHashStr(nefHash, "invalid nef hash");
            ValidateHashStr(manifestHash, "invalid manifest hash");
            ValidateHashStr(configSchemaHash, "invalid config schema hash");

            StorageMap templates = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE);
            bool existed = templates.Get(templateId) != null;

            TemplateRecord record = new TemplateRecord
            {
                TemplateId = templateId,
                Standard = standard,
                Version = version,
                NefHash = nefHash,
                ManifestHash = manifestHash,
                ConfigSchemaHash = configSchemaHash,
                HasArtifact = HasArtifact(templateId),
                CreatedAt = Runtime.Time,
            };
            templates.Put(templateId, StdLib.Serialize(record));

            if (!existed)
            {
                BigInteger index = TemplateCount();
                new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_INDEX).Put(index.ToByteArray(), templateId);
                Storage.Put(Storage.CurrentContext, PREFIX_TEMPLATE_COUNT, index + 1);
            }
            OnTemplateRegistered(templateId, standard, version);
        }

        // Store the full NEF + manifest so deployFromTemplate can perform a real
        // ContractManagement.Deploy. Optional: templates without an artifact are
        // record-only (registry coordination).
        public static void RegisterTemplateArtifact(string templateId, ByteString nef, string manifest)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(GetTemplateRaw(templateId) != null, "template not found");
            ExecutionEngine.Assert(nef != null && nef.Length > 0, "nef required");
            ExecutionEngine.Assert(manifest != null && manifest.Length > 0 && manifest.Length <= MAX_MANIFEST_LENGTH, "invalid manifest");

            new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_NEF).Put(templateId, nef);
            new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_MANIFEST).Put(templateId, manifest);

            // mark HasArtifact = true on the record
            TemplateRecord record = GetTemplate(templateId);
            record.HasArtifact = true;
            new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE).Put(templateId, StdLib.Serialize(record));
            OnTemplateArtifactSet(templateId, nef.Length);
        }

        [Safe]
        public static TemplateRecord GetTemplate(string templateId)
        {
            ByteString raw = GetTemplateRaw(templateId);
            ExecutionEngine.Assert(raw != null, "template not found");
            return (TemplateRecord)StdLib.Deserialize(raw);
        }

        [Safe]
        public static bool TemplateExists(string templateId)
        {
            return GetTemplateRaw(templateId) != null;
        }

        [Safe]
        public static BigInteger TemplateCount()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_TEMPLATE_COUNT);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static string GetTemplateIdByIndex(BigInteger index)
        {
            ExecutionEngine.Assert(index >= 0 && index < TemplateCount(), "index out of range");
            ByteString raw = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_INDEX).Get(index.ToByteArray());
            return raw == null ? "" : raw;
        }

        // ===================================================================
        //  Frontend ABI: deployment + miniapp creation
        // ===================================================================

        // Used by Asset Factory (NEP-17) and NFT Factory (NEP-11).
        // Artifact-backed templates are really deployed; otherwise recorded.
        public static UInt160 DeployFromTemplate(string templateId, string packageId, string digest, string initParamsJson)
        {
            UInt160 creator = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized creator");
            ValidateDeploymentInputs(templateId, packageId, digest, initParamsJson);
            ExecutionEngine.Assert(GetTemplateRaw(templateId) != null, "template not found");

            StorageMap deployments = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT);
            ExecutionEngine.Assert(deployments.Get(packageId) == null, "package already deployed");

            UInt160 deployedHash = UInt160.Zero;
            if (HasArtifact(templateId))
            {
                ByteString nef = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_NEF).Get(templateId);
                string manifest = new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_MANIFEST).Get(templateId);
                Contract deployed = ContractManagement.Deploy(nef, manifest, initParamsJson);
                deployedHash = deployed.Hash;
            }

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

            if (deployedHash != UInt160.Zero)
                OnTokenDeployed(templateId, packageId, deployedHash, creator);
            else
                OnDeploymentRecorded(templateId, packageId, digest, creator);

            return deployedHash;
        }

        // Used by MiniApp Factory. Registers a miniapp instance created from a template.
        public static ByteString CreateMiniAppFromTemplate(string templateId, string packageId, string digest, string initParamsJson)
        {
            UInt160 creator = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(creator), "unauthorized creator");
            ValidateDeploymentInputs(templateId, packageId, digest, initParamsJson);
            ExecutionEngine.Assert(GetTemplateRaw(templateId) != null, "template not found");

            StorageMap miniapps = new StorageMap(Storage.CurrentContext, PREFIX_MINIAPP);
            ExecutionEngine.Assert(miniapps.Get(packageId) == null, "package already created");

            MiniAppRecord record = new MiniAppRecord
            {
                TemplateId = templateId,
                PackageId = packageId,
                Digest = digest,
                InitParams = initParamsJson,
                Creator = creator,
                CreatedAt = Runtime.Time,
            };
            miniapps.Put(packageId, StdLib.Serialize(record));
            BigInteger index = MiniAppCount();
            new StorageMap(Storage.CurrentContext, PREFIX_MINIAPP_INDEX).Put(index.ToByteArray(), packageId);
            Storage.Put(Storage.CurrentContext, PREFIX_MINIAPP_COUNT, index + 1);

            OnMiniAppCreated(templateId, packageId, digest, creator);
            return (ByteString)packageId;
        }

        // ===================================================================
        //  Registry getters
        // ===================================================================
        [Safe]
        public static DeploymentRecord GetDeployment(string packageId)
        {
            ByteString raw = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOYMENT).Get(packageId);
            ExecutionEngine.Assert(raw != null, "deployment not found");
            return (DeploymentRecord)StdLib.Deserialize(raw);
        }

        [Safe]
        public static MiniAppRecord GetMiniApp(string packageId)
        {
            ByteString raw = new StorageMap(Storage.CurrentContext, PREFIX_MINIAPP).Get(packageId);
            ExecutionEngine.Assert(raw != null, "miniapp not found");
            return (MiniAppRecord)StdLib.Deserialize(raw);
        }

        [Safe]
        public static BigInteger DeploymentCount()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_DEPLOY_COUNT);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static BigInteger MiniAppCount()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_MINIAPP_COUNT);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [Safe]
        public static string GetDeploymentIdByIndex(BigInteger index)
        {
            ExecutionEngine.Assert(index >= 0 && index < DeploymentCount(), "index out of range");
            ByteString raw = new StorageMap(Storage.CurrentContext, PREFIX_DEPLOY_INDEX).Get(index.ToByteArray());
            return raw == null ? "" : raw;
        }

        [Safe]
        public static string GetMiniAppIdByIndex(BigInteger index)
        {
            ExecutionEngine.Assert(index >= 0 && index < MiniAppCount(), "index out of range");
            ByteString raw = new StorageMap(Storage.CurrentContext, PREFIX_MINIAPP_INDEX).Get(index.ToByteArray());
            return raw == null ? "" : raw;
        }

        // ===================================================================
        //  Internal helpers
        // ===================================================================
        private static ByteString GetTemplateRaw(string templateId)
        {
            if (templateId == null || templateId.Length == 0) return null;
            return new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE).Get(templateId);
        }

        private static bool HasArtifact(string templateId)
        {
            return new StorageMap(Storage.CurrentContext, PREFIX_TEMPLATE_NEF).Get(templateId) != null;
        }

        private static void ValidateId(string id, string error)
        {
            ExecutionEngine.Assert(id != null && id.Length > 0 && id.Length <= MAX_ID_LENGTH, error);
        }

        private static void ValidateHashStr(string value, string error)
        {
            // metadata hashes are optional but bounded when present
            ExecutionEngine.Assert(value != null && value.Length <= MAX_HASH_LENGTH, error);
        }

        private static void ValidateDeploymentInputs(string templateId, string packageId, string digest, string initParamsJson)
        {
            ValidateId(templateId, "invalid template id");
            ValidateId(packageId, "invalid package id");
            ExecutionEngine.Assert(digest != null && digest.Length > 0 && digest.Length <= MAX_HASH_LENGTH, "invalid digest");
            ExecutionEngine.Assert(initParamsJson != null && initParamsJson.Length <= MAX_JSON_LENGTH, "invalid init params");
        }
    }
}
