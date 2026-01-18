using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Internal Helpers
        private static readonly byte[] RECORD_FIELD_CREATOR = new byte[] { 0x01 };
        private static readonly byte[] RECORD_FIELD_DATA_HASH = new byte[] { 0x02 };
        private static readonly byte[] RECORD_FIELD_RATING = new byte[] { 0x03 };
        private static readonly byte[] RECORD_FIELD_CATEGORY = new byte[] { 0x04 };
        private static readonly byte[] RECORD_FIELD_QUERY_COUNT = new byte[] { 0x05 };
        private static readonly byte[] RECORD_FIELD_CREATE_TIME = new byte[] { 0x06 };
        private static readonly byte[] RECORD_FIELD_UPDATE_TIME = new byte[] { 0x07 };
        private static readonly byte[] RECORD_FIELD_ACTIVE = new byte[] { 0x08 };
        private static readonly byte[] RECORD_FIELD_VERIFIED = new byte[] { 0x09 };
        private static readonly byte[] RECORD_FIELD_VERIFIER = new byte[] { 0x0A };
        private static readonly byte[] RECORD_FIELD_REPORT_COUNT = new byte[] { 0x0B };

        private static readonly byte[] USER_STATS_FIELD_RECORDS_CREATED = new byte[] { 0x01 };
        private static readonly byte[] USER_STATS_FIELD_RECORDS_VERIFIED = new byte[] { 0x02 };
        private static readonly byte[] USER_STATS_FIELD_QUERIES_MADE = new byte[] { 0x03 };
        private static readonly byte[] USER_STATS_FIELD_TOTAL_SPENT = new byte[] { 0x04 };
        private static readonly byte[] USER_STATS_FIELD_REPUTATION = new byte[] { 0x05 };
        private static readonly byte[] USER_STATS_FIELD_BADGE_COUNT = new byte[] { 0x06 };
        private static readonly byte[] USER_STATS_FIELD_JOIN_TIME = new byte[] { 0x07 };
        private static readonly byte[] USER_STATS_FIELD_LAST_ACTIVITY = new byte[] { 0x08 };
        private static readonly byte[] USER_STATS_FIELD_REPORTS_SUBMITTED = new byte[] { 0x09 };
        private static readonly byte[] USER_STATS_FIELD_RECORDS_DELETED = new byte[] { 0x0A };
        private static readonly byte[] USER_STATS_FIELD_RECORDS_UPDATED = new byte[] { 0x0B };
        private static readonly byte[] USER_STATS_FIELD_HIGHEST_RATING = new byte[] { 0x0C };
        private static readonly byte[] USER_STATS_FIELD_VERIFIED_OWNED = new byte[] { 0x0D };

        private static byte[] GetRecordKey(BigInteger recordId) =>
            Helper.Concat(PREFIX_RECORDS, (ByteString)recordId.ToByteArray());

        private static byte[] GetUserStatsKey(UInt160 user) =>
            Helper.Concat(PREFIX_USER_STATS, user);

        private static BigInteger GetBigInteger(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        private static UInt160 GetUInt160(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        private static ByteString GetByteString(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? (ByteString)new byte[0] : data;
        }

        private static bool GetBool(byte[] key)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data != null && (BigInteger)data != 0;
        }

        private static void PutBool(byte[] key, bool value)
        {
            Storage.Put(Storage.CurrentContext, key, value ? 1 : 0);
        }

        private static void StoreRecord(BigInteger recordId, RecordData record)
        {
            byte[] key = GetRecordKey(recordId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_CREATOR), record.Creator);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_DATA_HASH), record.DataHash);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_RATING), record.Rating);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_CATEGORY), record.Category);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_QUERY_COUNT), record.QueryCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_CREATE_TIME), record.CreateTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_UPDATE_TIME), record.UpdateTime);
            PutBool(Helper.Concat(key, RECORD_FIELD_ACTIVE), record.Active);
            PutBool(Helper.Concat(key, RECORD_FIELD_VERIFIED), record.Verified);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_VERIFIER), record.Verifier);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, RECORD_FIELD_REPORT_COUNT), record.ReportCount);
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            byte[] key = GetUserStatsKey(user);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_CREATED), stats.RecordsCreated);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_VERIFIED), stats.RecordsVerified);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_QUERIES_MADE), stats.QueriesMade);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_SPENT), stats.TotalSpent);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_REPUTATION), stats.ReputationScore);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_BADGE_COUNT), stats.BadgeCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_JOIN_TIME), stats.JoinTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_LAST_ACTIVITY), stats.LastActivityTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_REPORTS_SUBMITTED), stats.ReportsSubmitted);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_DELETED), stats.RecordsDeleted);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_RECORDS_UPDATED), stats.RecordsUpdated);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_HIGHEST_RATING), stats.HighestRating);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_VERIFIED_OWNED), stats.VerifiedRecordsOwned);
        }

        private static void AddUserRecord(UInt160 user, BigInteger recordId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_RECORD_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_RECORDS, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, recordId);
        }

        #endregion
    }
}
