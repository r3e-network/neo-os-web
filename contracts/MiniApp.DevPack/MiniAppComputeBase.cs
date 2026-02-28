using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniApp DevPack - Off-Chain Compute Extension
    ///
    /// Provides script registration and verification for hybrid on-chain/off-chain computation:
    /// - Register authorized script hashes (SHA256 of script content)
    /// - Generate deterministic seeds for off-chain calculations
    /// - Verify computation results match registered scripts
    ///
    /// HYBRID COMPUTATION FLOW:
    /// 1. Admin registers script hash: RegisterScript(scriptName, scriptHash)
    /// 2. User initiates operation: InitiateXxx() -> returns (operationId, seed)
    /// 3. Frontend/Edge calls off-chain compute with seed
    /// 4. Edge verifies script hash matches registered hash
    /// 5. User settles operation: SettleXxx(operationId, result, scriptHash)
    /// 6. Contract verifies scriptHash is registered
    ///
    /// STORAGE LAYOUT (0x20-0x2F reserved for compute):
    /// - 0x20: PREFIX_SCRIPT_HASH - Registered script hashes
    /// - 0x21: PREFIX_SCRIPT_NAME - Script name to hash mapping
    /// - 0x22: PREFIX_OPERATION_SEED - Operation seeds for verification
    /// - 0x23: PREFIX_SCRIPT_VERSION - Script version tracking
    ///
    /// INHERITANCE:
    /// MiniAppBase -> MiniAppServiceBase -> MiniAppComputeBase
    /// This allows contracts to use both service callbacks and hybrid compute.
    /// </summary>
    public abstract class MiniAppComputeBase : MiniAppServiceBase
    {
        #region Compute Storage Prefixes (0x20-0x2F)

        protected static readonly byte[] PREFIX_SCRIPT_HASH = new byte[] { 0x20 };
        protected static readonly byte[] PREFIX_SCRIPT_NAME = new byte[] { 0x21 };
        protected static readonly byte[] PREFIX_OPERATION_SEED = new byte[] { 0x22 };
        protected static readonly byte[] PREFIX_SCRIPT_VERSION = new byte[] { 0x23 };
        protected static readonly byte[] PREFIX_SCRIPT_ENABLED = new byte[] { 0x24 };

        #endregion

        #region Events

        public delegate void ScriptRegisteredHandler(
            string scriptName, ByteString scriptHash, BigInteger version);
        public delegate void ScriptDisabledHandler(string scriptName, ByteString scriptHash);
        public delegate void ComputeInitiatedHandler(
            BigInteger operationId, UInt160 user, string scriptName, ByteString seed);
        public delegate void ComputeSettledHandler(
            BigInteger operationId, UInt160 user, bool success, ByteString resultHash);

        [System.ComponentModel.DisplayName("ScriptRegistered")]
        public static event ScriptRegisteredHandler OnScriptRegistered;

        [System.ComponentModel.DisplayName("ScriptDisabled")]
        public static event ScriptDisabledHandler OnScriptDisabled;

        [System.ComponentModel.DisplayName("ComputeInitiated")]
        public static event ComputeInitiatedHandler OnComputeInitiated;

        [System.ComponentModel.DisplayName("ComputeSettled")]
        public static event ComputeSettledHandler OnComputeSettled;

        #endregion

        #region Script Registration (Admin Only)

        /// <summary>
        /// Register a script hash for off-chain computation.
        /// The hash must be SHA256 of the exact script content.
        /// </summary>
        /// <param name="scriptName">Unique name for the script (e.g., "calculate-cards")</param>
        /// <param name="scriptHash">SHA256 hash of the script content (32 bytes)</param>
        public static void RegisterScript(string scriptName, ByteString scriptHash)
        {
            ValidateAdmin();
            ExecutionEngine.Assert(
                scriptName != null && scriptName.Length > 0 && scriptName.Length <= 64,
                "invalid script name");
            ExecutionEngine.Assert(
                scriptHash != null && scriptHash.Length == 32,
                "script hash must be 32 bytes");

            // Get current version
            BigInteger version = GetScriptVersion(scriptName) + 1;

            // Store hash by name
            StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
            nameMap.Put(scriptName, scriptHash);

            // Store name by hash (for reverse lookup)
            StorageMap hashMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_HASH);
            hashMap.Put(scriptHash, scriptName);

            // Update version
            StorageMap versionMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_VERSION);
            versionMap.Put(scriptName, version);

            // Enable script
            StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
            enabledMap.Put(scriptName, 1);

            OnScriptRegistered(scriptName, scriptHash, version);
        }

        /// <summary>
        /// Disable a registered script (does not delete, allows re-enabling).
        /// </summary>
        public static void DisableScript(string scriptName)
        {
            ValidateAdmin();
            ByteString hash = GetScriptHash(scriptName);
            ExecutionEngine.Assert(hash != null, "script not registered");

            StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
            enabledMap.Put(scriptName, 0);

            OnScriptDisabled(scriptName, hash);
        }

        /// <summary>
        /// Re-enable a disabled script.
        /// </summary>
        public static void EnableScript(string scriptName)
        {
            ValidateAdmin();
            ByteString hash = GetScriptHash(scriptName);
            ExecutionEngine.Assert(hash != null, "script not registered");

            StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
            enabledMap.Put(scriptName, 1);
        }

        #endregion

        #region Script Query Methods

        /// <summary>
        /// Get the registered hash for a script name.
        /// </summary>
        [Safe]
        public static ByteString GetScriptHash(string scriptName)
        {
            StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
            return nameMap.Get(scriptName);
        }

        /// <summary>
        /// Get the script name for a hash (reverse lookup).
        /// </summary>
        [Safe]
        public static string GetScriptName(ByteString scriptHash)
        {
            StorageMap hashMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_HASH);
            return hashMap.Get(scriptHash);
        }

        /// <summary>
        /// Check if a script hash is registered and enabled.
        /// </summary>
        [Safe]
        public static bool IsScriptValid(ByteString scriptHash)
        {
            string name = GetScriptName(scriptHash);
            if (name == null) return false;
            return IsScriptEnabled(name);
        }

        /// <summary>
        /// Check if a script is enabled.
        /// </summary>
        [Safe]
        public static bool IsScriptEnabled(string scriptName)
        {
            StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
            return (BigInteger)enabledMap.Get(scriptName) == 1;
        }

        /// <summary>
        /// Get the version number of a script.
        /// </summary>
        [Safe]
        public static BigInteger GetScriptVersion(string scriptName)
        {
            StorageMap versionMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_VERSION);
            ByteString data = versionMap.Get(scriptName);
            return data == null ? 0 : (BigInteger)data;
        }

        /// <summary>
        /// Get all script info for frontend/edge verification.
        /// </summary>
        [Safe]
        public static Map<string, object> GetScriptInfo(string scriptName)
        {
            Map<string, object> info = new Map<string, object>();
            ByteString hash = GetScriptHash(scriptName);

            if (hash == null)
            {
                info["exists"] = false;
                return info;
            }

            info["exists"] = true;
            info["name"] = scriptName;
            info["hash"] = hash;
            info["version"] = GetScriptVersion(scriptName);
            info["enabled"] = IsScriptEnabled(scriptName);

            return info;
        }

        #endregion

        #region Operation Seed Management

        /// <summary>
        /// Generate and store a deterministic seed for an operation.
        /// </summary>
        protected static ByteString GenerateOperationSeed(
            BigInteger operationId,
            UInt160 user,
            string scriptName)
        {
            ByteString data = Helper.Concat(
                (ByteString)operationId.ToByteArray(),
                (ByteString)user);
            data = Helper.Concat(data, (ByteString)scriptName);
            data = Helper.Concat(data, (ByteString)((BigInteger)Runtime.Time).ToByteArray());
            data = Helper.Concat(data, (ByteString)Runtime.ExecutingScriptHash);

            ByteString seed = CryptoLib.Sha256(data);

            // Store seed for verification
            StorageMap seedMap = new StorageMap(Storage.CurrentContext, PREFIX_OPERATION_SEED);
            seedMap.Put(operationId.ToByteArray(), seed);

            return seed;
        }

        /// <summary>
        /// Get stored seed for an operation.
        /// </summary>
        [Safe]
        protected static ByteString GetOperationSeed(BigInteger operationId)
        {
            StorageMap seedMap = new StorageMap(Storage.CurrentContext, PREFIX_OPERATION_SEED);
            return seedMap.Get(operationId.ToByteArray());
        }

        /// <summary>
        /// Delete operation seed after settlement.
        /// </summary>
        protected static void DeleteOperationSeed(BigInteger operationId)
        {
            StorageMap seedMap = new StorageMap(Storage.CurrentContext, PREFIX_OPERATION_SEED);
            seedMap.Delete(operationId.ToByteArray());
        }

        /// <summary>
        /// Verify that a script hash matches the registered hash.
        /// </summary>
        protected static void ValidateScriptHash(string scriptName, ByteString providedHash)
        {
            ByteString registeredHash = GetScriptHash(scriptName);
            ExecutionEngine.Assert(registeredHash != null, "script not registered");
            ExecutionEngine.Assert(IsScriptEnabled(scriptName), "script disabled");
            ExecutionEngine.Assert(registeredHash == providedHash, "script hash mismatch");
        }

        #endregion

        #region Compute Result Verification

        /// <summary>
        /// Verify computation result by checking:
        /// 1. Operation seed exists
        /// 2. Script hash is registered and enabled
        /// 3. Result can be deterministically verified (app-specific)
        /// </summary>
        protected static bool VerifyComputeResult(
            BigInteger operationId,
            string scriptName,
            ByteString scriptHash,
            ByteString resultHash)
        {
            // Verify seed exists
            ByteString seed = GetOperationSeed(operationId);
            if (seed == null) return false;

            // Verify script is valid
            if (!IsScriptValid(scriptHash)) return false;

            // Verify script name matches hash
            ByteString registeredHash = GetScriptHash(scriptName);
            if (registeredHash != scriptHash) return false;

            return true;
        }

        #endregion
    }
}
