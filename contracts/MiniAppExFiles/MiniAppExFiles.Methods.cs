using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Create Methods

        /// <summary>
        /// Create a new anonymous record.
        /// </summary>
        public static BigInteger CreateRecord(UInt160 creator, ByteString dataHash, BigInteger rating, BigInteger category, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(dataHash.Length == 32, "invalid hash");
            ExecutionEngine.Assert(rating >= 1 && rating <= 5, "rating 1-5");
            ExecutionEngine.Assert(category >= 1 && category <= 5, "invalid category");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, CREATE_FEE, receiptId);

            // Check if new user
            UserStats stats = GetUserStats(creator);
            bool isNewUser = stats.JoinTime == 0;

            BigInteger recordId = TotalRecords() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_RECORD_ID, recordId);

            RecordData record = new RecordData
            {
                Creator = creator,
                DataHash = dataHash,
                Rating = rating,
                Category = category,
                QueryCount = 0,
                CreateTime = Runtime.Time,
                UpdateTime = Runtime.Time,
                Active = true,
                Verified = false,
                Verifier = UInt160.Zero,
                ReportCount = 0
            };
            StoreRecord(recordId, record);

            // Index by hash
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HASH_INDEX, dataHash), recordId);

            // Add to user's record list
            AddUserRecord(creator, recordId);

            // Update user stats
            UpdateUserStatsOnCreate(creator, rating, isNewUser);

            // Check for first record badge
            CheckAndAwardBadge(creator, 1, "First Record");

            OnRecordCreated(recordId, creator, dataHash, category);
            return recordId;
        }

        #endregion
    }
}
