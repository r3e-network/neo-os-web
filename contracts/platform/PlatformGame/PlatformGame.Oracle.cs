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
    public partial class PlatformGameContract
    {
        private struct OracleRequestContext
        {
            public string AppId;
            public BigInteger GameType;
            public BigInteger OperationId;
        }

        #region Oracle Request Helpers

        /// <summary>
        /// Request RNG or other data from the configured Morpheus Oracle.
        /// </summary>
        private static BigInteger RequestOracleForCallback(
            UInt160 requester, string requestType, ByteString payload)
        {
            ValidateAddress(requester);
            UInt160 oracle = Oracle();
            ExecutionEngine.Assert(oracle != UInt160.Zero && oracle.IsValid, "oracle not set");

            // Audit fix NEW-M-10: CallFlags.All let the Morpheus oracle (or
            // whatever the configured oracle is) write to PlatformGame storage
            // and call other contracts under our witness. The oracle only
            // needs to record the request and emit its own event; AllowCall +
            // AllowNotify is sufficient.
            return (BigInteger)Contract.Call(
                oracle,
                "requestFromCallback",
                CallFlags.AllowCall | CallFlags.AllowNotify,
                requester,
                requestType,
                payload,
                Runtime.ExecutingScriptHash,
                "onOracleResult");
        }

        private static byte[] OracleRequestKey(BigInteger requestId)
        {
            return (byte[])Helper.Concat(
                (ByteString)PREFIX_ORACLE_REQUEST,
                (ByteString)requestId.ToByteArray());
        }

        private static void StoreOracleRequestContext(
            BigInteger requestId,
            string appId,
            BigInteger gameType,
            BigInteger operationId)
        {
            ExecutionEngine.Assert(requestId > 0, "invalid oracle request");
            OracleRequestContext context = new OracleRequestContext
            {
                AppId = appId,
                GameType = gameType,
                OperationId = operationId
            };
            Storage.Put(Storage.CurrentContext, OracleRequestKey(requestId), StdLib.Serialize(new object[]
            {
                context.AppId,
                context.GameType,
                context.OperationId
            }));
        }

        private static OracleRequestContext LoadOracleRequestContext(BigInteger requestId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, OracleRequestKey(requestId));
            ExecutionEngine.Assert(data != null, "oracle request context not found");
            object[] values = (object[])StdLib.Deserialize(data);
            ExecutionEngine.Assert(values != null && values.Length >= 3, "oracle request context malformed");
            return new OracleRequestContext
            {
                AppId = (string)values[0],
                GameType = (BigInteger)values[1],
                OperationId = (BigInteger)values[2]
            };
        }

        /// <summary>
        /// Oracle callback entry point.  Dispatches to the appropriate
        /// game module based on the appId embedded in the payload.
        /// </summary>
        public static void OnOracleResult(
            BigInteger requestId,
            string requestType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateOracle();
            // Audit fix NEW-M-11: validate requestType on EVERY callback (the
            // prior code only validated on the success path, so a misbehaving
            // oracle could trigger a Dice refund by calling OnOracleResult with
            // an arbitrary requestType and success=false). Now refunds are
            // gated on the oracle producing the expected requestType too.
            ExecutionEngine.Assert(requestType == "vrf_random", "unexpected oracle request");
            OracleRequestContext context = LoadOracleRequestContext(requestId);

            if (!success)
            {
                if (context.GameType == GameType_Dice)
                {
                    RefundDiceBetFromOracle(context.AppId, context.OperationId, requestId);
                }
                Storage.Delete(Storage.CurrentContext, OracleRequestKey(requestId));
                return;
            }
            ExecutionEngine.Assert(result != null && result.Length > 0, "empty oracle result");

            if (context.GameType == GameType_CoinFlip)
            {
                ResolveCoinFlipBetFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else if (context.GameType == GameType_Gacha)
            {
                ResolveGachaPullFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else if (context.GameType == GameType_Dice)
            {
                ResolveDiceBetFromOracle(context.AppId, context.OperationId, requestId, result);
            }
            else
            {
                ExecutionEngine.Assert(false, "unsupported oracle game type");
            }

            Storage.Delete(Storage.CurrentContext, OracleRequestKey(requestId));
        }

        #endregion
    }
}
