using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        private abstract class ComputeAccessor : MiniAppComputeBase
        {
            internal static ByteString BuildSeed(BigInteger operationId, UInt160 user, string scriptName) =>
                GenerateOperationSeed(operationId, user, scriptName);

            internal static void EnsureScriptHash(string scriptName, ByteString scriptHash) =>
                ValidateScriptHash(scriptName, scriptHash);

            internal static ByteString ReadSeed(BigInteger operationId) =>
                GetOperationSeed(operationId);

            internal static void ClearSeed(BigInteger operationId) =>
                DeleteOperationSeed(operationId);
        }

        private static ByteString GetScriptHash(string scriptName) =>
            MiniAppComputeBase.GetScriptHash(scriptName);

        private static BigInteger GetScriptVersion(string scriptName) =>
            MiniAppComputeBase.GetScriptVersion(scriptName);

        private static bool IsScriptEnabled(string scriptName) =>
            MiniAppComputeBase.IsScriptEnabled(scriptName);

        private static ByteString GenerateOperationSeed(BigInteger operationId, UInt160 user, string scriptName) =>
            ComputeAccessor.BuildSeed(operationId, user, scriptName);

        private static void ValidateScriptHash(string scriptName, ByteString scriptHash) =>
            ComputeAccessor.EnsureScriptHash(scriptName, scriptHash);

        private static ByteString GetOperationSeed(BigInteger operationId) =>
            ComputeAccessor.ReadSeed(operationId);

        private static void DeleteOperationSeed(BigInteger operationId) =>
            ComputeAccessor.ClearSeed(operationId);
    }
}
