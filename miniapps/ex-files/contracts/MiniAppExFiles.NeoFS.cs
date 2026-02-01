using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// ExFiles NeoFS Extension - Decentralized storage for anonymous records
    /// 
    /// This extension adds NeoFS support to ExFiles, enabling:
    /// - Large encrypted documents stored in NeoFS
    /// - Permanent and censorship-resistant record storage
    /// - Content-addressed verification via SHA256 hashes
    /// - Anonymous file sharing with integrity guarantees
    /// 
    /// STORAGE MODES:
    /// 1. HASH-ONLY MODE (Original): Store only data hash
    ///    - dataHash = SHA256(encryptedContent)
    ///    - Content stored off-chain by user
    ///    - Contract only verifies hash
    /// 
    /// 2. NEOFS MODE (Enhanced): Store NeoFS reference + hash
    ///    - dataHash = SHA256(encryptedContent)
    ///    - Content stored permanently in NeoFS
    ///    - Contract stores: containerId + objectId + hash
    ///    - 99% cheaper, always available, decentralized
    /// 
    /// USE CASES:
    /// - Anonymous document whistleblowing
    /// - Encrypted evidence storage
    /// - Decentralized file sharing
    /// - Permanent record archiving
    /// </summary>
    public partial class MiniAppExFiles
    {
        #region NeoFS Configuration
        
        // Content size thresholds
        /// <summary>Maximum allowed value .</summary>
        private const long MAX_ONCHAIN_SIZE = 1024;        // 1KB max on-chain
        private const long MAX_NEFOS_SIZE = 100 * 1024 * 1024;  // 100MB max per file
        
        // Content type identifiers
        private const BigInteger CONTENT_TYPE_DOCUMENT = 1;
        private const BigInteger CONTENT_TYPE_IMAGE = 2;
        private const BigInteger CONTENT_TYPE_VIDEO = 3;
        private const BigInteger CONTENT_TYPE_AUDIO = 4;
        private const BigInteger CONTENT_TYPE_ARCHIVE = 5;
        
        // Additional storage prefixes (0x30+)
        /// <summary>Storage prefix for record nefos container.</summary>
        private static readonly byte[] PREFIX_RECORD_NEFOS_CONTAINER = new byte[] { 0x30 };
        /// <summary>Storage prefix for record nefos object.</summary>
        private static readonly byte[] PREFIX_RECORD_NEFOS_OBJECT = new byte[] { 0x31 };
        /// <summary>Storage prefix for record nefos size.</summary>
        private static readonly byte[] PREFIX_RECORD_NEFOS_SIZE = new byte[] { 0x32 };
        /// <summary>Storage prefix for record nefos type.</summary>
        private static readonly byte[] PREFIX_RECORD_NEFOS_TYPE = new byte[] { 0x33 };
        /// <summary>Storage prefix for record verified hash.</summary>
        private static readonly byte[] PREFIX_RECORD_VERIFIED_HASH = new byte[] { 0x34 };
        
        #endregion

        #region Enhanced Data Structures
        
        /// <summary>
        /// NeoFS-enhanced record data
        /// </summary>
        public new struct RecordData
        {
            public UInt160 Creator;
            public ByteString DataHash;           // SHA256 hash of encrypted content
            public BigInteger Rating;
            public BigInteger Category;
            public BigInteger QueryCount;
            public BigInteger CreateTime;
            public BigInteger UpdateTime;
            public bool Active;
            public bool Verified;
            public UInt160 Verifier;
            public BigInteger ReportCount;
            
            // NeoFS fields
            public string NeoFSContainerId;       // null if hash-only mode
            public string NeoFSObjectId;          // null if hash-only mode
            public BigInteger ContentSize;        // File size in bytes
            public BigInteger ContentType;        // Document, image, video, etc.
            public bool IsNeoFS;                  // True if stored in NeoFS
        }
        
        /// <summary>
        /// NeoFS record reference for quick lookups
        /// </summary>
        public struct NeoFSRecordRef
        {
            public BigInteger RecordId;
            public string ContainerId;
            public string ObjectId;
            public ByteString DataHash;
            public BigInteger ContentSize;
            public BigInteger UploadTime;
        }
        
        #endregion

        #region NeoFS Events
        
        /// <summary>Event emitted when record stored in neo f s.</summary>
    public delegate void RecordStoredInNeoFSHandler(BigInteger recordId, string containerId, string objectId, BigInteger contentSize);
        /// <summary>Event emitted when record migrated to neo f s.</summary>
    public delegate void RecordMigratedToNeoFSHandler(BigInteger recordId, string containerId, string objectId);
        /// <summary>Event emitted when record content verified.</summary>
    public delegate void RecordContentVerifiedHandler(BigInteger recordId, bool valid);
        
        [DisplayName("RecordStoredInNeoFS")]
        public static event RecordStoredInNeoFSHandler OnRecordStoredInNeoFS;
        
        [DisplayName("RecordMigratedToNeoFS")]
        public static event RecordMigratedToNeoFSHandler OnRecordMigratedToNeoFS;
        
        [DisplayName("RecordContentVerified")]
        public static event RecordContentVerifiedHandler OnRecordContentVerified;
        
        #endregion

        #region Enhanced Read Methods
        
        /// <summary>
        /// Get enhanced record with NeoFS info
        /// </summary>
        [Safe]
        public static new RecordData GetRecord(BigInteger recordId)
        {
            byte[] key = GetRecordKey(recordId);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_CREATOR));
            if (data == null) return new RecordData();
            
            // Build base record
            RecordData record = new RecordData
            {
                Creator = GetUInt160(Helper.Concat(key, RECORD_FIELD_CREATOR)),
                DataHash = GetByteString(Helper.Concat(key, RECORD_FIELD_DATA_HASH)),
                Rating = GetBigInteger(Helper.Concat(key, RECORD_FIELD_RATING)),
                Category = GetBigInteger(Helper.Concat(key, RECORD_FIELD_CATEGORY)),
                QueryCount = GetBigInteger(Helper.Concat(key, RECORD_FIELD_QUERY_COUNT)),
                CreateTime = GetBigInteger(Helper.Concat(key, RECORD_FIELD_CREATE_TIME)),
                UpdateTime = GetBigInteger(Helper.Concat(key, RECORD_FIELD_UPDATE_TIME)),
                Active = GetBool(Helper.Concat(key, RECORD_FIELD_ACTIVE)),
                Verified = GetBool(Helper.Concat(key, RECORD_FIELD_VERIFIED)),
                Verifier = GetUInt160(Helper.Concat(key, RECORD_FIELD_VERIFIER)),
                ReportCount = GetBigInteger(Helper.Concat(key, RECORD_FIELD_REPORT_COUNT))
            };
            
            // Check for NeoFS data
            byte[] neofsKey = Helper.Concat(PREFIX_RECORD_NEFOS_CONTAINER, (ByteString)recordId.ToByteArray());
            ByteString containerData = Storage.Get(Storage.CurrentContext, neofsKey);
            
            if (containerData != null)
            {
                record.NeoFSContainerId = containerData.ToString();
                record.NeoFSObjectId = GetRecordNeoFSObjectId(recordId);
                record.ContentSize = GetRecordContentSize(recordId);
                record.ContentType = GetRecordContentType(recordId);
                record.IsNeoFS = true;
            }
            else
            {
                record.IsNeoFS = false;
            }
            
            return record;
        }
        
        /// <summary>
        /// Get NeoFS URL for a record's content
        /// </summary>
        [Safe]
        public static string GetRecordContentUrl(BigInteger recordId, string gatewayHost = "")
        {
            RecordData record = GetRecord(recordId);
            
            if (!record.IsNeoFS)
            {
                return "";  // Hash-only mode has no URL
            }
            
            if (string.IsNullOrEmpty(gatewayHost))
            {
                return $"neofs://{record.NeoFSContainerId}/{record.NeoFSObjectId}";
            }
            
            return $"{gatewayHost}/{record.NeoFSContainerId}/{record.NeoFSObjectId}";
        }
        
        /// <summary>
        /// Check if record is stored in NeoFS
        /// </summary>
        [Safe]
        public static bool IsRecordInNeoFS(BigInteger recordId)
        {
            byte[] key = Helper.Concat(PREFIX_RECORD_NEFOS_CONTAINER, (ByteString)recordId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key) != null;
        }
        
        /// <summary>
        /// Get record by data hash (finds both hash-only and NeoFS records)
        /// </summary>
        [Safe]
        public static RecordData GetRecordByHash(ByteString dataHash)
        {
            byte[] key = Helper.Concat(PREFIX_HASH_INDEX, dataHash);
            ByteString recordIdData = Storage.Get(Storage.CurrentContext, key);
            
            if (recordIdData == null) return new RecordData();
            
            BigInteger recordId = (BigInteger)recordIdData;
            return GetRecord(recordId);
        }
        
        /// <summary>
        /// Get all NeoFS records for a user
        /// </summary>
        [Safe]
        public static BigInteger[] GetUserNeoFSRecords(UInt160 user, BigInteger start, BigInteger limit)
        {
            BigInteger total = GetUserRecordCount(user);
            if (start >= total) return new BigInteger[0];
            
            BigInteger end = start + limit;
            if (end > total) end = total;
            
            BigInteger[] temp = new BigInteger[(int)(end - start)];
            BigInteger found = 0;
            
            for (BigInteger i = start; i < end; i++)
            {
                BigInteger recordId = GetUserRecordAt(user, i);
                if (IsRecordInNeoFS(recordId))
                {
                    temp[(int)found] = recordId;
                    found++;
                }
            }
            
            BigInteger[] result = new BigInteger[(int)found];
            for (int i = 0; i < (int)found; i++)
            {
                result[i] = temp[i];
            }
            return result;
        }
        
        // Helper getters
        private static string GetRecordNeoFSObjectId(BigInteger recordId)
        {
            byte[] key = Helper.Concat(PREFIX_RECORD_NEFOS_OBJECT, (ByteString)recordId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data?.ToString() ?? "";
        }
        
        private static BigInteger GetRecordContentSize(BigInteger recordId)
        {
            byte[] key = Helper.Concat(PREFIX_RECORD_NEFOS_SIZE, (ByteString)recordId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }
        
        private static BigInteger GetRecordContentType(BigInteger recordId)
        {
            byte[] key = Helper.Concat(PREFIX_RECORD_NEFOS_TYPE, (ByteString)recordId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }
        
        #endregion

        #region Enhanced Write Methods
        
        /// <summary>
        /// Create a record with NeoFS storage
        /// Enhanced version with content size and type
        /// </summary>
        public static BigInteger CreateRecordNeoFS(
            UInt160 creator,
            ByteString dataHash,
            BigInteger contentSize,
            BigInteger contentType,
            BigInteger rating,
            BigInteger category,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(dataHash.Length == 32, "invalid hash");
            ExecutionEngine.Assert(contentSize > 0 && contentSize <= MAX_NEFOS_SIZE, "invalid size");
            ExecutionEngine.Assert(contentType >= 1 && contentType <= 5, "invalid type");
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
            
            // Create record
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
                ReportCount = 0,
                ContentSize = contentSize,
                ContentType = contentType,
                IsNeoFS = false  // Will be set when upload completes
            };
            
            StoreRecord(recordId, record);
            
            // Index by hash
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_HASH_INDEX, dataHash), recordId);
            
            // Add to user's record list
            AddUserRecord(creator, recordId);
            
            // Update user stats
            CheckAndAwardBadge(creator, 1, "First Record");
            
            OnRecordCreated(recordId, creator, dataHash, category);
            return recordId;
        }
        
        /// <summary>
        /// Complete NeoFS record upload (called by oracle)
        /// </summary>
        public static bool CompleteRecordNeoFSUpload(
            BigInteger recordId,
            string containerId,
            string objectId,
            ByteString verifiedHash)
        {
            ValidateGateway();
            
            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(containerId.Length > 0, "invalid container");
            ExecutionEngine.Assert(objectId.Length > 0, "invalid object");
            
            // Verify hash matches
            if (verifiedHash != null && verifiedHash.Length == 32)
            {
                ExecutionEngine.Assert(record.DataHash.Equals(verifiedHash), "hash mismatch");
            }
            
            // Store NeoFS reference
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_CONTAINER, (ByteString)recordId.ToByteArray()),
                containerId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_OBJECT, (ByteString)recordId.ToByteArray()),
                objectId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_SIZE, (ByteString)recordId.ToByteArray()),
                record.ContentSize);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_TYPE, (ByteString)recordId.ToByteArray()),
                record.ContentType);
            
            // Mark as verified
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_VERIFIED_HASH, (ByteString)recordId.ToByteArray()),
                1);
            
            OnRecordStoredInNeoFS(recordId, containerId, objectId, record.ContentSize);
            return true;
        }
        
        /// <summary>
        /// Migrate existing hash-only record to NeoFS
        /// </summary>
        public static bool MigrateRecordToNeoFS(
            BigInteger recordId,
            string containerId,
            string objectId,
            ByteString verifiedHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(record.Creator), "not creator");
            ExecutionEngine.Assert(!record.IsNeoFS, "already in NeoFS");
            
            // Verify content hash matches
            if (verifiedHash != null)
            {
                ExecutionEngine.Assert(record.DataHash.Equals(verifiedHash), "hash mismatch");
            }
            
            // Store NeoFS reference
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_CONTAINER, (ByteString)recordId.ToByteArray()),
                containerId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_RECORD_NEFOS_OBJECT, (ByteString)recordId.ToByteArray()),
                objectId);
            
            OnRecordMigratedToNeoFS(recordId, containerId, objectId);
            return true;
        }
        
        #endregion

        #region Verification
        
        /// <summary>
        /// Verify record content integrity
        /// </summary>
        public static bool VerifyRecordContent(BigInteger recordId, ByteString computedHash)
        {
            RecordData record = GetRecord(recordId);
            if (record.Creator == UInt160.Zero) return false;
            
            bool valid = record.DataHash.Equals(computedHash);
            OnRecordContentVerified(recordId, valid);
            return valid;
        }
        
        /// <summary>
        /// Batch verify multiple records
        /// </summary>
        public static bool[] BatchVerifyRecords(BigInteger[] recordIds, ByteString[] computedHashes)
        {
            if (recordIds == null || computedHashes == null) return new bool[0];
            if (recordIds.Length != computedHashes.Length) return new bool[0];
            
            bool[] results = new bool[recordIds.Length];
            for (int i = 0; i < recordIds.Length; i++)
            {
                results[i] = VerifyRecordContent(recordIds[i], computedHashes[i]);
            }
            return results;
        }
        
        /// <summary>
        /// Check if record's NeoFS content is verified
        /// </summary>
        [Safe]
        public static bool IsRecordNeoFSVerified(BigInteger recordId)
        {
            byte[] key = Helper.Concat(PREFIX_RECORD_VERIFIED_HASH, (ByteString)recordId.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        
        #endregion

        #region Batch Operations
        
        /// <summary>
        /// Get multiple record content URLs
        /// </summary>
        [Safe]
        public static string[] GetRecordContentUrls(BigInteger[] recordIds, string gatewayHost)
        {
            if (recordIds == null) return new string[0];
            
            string[] urls = new string[recordIds.Length];
            for (int i = 0; i < recordIds.Length; i++)
            {
                urls[i] = GetRecordContentUrl(recordIds[i], gatewayHost);
            }
            return urls;
        }
        
        /// <summary>
        /// Get records filtered by content type
        /// </summary>
        [Safe]
        public static BigInteger[] GetRecordsByContentType(BigInteger contentType)
        {
            // Note: This is a simplified implementation
            // In production, you'd maintain a proper index by content type
            BigInteger total = TotalRecords();
            BigInteger[] temp = new BigInteger[(int)total];
            BigInteger found = 0;
            
            for (BigInteger i = 1; i <= total; i++)
            {
                RecordData record = GetRecord(i);
                if (record.IsNeoFS && record.ContentType == contentType)
                {
                    temp[(int)found] = i;
                    found++;
                }
            }
            
            BigInteger[] result = new BigInteger[(int)found];
            for (int i = 0; i < (int)found; i++)
            {
                result[i] = temp[i];
            }
            return result;
        }
        
        /// <summary>
        /// Get NeoFS record statistics
        /// </summary>
        [Safe]
        public static Map<string, BigInteger> GetNeoFSStats()
        {
            Map<string, BigInteger> stats = new Map<string, BigInteger>();
            BigInteger total = TotalRecords();
            BigInteger neofsCount = 0;
            BigInteger hashOnlyCount = 0;
            BigInteger verifiedCount = 0;
            
            for (BigInteger i = 1; i <= total; i++)
            {
                if (IsRecordInNeoFS(i))
                {
                    neofsCount++;
                    if (IsRecordNeoFSVerified(i))
                    {
                        verifiedCount++;
                    }
                }
                else
                {
                    hashOnlyCount++;
                }
            }
            
            stats["total"] = total;
            stats["neofs"] = neofsCount;
            stats["hashOnly"] = hashOnlyCount;
            stats["verified"] = verifiedCount;
            return stats;
        }
        
        #endregion
    }
}
