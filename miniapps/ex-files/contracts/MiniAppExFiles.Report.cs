using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Report Methods

        /// <summary>
        /// Report a record for inappropriate content.
        /// </summary>
        public static void ReportRecord(BigInteger recordId, UInt160 reporter, string reason, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(reason.Length > 0 && reason.Length <= MAX_REASON_LENGTH, "invalid reason");

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(record.Active, "record inactive");
            ExecutionEngine.Assert(record.Creator != reporter, "cannot self-report");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(reporter), "unauthorized");

            ValidatePaymentReceipt(APP_ID, reporter, REPORT_FEE, receiptId);

            record.ReportCount += 1;
            StoreRecord(recordId, record);

        }

        #endregion
    }
}
