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
    public partial class MiniAppFactory : SmartContract
    {
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
