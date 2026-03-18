using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Query By Hash

        /// <summary>
        /// Query a record by its data hash.
        /// </summary>
        public static RecordData QueryByHash(UInt160 querier, ByteString dataHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateUserOrAbstractAccount(querier);

            ConsumeDirectGasCredit(querier, QUERY_FEE);

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

                // Update user stats
                UpdateUserStatsOnQuery(querier);

                OnRecordQueried(recordId, querier, 1);
            }

            return record;
        }

        #endregion
    }
}
