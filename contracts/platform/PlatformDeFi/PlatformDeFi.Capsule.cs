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

            // Runtime.Time is in MILLISECONDS, so `elapsed` is also in ms. Use
            // year-in-ms (365 * 86_400_000) for the denominator. Previously used
            // year-in-seconds, making the computed yield 1000x too small.
            // Precision-safe: multiply before dividing to preserve precision.
            BigInteger yearMs = 365L * 86400000L;
            BigInteger numerator = capsule.Principal * capsule.ApyBps * elapsed;
            BigInteger denominator = 10000 * yearMs;
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
        ///
        /// Audit fix M-8: takes an explicit <paramref name="principalAmount"/>.
        /// The prior version swept the owner's entire NEO credit balance into
        /// the capsule, so an owner pre-depositing 10 NEO planning three smaller
        /// capsules and a refund would silently lock all 10 NEO in the first one.
        /// </summary>
        public static BigInteger CreateCapsule(string appId, UInt160 owner, BigInteger lockDays, BigInteger principalAmount)
        {
            ValidateApp(appId, ProductType_Capsule);
            ValidateAddress(owner);
            ExecutionEngine.Assert(Runtime.CheckWitness(owner), "unauthorized");
            ExecutionEngine.Assert(lockDays >= CAPSULE_MIN_LOCK_DAYS && lockDays <= CAPSULE_MAX_LOCK_DAYS,
                "invalid lock period (7-365 days)");
            ExecutionEngine.Assert(principalAmount >= CAPSULE_MIN_DEPOSIT, "min 1 NEO deposit");

            // Consume only the requested principalAmount; refund the rest back to
            // the user's credit ledger so they can withdraw it via WithdrawCredit.
            StorageMap neoCredits = new StorageMap(Storage.CurrentContext, PREFIX_NEO_CREDIT);
            ByteString creditKey = (ByteString)(byte[])owner;
            ByteString creditData = neoCredits.Get(creditKey);
            BigInteger availableCredit = creditData == null ? 0 : (BigInteger)creditData;
            ExecutionEngine.Assert(availableCredit >= principalAmount, "insufficient NEO credit");

            BigInteger neoAmount = principalAmount;
            BigInteger remainingCredit = availableCredit - principalAmount;
            if (remainingCredit == 0) neoCredits.Delete(creditKey);
            else neoCredits.Put(creditKey, remainingCredit);

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
            // Runtime.Time is in MILLISECONDS on Neo N3; convert lockDays to ms so
            // a "7-day capsule" actually locks for 7 days (previously: 7*86400 ms = ~10
            // minutes). 86_400_000 ms per day.
            BigInteger unlockTime = Runtime.Time + (lockDays * 86400000);

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

        /// <summary>
        /// Sweep accumulated early-withdrawal penalties to a designated recipient.
        /// Gated by ValidateAppAuthority — platform admin or the app's own admin.
        /// Without this hook, penalty NEO sits idle in the contract forever even
        /// though PREFIX_TOTAL_PENALTIES correctly tracks the running total.
        /// Withdrawal resets the counter so subsequent sweeps only see new penalties.
        /// </summary>
        public static void WithdrawCapsulePenalties(string appId, UInt160 to)
        {
            ValidateAppAuthority(appId);
            ValidateAddress(to);

            ByteString totalPenaltiesKey = AppKey(appId, PREFIX_TOTAL_PENALTIES);
            BigInteger amount = GetBigInteger(totalPenaltiesKey);
            ExecutionEngine.Assert(amount > 0, "no penalties to withdraw");

            // Reset the counter BEFORE the transfer so a malicious NEO contract
            // cannot re-enter and drain the counter twice (checks-effects-interactions).
            Put(totalPenaltiesKey, 0);

            ExecutionEngine.Assert(
                NEO.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "penalty withdrawal transfer failed");

            OnCapsulePenaltiesWithdrawn(appId, to, amount);
        }

        #endregion

        // Audit fix M-8 / partial-file-budget: capsule read methods (GetCapsule,
        // GetCapsuleStats, GetCapsuleDetails) moved to PlatformDeFi.Capsule.Query.cs
        // to keep this partial under 300 lines for security review.
    }
}
