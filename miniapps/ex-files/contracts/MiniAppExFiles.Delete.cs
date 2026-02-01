using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Delete Methods

        /// <summary>
        /// Delete a record (soft delete).
        /// </summary>
        public static void DeleteRecord(BigInteger recordId, UInt160 owner)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator == owner, "not owner");
            ExecutionEngine.Assert(record.Active, "already deleted");

            record.Active = false;
            StoreRecord(recordId, record);

        }

        #endregion
    }
}
