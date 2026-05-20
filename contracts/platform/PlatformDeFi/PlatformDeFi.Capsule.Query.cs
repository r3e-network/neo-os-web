using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    // Audit fix M-8 / partial-file-budget: capsule read methods extracted from
    // PlatformDeFi.Capsule.cs to keep that partial under 300 lines (enforced by
    // ContractProjectConventionsTest.ContractPartialFilesStayReviewable).
    public partial class PlatformDeFiContract
    {
        [Safe]
        public static Capsule GetCapsule(string appId, BigInteger capsuleId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, PREFIX_CAPSULES, capsuleId));
            if (data == null) return new Capsule();
            return (Capsule)StdLib.Deserialize(data);
        }

        [Safe]
        public static Map<string, object> GetCapsuleStats(string appId)
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalCapsules"] = GetBigInteger(AppKey(appId, PREFIX_CAPSULE_ID));
            stats["totalLocked"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_LOCKED));
            stats["totalCompound"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_COMPOUND));
            stats["totalUsers"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_CAPSULE_USERS));
            stats["totalWithdrawn"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_WITHDRAWN));
            stats["totalPenalties"] = GetBigInteger(AppKey(appId, PREFIX_TOTAL_PENALTIES));
            stats["capsuleFeeBps"] = CAPSULE_FEE_BPS;
            stats["earlyPenaltyBps"] = CAPSULE_EARLY_PENALTY_BPS;
            stats["minDeposit"] = CAPSULE_MIN_DEPOSIT;
            stats["minLockDays"] = CAPSULE_MIN_LOCK_DAYS;
            stats["maxLockDays"] = CAPSULE_MAX_LOCK_DAYS;
            stats["tier1Days"] = TIER1_DAYS;
            stats["tier1ApyBps"] = TIER1_APY_BPS;
            stats["tier2Days"] = TIER2_DAYS;
            stats["tier2ApyBps"] = TIER2_APY_BPS;
            stats["tier3Days"] = TIER3_DAYS;
            stats["tier3ApyBps"] = TIER3_APY_BPS;
            stats["tier4Days"] = TIER4_DAYS;
            stats["tier4ApyBps"] = TIER4_APY_BPS;
            return stats;
        }

        [Safe]
        public static Map<string, object> GetCapsuleDetails(string appId, BigInteger capsuleId)
        {
            Capsule c = GetCapsule(appId, capsuleId);
            Map<string, object> details = new Map<string, object>();
            if (c.Owner == UInt160.Zero) return details;

            details["id"] = capsuleId;
            details["owner"] = c.Owner;
            details["principal"] = c.Principal;
            details["compound"] = c.Compound;
            details["createdTime"] = c.CreatedTime;
            details["unlockTime"] = c.UnlockTime;
            details["lockDays"] = c.LockDays;
            details["apyBps"] = c.ApyBps;
            details["active"] = c.Active;
            details["earlyWithdrawn"] = c.EarlyWithdrawn;

            if (c.Active)
            {
                BigInteger remaining = c.UnlockTime - Runtime.Time;
                details["remainingTime"] = remaining > 0 ? remaining : 0;
                details["canUnlock"] = Runtime.Time >= c.UnlockTime;
            }
            return details;
        }
    }
}
