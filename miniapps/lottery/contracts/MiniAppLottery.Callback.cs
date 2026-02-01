using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Service Callback

        /// <summary>
        /// Handle RNG service callback for lottery draws.
        /// 
        /// TRIGGERED BY: Oracle RNG service
        /// 
        /// PROCESS:
        /// - Validates callback from authorized gateway
        /// - Retrieves round data from request ID
        /// - If failed: clears draw pending flag
        /// - If successful: processes draw with random result
        /// 
        /// SECURITY:
        /// - Validates request data exists
        /// - Validates result data present on success
        /// </summary>
        /// <param name="requestId">RNG request ID</param>
        /// <param name="appId">Application ID</param>
        /// <param name="serviceType">Service type</param>
        /// <param name="success">Whether RNG request succeeded</param>
        /// <param name="result">Random result bytes</param>
        /// <param name="error">Error message if failed</param>
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
