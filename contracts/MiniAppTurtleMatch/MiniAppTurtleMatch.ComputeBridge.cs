using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        private abstract class GameComputeAccessor : MiniAppGameComputeBase
        {
            internal static void ValidateBet(UInt160 player, BigInteger amount) =>
                ValidateGameBetLimits(player, amount);

            internal static void RecordBet(UInt160 player, BigInteger amount) =>
                RecordGameBet(player, amount);

            internal static ByteString BuildSeed(BigInteger operationId, UInt160 user, string scriptName) =>
                GenerateOperationSeed(operationId, user, scriptName);

            internal static void EnsureScriptHash(string scriptName, ByteString scriptHash) =>
                ValidateScriptHash(scriptName, scriptHash);

            internal static ByteString ReadSeed(BigInteger operationId) =>
                GetOperationSeed(operationId);

            internal static void ClearSeed(BigInteger operationId) =>
                DeleteOperationSeed(operationId);

            internal static void RegisterHybridScript(string scriptName, ByteString scriptHash)
            {
                ValidateAdmin();
                ExecutionEngine.Assert(scriptName != null && scriptName.Length > 0 && scriptName.Length <= 64, "invalid script name");
                ExecutionEngine.Assert(scriptHash != null && scriptHash.Length == 32, "script hash must be 32 bytes");

                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                nameMap.Put(scriptName, scriptHash);

                StorageMap hashMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_HASH);
                hashMap.Put(scriptHash, scriptName);

                StorageMap versionMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_VERSION);
                ByteString currentVersion = versionMap.Get(scriptName);
                BigInteger nextVersion = currentVersion == null ? 1 : (BigInteger)currentVersion + 1;
                versionMap.Put(scriptName, nextVersion);

                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 1);
            }

            internal static void EnableHybridScript(string scriptName)
            {
                ValidateAdmin();
                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                ExecutionEngine.Assert(nameMap.Get(scriptName) != null, "script not registered");
                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 1);
            }

            internal static void DisableHybridScript(string scriptName)
            {
                ValidateAdmin();
                StorageMap nameMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_NAME);
                ExecutionEngine.Assert(nameMap.Get(scriptName) != null, "script not registered");
                StorageMap enabledMap = new StorageMap(Storage.CurrentContext, PREFIX_SCRIPT_ENABLED);
                enabledMap.Put(scriptName, 0);
            }

            internal static Map<string, object> GetHybridScriptInfo(string scriptName)
            {
                Map<string, object> info = new Map<string, object>();
                ByteString hash = MiniAppComputeBase.GetScriptHash(scriptName);
                if (hash == null)
                {
                    info["exists"] = false;
                    return info;
                }

                info["exists"] = true;
                info["name"] = scriptName;
                info["hash"] = hash;
                info["version"] = MiniAppComputeBase.GetScriptVersion(scriptName);
                info["enabled"] = MiniAppComputeBase.IsScriptEnabled(scriptName);
                return info;
            }
        }

        private static void ValidateGameBetLimits(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.ValidateBet(player, amount);

        private static void RecordGameBet(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.RecordBet(player, amount);

        private static ByteString GenerateOperationSeed(BigInteger operationId, UInt160 user, string scriptName) =>
            GameComputeAccessor.BuildSeed(operationId, user, scriptName);

        private static void ValidateScriptHash(string scriptName, ByteString scriptHash) =>
            GameComputeAccessor.EnsureScriptHash(scriptName, scriptHash);

        private static ByteString GetOperationSeed(BigInteger operationId) =>
            GameComputeAccessor.ReadSeed(operationId);

        private static void DeleteOperationSeed(BigInteger operationId) =>
            GameComputeAccessor.ClearSeed(operationId);

        public static void RegisterScript(string scriptName, ByteString scriptHash) =>
            GameComputeAccessor.RegisterHybridScript(scriptName, scriptHash);

        public static void EnableScript(string scriptName) =>
            GameComputeAccessor.EnableHybridScript(scriptName);

        public static void DisableScript(string scriptName) =>
            GameComputeAccessor.DisableHybridScript(scriptName);

        public static Map<string, object> GetScriptInfo(string scriptName) =>
            GameComputeAccessor.GetHybridScriptInfo(scriptName);
    }
}
