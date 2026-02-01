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
    // Event delegates for ExFiles lifecycle
    /// <summary>Event emitted when record created.</summary>
    public delegate void RecordCreatedHandler(BigInteger recordId, UInt160 creator, ByteString dataHash, BigInteger category);
    /// <summary>Event emitted when record queried.</summary>
    public delegate void RecordQueriedHandler(BigInteger recordId, UInt160 querier, BigInteger queryType);
    /// <summary>Event emitted when record deleted.</summary>
    public delegate void RecordDeletedHandler(BigInteger recordId, UInt160 owner);
    /// <summary>Event emitted when record updated.</summary>
    public delegate void RecordUpdatedHandler(BigInteger recordId, BigInteger newRating, string updateReason);
    /// <summary>Event emitted when record verified.</summary>
    public delegate void RecordVerifiedHandler(BigInteger recordId, UInt160 verifier, bool verified);
    /// <summary>Event emitted when report submitted.</summary>
    public delegate void ReportSubmittedHandler(BigInteger recordId, UInt160 reporter, string reason);
    /// <summary>Event emitted when user badge earned.</summary>
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

    [DisplayName("MiniAppExFiles")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. ExFiles is a complete anonymous relationship database with encrypted records, categories, verification, reporting, user badges, and TEE-protected privacy.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    /// <summary>
    /// ExFiles MiniApp - Anonymous relationship database with NeoFS storage support.
    /// 
    /// FEATURES:
    /// - Create anonymous encrypted records
    /// - Content hash verification
    /// - NeoFS storage for large documents
    /// - Categorization and rating
    /// - Query tracking
    /// - Verification and reporting
    /// 
    /// NEOFS STORAGE:
    /// - Large documents stored permanently in NeoFS
    /// - 99% cheaper than on-chain storage
    /// - Content-addressed integrity verification
    /// - Censorship-resistant and permanent
    /// 
    /// STORAGE MODES:
    /// - Hash-Only: Store only SHA256 hash (user manages storage)
    /// - NeoFS: Store reference + hash (decentralized storage)
    /// </summary>
    public partial class MiniAppExFiles : MiniAppNeoFSBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the ex-files miniapp.</summary>
        private const string APP_ID = "miniapp-exfiles";
        /// <summary>Fee rate .</summary>
        private const long CREATE_FEE = 10000000;
        /// <summary>Fee rate .</summary>
        private const long QUERY_FEE = 5000000;
        /// <summary>Fee rate .</summary>
        private const long UPDATE_FEE = 5000000;
        /// <summary>Fee rate .</summary>
        private const long VERIFY_FEE = 20000000;
        /// <summary>Fee rate .</summary>
        private const long REPORT_FEE = 10000000;
        private const int MAX_REASON_LENGTH = 500;
        #endregion

        #region App Prefixes
        /// <summary>Storage prefix for record id.</summary>
        private static readonly byte[] PREFIX_RECORD_ID = new byte[] { 0x20 };
        /// <summary>Storage prefix for records.</summary>
        private static readonly byte[] PREFIX_RECORDS = new byte[] { 0x21 };
        /// <summary>Storage prefix for hash index.</summary>
        private static readonly byte[] PREFIX_HASH_INDEX = new byte[] { 0x22 };
        /// <summary>Storage prefix for user stats.</summary>
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x23 };
        /// <summary>Storage prefix for user records.</summary>
        private static readonly byte[] PREFIX_USER_RECORDS = new byte[] { 0x24 };
        /// <summary>Storage prefix for user record count.</summary>
        private static readonly byte[] PREFIX_USER_RECORD_COUNT = new byte[] { 0x25 };
        /// <summary>Storage prefix for reports.</summary>
        private static readonly byte[] PREFIX_REPORTS = new byte[] { 0x26 };
        /// <summary>Storage prefix for total queries.</summary>
        private static readonly byte[] PREFIX_TOTAL_QUERIES = new byte[] { 0x27 };
        /// <summary>Storage prefix for total verified.</summary>
        private static readonly byte[] PREFIX_TOTAL_VERIFIED = new byte[] { 0x28 };
        /// <summary>Storage prefix for user badges.</summary>
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x29 };
        /// <summary>Storage prefix for total users.</summary>
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2A };
        /// <summary>Storage prefix for total reports.</summary>
        private static readonly byte[] PREFIX_TOTAL_REPORTS = new byte[] { 0x2B };
        #endregion

        #region Data Structures
        public struct RecordData
        {
            public UInt160 Creator;
            public ByteString DataHash;
            public BigInteger Rating;
            public BigInteger Category;
            public BigInteger QueryCount;
            public BigInteger CreateTime;
            public BigInteger UpdateTime;
            public bool Active;
            public bool Verified;
            public UInt160 Verifier;
            public BigInteger ReportCount;
        }

        public struct UserStats
        {
            public BigInteger RecordsCreated;
            public BigInteger RecordsVerified;
            public BigInteger QueriesMade;
            public BigInteger TotalSpent;
            public BigInteger ReputationScore;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger ReportsSubmitted;
            public BigInteger RecordsDeleted;
            public BigInteger RecordsUpdated;
            public BigInteger HighestRating;
            public BigInteger VerifiedRecordsOwned;
        }

        public struct ReportData
        {
            public BigInteger RecordId;
            public UInt160 Reporter;
            public string Reason;
            public BigInteger ReportTime;
            public bool Resolved;
        }
        #endregion

        #region App Events
        [DisplayName("RecordCreated")]
        public static event RecordCreatedHandler OnRecordCreated;

        [DisplayName("RecordQueried")]
        public static event RecordQueriedHandler OnRecordQueried;

        [DisplayName("RecordDeleted")]
        public static event RecordDeletedHandler OnRecordDeleted;

        [DisplayName("RecordUpdated")]
        public static event RecordUpdatedHandler OnRecordUpdated;

        [DisplayName("RecordVerified")]
        public static event RecordVerifiedHandler OnRecordVerified;

        [DisplayName("ReportSubmitted")]
        public static event ReportSubmittedHandler OnReportSubmitted;

        [DisplayName("UserBadgeEarned")]
        public static event UserBadgeEarnedHandler OnUserBadgeEarned;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_RECORD_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_QUERIES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VERIFIED, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REPORTS, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger TotalRecords() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_RECORD_ID);

        [Safe]
        public static BigInteger TotalQueries() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_QUERIES);

        [Safe]
        public static BigInteger TotalVerified() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_VERIFIED);

        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static BigInteger TotalReports() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REPORTS);

        [Safe]
        public static RecordData GetRecord(BigInteger recordId)
        {
            byte[] key = GetRecordKey(recordId);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_CREATOR));
            if (data == null) return new RecordData();

            RecordData record = new RecordData();
            record.Creator = GetUInt160(Helper.Concat(key, RECORD_FIELD_CREATOR));
            record.DataHash = GetByteString(Helper.Concat(key, RECORD_FIELD_DATA_HASH));
            record.Rating = GetBigInteger(Helper.Concat(key, RECORD_FIELD_RATING));
            record.Category = GetBigInteger(Helper.Concat(key, RECORD_FIELD_CATEGORY));
            record.QueryCount = GetBigInteger(Helper.Concat(key, RECORD_FIELD_QUERY_COUNT));
            record.CreateTime = GetBigInteger(Helper.Concat(key, RECORD_FIELD_CREATE_TIME));
            record.UpdateTime = GetBigInteger(Helper.Concat(key, RECORD_FIELD_UPDATE_TIME));
            record.Active = GetBool(Helper.Concat(key, RECORD_FIELD_ACTIVE));
            record.Verified = GetBool(Helper.Concat(key, RECORD_FIELD_VERIFIED));
            record.Verifier = GetUInt160(Helper.Concat(key, RECORD_FIELD_VERIFIER));
            record.ReportCount = GetBigInteger(Helper.Concat(key, RECORD_FIELD_REPORT_COUNT));
            return record;
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            byte[] key = GetUserStatsKey(user);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_CREATED));
            if (data == null) return new UserStats();

            UserStats stats = new UserStats();
            stats.RecordsCreated = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_CREATED));
            stats.RecordsVerified = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_VERIFIED));
            stats.QueriesMade = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_QUERIES_MADE));
            stats.TotalSpent = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_TOTAL_SPENT));
            stats.ReputationScore = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_REPUTATION));
            stats.BadgeCount = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_BADGE_COUNT));
            stats.JoinTime = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_JOIN_TIME));
            stats.LastActivityTime = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_LAST_ACTIVITY));
            stats.ReportsSubmitted = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_REPORTS_SUBMITTED));
            stats.RecordsDeleted = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_DELETED));
            stats.RecordsUpdated = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_UPDATED));
            stats.HighestRating = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_HIGHEST_RATING));
            stats.VerifiedRecordsOwned = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_VERIFIED_OWNED));
            return stats;
        }

        [Safe]
        public static BigInteger GetUserRecordCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_RECORD_COUNT, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static bool HasBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion
    }
}
