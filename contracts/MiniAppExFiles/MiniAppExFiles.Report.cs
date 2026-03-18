using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Report Methods

        /// <summary>
        /// Report a record for inappropriate content.
        /// </summary>
        public static void ReportRecord(BigInteger recordId, UInt160 reporter, string reason)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(reason.Length > 0 && reason.Length <= MAX_REASON_LENGTH, "invalid reason");

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(record.Active, "record inactive");
            ExecutionEngine.Assert(record.Creator != reporter, "cannot self-report");

            ValidateUserOrAbstractAccount(reporter);

            ConsumeDirectGasCredit(reporter, REPORT_FEE);

            record.ReportCount += 1;
            StoreRecord(recordId, record);

            UpdateUserStatsOnReport(reporter);

            OnReportSubmitted(recordId, reporter, reason);
        }

        #endregion
    }
}
