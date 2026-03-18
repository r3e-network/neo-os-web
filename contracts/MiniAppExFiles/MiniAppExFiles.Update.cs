using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Update Methods

        /// <summary>
        /// Update a record's rating.
        /// </summary>
        public static void UpdateRecord(BigInteger recordId, BigInteger newRating, string reason)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(newRating >= 1 && newRating <= 5, "rating 1-5");
            ExecutionEngine.Assert(reason.Length <= MAX_REASON_LENGTH, "reason too long");

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(record.Active, "record inactive");
            ValidateUserOrAbstractAccount(record.Creator);

            ConsumeDirectGasCredit(record.Creator, UPDATE_FEE);

            record.Rating = newRating;
            record.UpdateTime = Runtime.Time;
            StoreRecord(recordId, record);

            UpdateUserStatsOnUpdate(record.Creator);

            OnRecordUpdated(recordId, newRating, reason);
        }

        #endregion
    }
}
