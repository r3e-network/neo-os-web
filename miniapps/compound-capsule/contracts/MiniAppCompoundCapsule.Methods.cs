using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region User Methods

        /// <summary>
        /// Create a new savings capsule with NEO deposit.
        /// </summary>
        public static BigInteger CreateCapsule(UInt160 owner, BigInteger neoAmount, BigInteger lockDays)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(neoAmount >= MIN_DEPOSIT, "min 1 NEO");
            ExecutionEngine.Assert(lockDays >= MIN_LOCK_DAYS && lockDays <= MAX_LOCK_DAYS, "invalid lock period");
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");

            bool transferred = NEO.Transfer(owner, Runtime.ExecutingScriptHash, neoAmount);
            ExecutionEngine.Assert(transferred, "transfer failed");

            // Check if new user
            UserStats stats = GetUserStatsData(owner);
            bool isNewUser = stats.JoinTime == 0;

            BigInteger capsuleId = TotalCapsules() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_CAPSULE_ID, capsuleId);

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
            StoreCapsule(capsuleId, capsule);

            AddUserCapsule(owner, capsuleId);
            UpdateTotalLocked(neoAmount, true);
            UpdateUserStatsOnCreate(owner, neoAmount, lockDays, isNewUser);

            OnCapsuleCreated(capsuleId, owner, neoAmount, unlockTime);
            return capsuleId;
        }

        /// <summary>
        /// Unlock capsule after maturity and claim all funds.
        /// </summary>
        public static void UnlockCapsule(BigInteger capsuleId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Capsule capsule = GetCapsule(capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time >= capsule.UnlockTime, "not yet unlocked");

            // Calculate final compound
            CompoundCapsuleYield(capsuleId);
            capsule = GetCapsule(capsuleId);

            BigInteger total = capsule.Principal + capsule.Compound;
            BigInteger fee = total * PLATFORM_FEE_BPS / 10000;
            BigInteger payout = total - fee;

            capsule.Active = false;
            StoreCapsule(capsuleId, capsule);

            // Transfer NEO principal
            NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Principal);

            // Transfer GAS compound minus fee
            if (capsule.Compound > fee)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Compound - fee);
            }

            UpdateTotalLocked(capsule.Principal, false);
            UpdateUserStatsOnUnlock(capsule.Owner, capsule.Principal, capsule.Compound);

            OnCapsuleUnlocked(capsuleId, capsule.Owner, payout);
        }

        /// <summary>
        /// Early withdrawal with penalty.
        /// </summary>
        public static void EarlyWithdraw(BigInteger capsuleId)
        {
            ValidateNotGloballyPaused(APP_ID);

            Capsule capsule = GetCapsule(capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time < capsule.UnlockTime, "use UnlockCapsule");

            BigInteger penalty = capsule.Principal * EARLY_WITHDRAW_PENALTY_BPS / 10000;
            BigInteger payout = capsule.Principal - penalty;

            capsule.Active = false;
            capsule.EarlyWithdrawn = true;
            StoreCapsule(capsuleId, capsule);

            NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, payout);
            UpdateTotalLocked(capsule.Principal, false);
            UpdateUserStatsOnEarlyWithdraw(capsule.Owner, capsule.Principal, penalty);

            // Update global penalties
            BigInteger totalPenalties = TotalPenalties();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PENALTIES, totalPenalties + penalty);

            OnEarlyWithdraw(capsuleId, capsule.Owner, penalty);
        }

        /// <summary>
        /// Extend lock period for bonus APY.
        /// </summary>
        public static void ExtendLock(BigInteger capsuleId, BigInteger additionalDays)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(additionalDays >= 7, "min 7 days extension");

            Capsule capsule = GetCapsule(capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");

            BigInteger newLockDays = capsule.LockDays + additionalDays;
            ExecutionEngine.Assert(newLockDays <= MAX_LOCK_DAYS, "exceeds max lock");

            capsule.UnlockTime += additionalDays * 86400;
            capsule.LockDays = newLockDays;
            capsule.ApyBps = GetApyForLockDays(newLockDays);
            StoreCapsule(capsuleId, capsule);

            OnCapsuleExtended(capsuleId, capsule.UnlockTime);
        }

        #endregion
    }
}
