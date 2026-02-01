using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Query By Hash

        /// <summary>
        /// Query a record by its data hash.
        /// </summary>
        public static RecordData QueryByHash(UInt160 querier, ByteString dataHash, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(querier), "unauthorized");

            ValidatePaymentReceipt(APP_ID, querier, QUERY_FEE, receiptId);

            ByteString recordIdData = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HASH_INDEX, dataHash));
            if (recordIdData == null) return new RecordData();

            BigInteger recordId = (BigInteger)recordIdData;
            RecordData record = GetRecord(recordId);

            if (record.Active)
            {
                record.QueryCount += 1;
                StoreRecord(recordId, record);

                // Update global query count
                BigInteger totalQueries = TotalQueries();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_QUERIES, totalQueries + 1);

            }

            return record;
        }

        #endregion
    }
}
