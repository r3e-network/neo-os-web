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
    public delegate void RecordCreatedHandler(BigInteger recordId, UInt160 creator, ByteString dataHash);
    public delegate void RecordQueriedHandler(BigInteger recordId, UInt160 querier);
    public delegate void RecordDeletedHandler(BigInteger recordId, UInt160 owner);

    /// <summary>
    /// ExFiles MiniApp - Anonymous ex-partner database with encrypted records.
    /// Users can anonymously record and query relationship history.
    /// TEE ensures privacy while enabling pattern matching.
    /// </summary>
    [DisplayName("MiniAppExFiles")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. ExFiles is a privacy-preserving database application for anonymous records. Use it to store and query encrypted relationship data, you can access pattern matching with TEE-protected privacy.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-exfiles";
        private const long CREATE_FEE = 10000000; // 0.1 GAS
        private const long QUERY_FEE = 5000000; // 0.05 GAS
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_RECORD_ID = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_RECORDS = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_HASH_INDEX = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x21 };
        #endregion

        #region Data Structures
        public struct RecordData
        {
            public UInt160 Creator;
            public ByteString DataHash;
            public BigInteger Rating;
            public BigInteger QueryCount;
            public BigInteger CreateTime;
            public bool Active;
        }
        #endregion

        #region App Events
        [DisplayName("RecordCreated")]
        public static event RecordCreatedHandler OnRecordCreated;

        [DisplayName("RecordQueried")]
        public static event RecordQueriedHandler OnRecordQueried;

        [DisplayName("RecordDeleted")]
        public static event RecordDeletedHandler OnRecordDeleted;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_RECORD_ID, 0);
        }
        #endregion

        #region User-Facing Methods

        public static BigInteger CreateRecord(UInt160 creator, ByteString dataHash, BigInteger rating, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(dataHash.Length == 32, "invalid hash");
            ExecutionEngine.Assert(rating >= 1 && rating <= 5, "rating 1-5");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ValidatePaymentReceipt(APP_ID, creator, CREATE_FEE, receiptId);

            BigInteger recordId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RECORD_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_RECORD_ID, recordId);

            RecordData record = new RecordData
            {
                Creator = creator,
                DataHash = dataHash,
                Rating = rating,
                QueryCount = 0,
                CreateTime = Runtime.Time,
                Active = true
            };
            StoreRecord(recordId, record);

            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HASH_INDEX, dataHash), recordId);

            OnRecordCreated(recordId, creator, dataHash);
            return recordId;
        }

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
                OnRecordQueried(recordId, querier);
            }

            return record;
        }

        public static void DeleteRecord(BigInteger recordId, UInt160 owner)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator == owner, "not owner");

            record.Active = false;
            StoreRecord(recordId, record);

            OnRecordDeleted(recordId, owner);
        }

        [Safe]
        public static RecordData GetRecord(BigInteger recordId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_RECORDS, (ByteString)recordId.ToByteArray()));
            if (data == null) return new RecordData();
            return (RecordData)StdLib.Deserialize(data);
        }

        #endregion

        #region Internal Helpers

        private static void StoreRecord(BigInteger recordId, RecordData record)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_RECORDS, (ByteString)recordId.ToByteArray()),
                StdLib.Serialize(record));
        }

        #endregion

        #region Automation
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }

        public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
        {
            UInt160 anchor = AutomationAnchor();
            ExecutionEngine.Assert(anchor != UInt160.Zero && Runtime.CallingScriptHash == anchor, "unauthorized");
        }
        #endregion
    }
}
