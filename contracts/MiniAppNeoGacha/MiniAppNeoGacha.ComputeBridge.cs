using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

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

            internal static void ClearSeed(BigInteger operationId) =>
                DeleteOperationSeed(operationId);
        }

        private static bool IsScriptEnabled(string scriptName) =>
            MiniAppComputeBase.IsScriptEnabled(scriptName);

        private static MiniAppGameComputeBase.GameBetLimitsConfig GetGameBetLimits() =>
            MiniAppGameComputeBase.GetGameBetLimits();

        private static void ValidateGameBetLimits(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.ValidateBet(player, amount);

        private static ByteString GenerateOperationSeed(BigInteger operationId, UInt160 user, string scriptName) =>
            GameComputeAccessor.BuildSeed(operationId, user, scriptName);

        private static void RecordGameBet(UInt160 player, BigInteger amount) =>
            GameComputeAccessor.RecordBet(player, amount);

        private static void ValidateScriptHash(string scriptName, ByteString scriptHash) =>
            GameComputeAccessor.EnsureScriptHash(scriptName, scriptHash);

        private static ByteString GetRegisteredScriptHash(string scriptName) =>
            MiniAppComputeBase.GetScriptHash(scriptName);

        private static void DeleteOperationSeed(BigInteger operationId) =>
            GameComputeAccessor.ClearSeed(operationId);
    }
}
