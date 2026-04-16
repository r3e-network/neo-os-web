using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Platform
{
    public partial class PlatformDeFiContract
    {
        #region Capsule Internal Helpers

        private static void StoreCapsule(string appId, BigInteger capsuleId, Capsule capsule)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, PREFIX_CAPSULES, capsuleId),
                StdLib.Serialize(capsule));
        }

        private static BigInteger GetApyForLockDays(BigInteger days)
        {
            if (days >= TIER4_DAYS) return TIER4_APY_BPS;
            if (days >= TIER3_DAYS) return TIER3_APY_BPS;
            if (days >= TIER2_DAYS) return TIER2_APY_BPS;
            return TIER1_APY_BPS;
        }

        private static void AddUserCapsule(string appId, UInt160 user, BigInteger capsuleId)
        {
            ByteString countKey = AppKey(appId, PREFIX_USER_CAPSULE_COUNT, user);
            BigInteger count = GetBigInteger(countKey);
            Put(countKey, count + 1);

            ByteString key = AppKey(appId, PREFIX_USER_CAPSULES, count, user);
            Put(key, capsuleId);
        }

        private static void UpdateTotalLocked(string appId, BigInteger amount, bool isDeposit)
        {
            ByteString key = AppKey(appId, PREFIX_TOTAL_LOCKED);
            BigInteger total = GetBigInteger(key);
            Put(key, isDeposit ? total + amount : total - amount);
        }

        /// <summary>
        /// Calculate compound yield using precision-safe integer math.
        /// Formula: (principal * apyBps * elapsed) / (10000 * yearSeconds)
        /// Numerator is computed first to avoid truncation for small intervals.
        /// </summary>
        private static void CompoundCapsuleYield(string appId, BigInteger capsuleId)
        {
            Capsule capsule = GetCapsule(appId, capsuleId);
            if (!capsule.Active) return;

            BigInteger elapsed = Runtime.Time - capsule.LastCompoundTime;
            if (elapsed <= 0) return;

            // Precision-safe: multiply before dividing to preserve precision
            BigInteger yearSeconds = 365 * 86400;
            BigInteger numerator = capsule.Principal * capsule.ApyBps * elapsed;
            BigInteger denominator = 10000 * yearSeconds;
            BigInteger yieldAmount = numerator / denominator;

            if (yieldAmount > 0)
            {
                capsule.Compound += yieldAmount;
                capsule.LastCompoundTime = Runtime.Time;
                StoreCapsule(appId, capsuleId, capsule);

                ByteString totalCompoundKey = AppKey(appId, PREFIX_TOTAL_COMPOUND);
                Put(totalCompoundKey, GetBigInteger(totalCompoundKey) + yieldAmount);

                OnCompoundAdded(appId, capsuleId, yieldAmount, capsule.Compound);
            }
        }

        #endregion

        #region Capsule Methods

        /// <summary>
        /// Create a savings capsule with NEO deposit.
        /// Caller must have pre-deposited NEO via OnNEP17Payment.
        /// </summary>
        public static BigInteger CreateCapsule(string appId, UInt160 owner, BigInteger lockDays)
        {
            ValidateApp(appId, ProductType_Capsule);
            ValidateAddress(owner);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");
            ExecutionEngine.Assert(lockDays >= CAPSULE_MIN_LOCK_DAYS && lockDays <= CAPSULE_MAX_LOCK_DAYS,
                "invalid lock period (7-365 days)");

            // Consume all prepaid NEO credit
            StorageMap neoCredits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString creditKey = (ByteString)(byte[])owner;
            ByteString creditData = neoCredits.Get(creditKey);
            BigInteger neoAmount = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(neoAmount >= CAPSULE_MIN_DEPOSIT, "min 1 NEO deposit");
            neoCredits.Delete(creditKey);

            // Track unique users
            ByteString userCountKey = AppKey(appId, PREFIX_USER_CAPSULE_COUNT, owner);
            if (GetBigInteger(userCountKey) == 0)
            {
                ByteString totalUsersKey = AppKey(appId, PREFIX_TOTAL_CAPSULE_USERS);
                Put(totalUsersKey, GetBigInteger(totalUsersKey) + 1);
            }

            // Increment capsule ID
            ByteString idKey = AppKey(appId, PREFIX_CAPSULE_ID);
            BigInteger capsuleId = GetBigInteger(idKey) + 1;
            Put(idKey, capsuleId);

            BigInteger apyBps = GetApyForLockDays(lockDays);
            BigInteger unlockTime = Runtime.Time + (lockDays * 86400);

            Capsule capsule = new Capsule
            {
                Owner = owner,
                Principal = neoAmount,
                Compound = 0,
                CreatedTime = Runtime.Time,
                UnlockTime = unlockTime,
                LastCompoundTime = Runtime.Time,
                LockDays = lockDays,
                ApyBps = apyBps,
                Active = true,
                EarlyWithdrawn = false
            };
            StoreCapsule(appId, capsuleId, capsule);
            AddUserCapsule(appId, owner, capsuleId);
            UpdateTotalLocked(appId, neoAmount, true);

            OnCapsuleCreated(appId, capsuleId, owner, neoAmount, unlockTime);
            return capsuleId;
        }

        /// <summary>
        /// Unlock capsule after maturity and claim all funds.
        /// Final compound yield is calculated at unlock time.
        /// </summary>
        public static void UnlockCapsule(string appId, BigInteger capsuleId)
        {
            ValidateApp(appId, ProductType_Capsule);

            Capsule capsule = GetCapsule(appId, capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time >= capsule.UnlockTime, "not yet unlocked");

            // Calculate final compound yield
            CompoundCapsuleYield(appId, capsuleId);
            capsule = GetCapsule(appId, capsuleId);

            BigInteger total = capsule.Principal + capsule.Compound;
            BigInteger fee = total * CAPSULE_FEE_BPS / 10000;
            BigInteger payout = total - fee;

            capsule.Active = false;
            StoreCapsule(appId, capsuleId, capsule);

            // Return NEO principal
            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Principal),
                "principal transfer failed");

            // Transfer GAS compound minus fee
            if (capsule.Compound > fee)
            {
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Compound - fee),
                    "compound transfer failed");
            }

            UpdateTotalLocked(appId, capsule.Principal, false);

            // Update global withdrawn counter
            ByteString totalWithdrawnKey = AppKey(appId, PREFIX_TOTAL_WITHDRAWN);
            Put(totalWithdrawnKey, GetBigInteger(totalWithdrawnKey) + capsule.Principal);

            OnCapsuleUnlocked(appId, capsuleId, capsule.Owner, payout);
        }

        /// <summary>
        /// Early withdrawal with penalty. Forfeits all compound yield.
        /// </summary>
        public static void EarlyWithdraw(string appId, BigInteger capsuleId)
        {
            ValidateApp(appId, ProductType_Capsule);

            Capsule capsule = GetCapsule(appId, capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time < capsule.UnlockTime, "use UnlockCapsule instead");

            BigInteger penalty = capsule.Principal * CAPSULE_EARLY_PENALTY_BPS / 10000;
            BigInteger payout = capsule.Principal - penalty;

            capsule.Active = false;
            capsule.EarlyWithdrawn = true;
            StoreCapsule(appId, capsuleId, capsule);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, payout),
                "early withdrawal transfer failed");

            UpdateTotalLocked(appId, capsule.Principal, false);

            // Update global penalties counter
            ByteString totalPenaltiesKey = AppKey(appId, PREFIX_TOTAL_PENALTIES);
            Put(totalPenaltiesKey, GetBigInteger(totalPenaltiesKey) + penalty);

            OnEarlyWithdraw(appId, capsuleId, capsule.Owner, penalty);
        }

        /// <summary>
        /// Trigger compound yield calculation for a capsule.
        /// Can be called by anyone to accrue interest.
        /// Uses precision-safe integer math: numerator first, then divide.
        /// </summary>
        public static void CompoundYield(string appId, BigInteger capsuleId)
        {
            ValidateApp(appId, ProductType_Capsule);
            CompoundCapsuleYield(appId, capsuleId);
        }

        #endregion

        #region Capsule Read Methods

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

        #endregion
    }
}
