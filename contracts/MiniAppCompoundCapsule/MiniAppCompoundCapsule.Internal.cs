using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region Internal Helpers

        private static readonly byte[] CAPSULE_FIELD_OWNER = new byte[] { 0x01 };
        private static readonly byte[] CAPSULE_FIELD_PRINCIPAL = new byte[] { 0x02 };
        private static readonly byte[] CAPSULE_FIELD_COMPOUND = new byte[] { 0x03 };
        private static readonly byte[] CAPSULE_FIELD_CREATED_TIME = new byte[] { 0x04 };
        private static readonly byte[] CAPSULE_FIELD_UNLOCK_TIME = new byte[] { 0x05 };
        private static readonly byte[] CAPSULE_FIELD_LAST_COMPOUND = new byte[] { 0x06 };
        private static readonly byte[] CAPSULE_FIELD_LOCK_DAYS = new byte[] { 0x07 };
        private static readonly byte[] CAPSULE_FIELD_APY_BPS = new byte[] { 0x08 };
        private static readonly byte[] CAPSULE_FIELD_ACTIVE = new byte[] { 0x09 };
        private static readonly byte[] CAPSULE_FIELD_EARLY_WITHDRAWN = new byte[] { 0x0A };

        private static readonly byte[] USER_STATS_FIELD_TOTAL_CAPSULES = new byte[] { 0x01 };
        private static readonly byte[] USER_STATS_FIELD_ACTIVE_CAPSULES = new byte[] { 0x02 };
        private static readonly byte[] USER_STATS_FIELD_TOTAL_DEPOSITED = new byte[] { 0x03 };
        private static readonly byte[] USER_STATS_FIELD_TOTAL_WITHDRAWN = new byte[] { 0x04 };
        private static readonly byte[] USER_STATS_FIELD_TOTAL_EARNED = new byte[] { 0x05 };
        private static readonly byte[] USER_STATS_FIELD_TOTAL_PENALTIES = new byte[] { 0x06 };
        private static readonly byte[] USER_STATS_FIELD_HIGHEST_DEPOSIT = new byte[] { 0x07 };
        private static readonly byte[] USER_STATS_FIELD_LONGEST_LOCK = new byte[] { 0x08 };
        private static readonly byte[] USER_STATS_FIELD_BADGE_COUNT = new byte[] { 0x09 };
        private static readonly byte[] USER_STATS_FIELD_JOIN_TIME = new byte[] { 0x0A };
        private static readonly byte[] USER_STATS_FIELD_LAST_ACTIVITY = new byte[] { 0x0B };

        private static byte[] GetCapsuleKey(BigInteger capsuleId) =>
            Helper.Concat(PREFIX_CAPSULES, (ByteString)capsuleId.ToByteArray());

        private static byte[] GetUserStatsKey(UInt160 user) =>
            Helper.Concat(PREFIX_USER_STATS, user);

        private static BigInteger GetBigInteger(byte[] key, byte[] field)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, field));
            return data == null ? 0 : (BigInteger)data;
        }

        private static UInt160 GetUInt160(byte[] key, byte[] field)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(key, field));
            return data == null ? UInt160.Zero : (UInt160)data;
        }

        private static bool GetBool(byte[] key, byte[] field) =>
            GetBigInteger(key, field) == 1;

        private static void PutBool(byte[] key, byte[] field, bool value) =>
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, field), value ? 1 : 0);

        private static void StoreCapsule(BigInteger capsuleId, Capsule capsule)
        {
            byte[] key = GetCapsuleKey(capsuleId);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_OWNER), capsule.Owner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_PRINCIPAL), capsule.Principal);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_COMPOUND), capsule.Compound);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_CREATED_TIME), capsule.CreatedTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_UNLOCK_TIME), capsule.UnlockTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_LAST_COMPOUND), capsule.LastCompoundTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_LOCK_DAYS), capsule.LockDays);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, CAPSULE_FIELD_APY_BPS), capsule.ApyBps);
            PutBool(key, CAPSULE_FIELD_ACTIVE, capsule.Active);
            PutBool(key, CAPSULE_FIELD_EARLY_WITHDRAWN, capsule.EarlyWithdrawn);
        }

        private static BigInteger GetApyForLockDays(BigInteger days)
        {
            if (days >= TIER4_DAYS) return TIER4_APY_BPS;
            if (days >= TIER3_DAYS) return TIER3_APY_BPS;
            if (days >= TIER2_DAYS) return TIER2_APY_BPS;
            return TIER1_APY_BPS;
        }

        private static void AddUserCapsule(UInt160 user, BigInteger capsuleId)
        {
            byte[] countKey = Helper.Concat(PREFIX_USER_CAPSULE_COUNT, user);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_CAPSULES, user),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, capsuleId);
        }

        private static void UpdateTotalLocked(BigInteger amount, bool isDeposit)
        {
            BigInteger total = TotalLocked();
            if (isDeposit)
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, total + amount);
            else
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_LOCKED, total - amount);
        }

        private static void UpdateUserEarned(UInt160 user, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_USER_TOTAL_EARNED, user);
            BigInteger earned = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, earned + amount);
        }

        private static void CompoundCapsuleYield(BigInteger capsuleId)
        {
            Capsule capsule = GetCapsule(capsuleId);
            if (!capsule.Active) return;

            BigInteger elapsed = Runtime.Time - capsule.LastCompoundTime;
            if (elapsed <= 0) return;

            // Calculate yield: principal * APY * elapsed / year
            BigInteger yearSeconds = 365 * 86400;
            BigInteger yieldAmount = capsule.Principal * capsule.ApyBps * elapsed / (10000 * yearSeconds);

            if (yieldAmount > 0)
            {
                capsule.Compound += yieldAmount;
                capsule.LastCompoundTime = Runtime.Time;
                StoreCapsule(capsuleId, capsule);

                BigInteger totalCompound = TotalCompound();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_COMPOUND, totalCompound + yieldAmount);

                OnCompoundAdded(capsuleId, yieldAmount, capsule.Compound);
            }
        }

        private static void StoreUserStats(UInt160 user, UserStats stats)
        {
            byte[] key = GetUserStatsKey(user);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_CAPSULES), stats.TotalCapsules);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_ACTIVE_CAPSULES), stats.ActiveCapsules);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_DEPOSITED), stats.TotalDeposited);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_WITHDRAWN), stats.TotalWithdrawn);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_EARNED), stats.TotalEarned);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_TOTAL_PENALTIES), stats.TotalPenalties);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_HIGHEST_DEPOSIT), stats.HighestDeposit);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_LONGEST_LOCK), stats.LongestLock);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_BADGE_COUNT), stats.BadgeCount);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_JOIN_TIME), stats.JoinTime);
            Storage.Put(Storage.CurrentContext, Helper.Concat(key, USER_STATS_FIELD_LAST_ACTIVITY), stats.LastActivityTime);
        }

        #endregion
    }
}
