using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Service Callback

        public static void OnServiceCallback(
            BigInteger requestId, string appId, string serviceType,
            bool success, ByteString result, string error)
        {
            ValidateGateway();

            ByteString roundIdData = GetRequestData(requestId);
            ExecutionEngine.Assert(roundIdData != null, "unknown request");

            BigInteger roundId = (BigInteger)roundIdData;

            if (!success)
            {
                Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 0);
                OnWinnerDrawn(UInt160.Zero, 0, roundId);
                DeleteRequestData(requestId);
                return;
            }

            ExecutionEngine.Assert(result != null && result.Length > 0, "no rng data");

            ProcessDrawResult(requestId, roundId, result);
        }

        #endregion
    }
}
