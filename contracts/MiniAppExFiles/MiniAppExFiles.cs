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
    public delegate void RecordCreatedHandler(BigInteger recordId, UInt160 creator, ByteString dataHash, BigInteger category);
    public delegate void RecordQueriedHandler(BigInteger recordId, UInt160 querier, BigInteger queryType);
    public delegate void RecordDeletedHandler(BigInteger recordId, UInt160 owner);
    public delegate void RecordUpdatedHandler(BigInteger recordId, BigInteger newRating, string updateReason);
    public delegate void RecordVerifiedHandler(BigInteger recordId, UInt160 verifier, bool verified);
    public delegate void ReportSubmittedHandler(BigInteger recordId, UInt160 reporter, string reason);
    public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);

    [DisplayName("MiniAppExFiles")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "This is Neo R3E Network MiniApp. ExFiles is a complete anonymous relationship database with encrypted records, categories, verification, reporting, user badges, and TEE-protected privacy.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppExFiles : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-exfiles";
        private const long CREATE_FEE = 10000000;
        private const long QUERY_FEE = 5000000;
        private const long UPDATE_FEE = 5000000;
        private const long VERIFY_FEE = 20000000;
        private const long REPORT_FEE = 10000000;
        private const int MAX_REASON_LENGTH = 500;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_RECORD_ID = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_RECORDS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_HASH_INDEX = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_RECORDS = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_RECORD_COUNT = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_REPORTS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_QUERIES = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_VERIFIED = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x2A };
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

            return new RecordData
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
        }

        [Safe]
        public static UserStats GetUserStats(UInt160 user)
        {
            byte[] key = GetUserStatsKey(user);
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_CREATED));
            if (data == null) return new UserStats();

            return new UserStats
            {
                RecordsCreated = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_CREATED)),
                RecordsVerified = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_VERIFIED)),
                QueriesMade = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_QUERIES_MADE)),
                TotalSpent = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_TOTAL_SPENT)),
                ReputationScore = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_REPUTATION)),
                BadgeCount = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_BADGE_COUNT)),
                JoinTime = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_JOIN_TIME)),
                LastActivityTime = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_LAST_ACTIVITY)),
                ReportsSubmitted = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_REPORTS_SUBMITTED)),
                RecordsDeleted = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_DELETED)),
                RecordsUpdated = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_RECORDS_UPDATED)),
                HighestRating = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_HIGHEST_RATING)),
                VerifiedRecordsOwned = GetBigInteger(Helper.Concat(key, USER_STATS_FIELD_VERIFIED_OWNED))
            };
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
