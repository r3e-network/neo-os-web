using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCompoundCapsule
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get all constants needed for frontend APY/yield calculations.
        /// Frontend can calculate everything locally without on-chain calls.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCalculationConstants()
        {
            Map<string, object> constants = new Map<string, object>();

            // APY tiers
            constants["tier1Days"] = TIER1_DAYS;
            constants["tier1ApyBps"] = TIER1_APY_BPS;
            constants["tier2Days"] = TIER2_DAYS;
            constants["tier2ApyBps"] = TIER2_APY_BPS;
            constants["tier3Days"] = TIER3_DAYS;
            constants["tier3ApyBps"] = TIER3_APY_BPS;
            constants["tier4Days"] = TIER4_DAYS;
            constants["tier4ApyBps"] = TIER4_APY_BPS;

            // Fees and limits
            constants["platformFeeBps"] = PLATFORM_FEE_BPS;
            constants["earlyWithdrawPenaltyBps"] = EARLY_WITHDRAW_PENALTY_BPS;
            constants["minDeposit"] = MIN_DEPOSIT;
            constants["minLockDays"] = MIN_LOCK_DAYS;
            constants["maxLockDays"] = MAX_LOCK_DAYS;

            // Time constants
            constants["yearSeconds"] = 365 * 86400;
            constants["currentTime"] = Runtime.Time;

            return constants;
        }

        /// <summary>
        /// Calculate expected yield for a capsule (for frontend verification).
        /// </summary>
        [Safe]
        public static BigInteger CalculateExpectedYield(
            BigInteger principal,
            BigInteger apyBps,
            BigInteger elapsedSeconds)
        {
            if (principal <= 0 || apyBps <= 0 || elapsedSeconds <= 0) return 0;
            BigInteger yearSeconds = 365 * 86400;
            return principal * apyBps * elapsedSeconds / (10000 * yearSeconds);
        }

        /// <summary>
        /// Calculate APY for given lock days (exposed for frontend).
        /// </summary>
        [Safe]
        public static BigInteger GetApyBpsForDays(BigInteger lockDays)
        {
            return GetApyForLockDays(lockDays);
        }

        /// <summary>
        /// Calculate early withdrawal penalty amount.
        /// </summary>
        [Safe]
        public static BigInteger CalculateEarlyPenalty(BigInteger principal)
        {
            return principal * EARLY_WITHDRAW_PENALTY_BPS / 10000;
        }

        /// <summary>
        /// Get full capsule state for frontend simulation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCapsuleStateForFrontend(BigInteger capsuleId)
        {
            Capsule c = GetCapsule(capsuleId);
            Map<string, object> state = new Map<string, object>();

            if (c.Owner == UInt160.Zero) return state;

            state["id"] = capsuleId;
            state["owner"] = c.Owner;
            state["principal"] = c.Principal;
            state["compound"] = c.Compound;
            state["createdTime"] = c.CreatedTime;
            state["unlockTime"] = c.UnlockTime;
            state["lastCompoundTime"] = c.LastCompoundTime;
            state["lockDays"] = c.LockDays;
            state["apyBps"] = c.ApyBps;
            state["active"] = c.Active;
            state["earlyWithdrawn"] = c.EarlyWithdrawn;
            state["currentTime"] = Runtime.Time;

            // Pre-calculated values for frontend
            if (c.Active)
            {
                BigInteger remaining = c.UnlockTime > Runtime.Time
                    ? c.UnlockTime - Runtime.Time : 0;
                state["remainingSeconds"] = remaining;
                state["canUnlock"] = Runtime.Time >= c.UnlockTime;

                // Calculate pending yield
                BigInteger elapsed = Runtime.Time - c.LastCompoundTime;
                BigInteger pendingYield = CalculateExpectedYield(
                    c.Principal, c.ApyBps, elapsed);
                state["pendingYield"] = pendingYield;
                state["totalProjected"] = c.Principal + c.Compound + pendingYield;

                // Early withdrawal info
                BigInteger penalty = CalculateEarlyPenalty(c.Principal);
                state["earlyPenalty"] = penalty;
                state["earlyPayout"] = c.Principal - penalty;
            }

            return state;
        }

        /// <summary>
        /// Unlock capsule with frontend-calculated payout.
        /// Frontend calculates yield, fee, payout; contract verifies.
        /// </summary>
        public static void UnlockCapsuleWithCalculation(
            BigInteger capsuleId,
            BigInteger calculatedYield,
            BigInteger calculatedFee,
            BigInteger calculatedPayout)
        {
            ValidateNotGloballyPaused(APP_ID);

            Capsule capsule = GetCapsule(capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time >= capsule.UnlockTime, "not yet unlocked");

            // Calculate expected yield
            BigInteger elapsed = Runtime.Time - capsule.LastCompoundTime;
            BigInteger expectedYield = CalculateExpectedYield(
                capsule.Principal, capsule.ApyBps, elapsed);
            BigInteger totalCompound = capsule.Compound + expectedYield;

            // Verify calculations
            ExecutionEngine.Assert(calculatedYield == totalCompound, "yield mismatch");

            BigInteger total = capsule.Principal + totalCompound;
            BigInteger expectedFee = total * PLATFORM_FEE_BPS / 10000;
            BigInteger expectedPayout = total - expectedFee;

            ExecutionEngine.Assert(calculatedFee == expectedFee, "fee mismatch");
            ExecutionEngine.Assert(calculatedPayout == expectedPayout, "payout mismatch");

            // Execute final state update
            capsule.Compound = totalCompound;
            capsule.Active = false;
            StoreCapsule(capsuleId, capsule);

            // Transfer assets
            NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, capsule.Principal);
            if (totalCompound > expectedFee)
            {
                GAS.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, totalCompound - expectedFee);
            }

            UpdateTotalLocked(capsule.Principal, false);
            UpdateUserStatsOnUnlock(capsule.Owner, capsule.Principal, totalCompound);

            OnCapsuleUnlocked(capsuleId, capsule.Owner, expectedPayout);
        }

        /// <summary>
        /// Early withdraw with frontend-calculated penalty.
        /// Frontend calculates penalty and payout; contract verifies.
        /// </summary>
        public static void EarlyWithdrawWithCalculation(
            BigInteger capsuleId,
            BigInteger calculatedPenalty,
            BigInteger calculatedPayout)
        {
            ValidateNotGloballyPaused(APP_ID);

            Capsule capsule = GetCapsule(capsuleId);
            ExecutionEngine.Assert(capsule.Active, "not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(capsule.Owner), "unauthorized");
            ExecutionEngine.Assert(Runtime.Time < capsule.UnlockTime, "use UnlockCapsule");

            // Verify calculations
            BigInteger expectedPenalty = capsule.Principal * EARLY_WITHDRAW_PENALTY_BPS / 10000;
            BigInteger expectedPayout = capsule.Principal - expectedPenalty;

            ExecutionEngine.Assert(calculatedPenalty == expectedPenalty, "penalty mismatch");
            ExecutionEngine.Assert(calculatedPayout == expectedPayout, "payout mismatch");

            // Execute final state update
            capsule.Active = false;
            capsule.EarlyWithdrawn = true;
            StoreCapsule(capsuleId, capsule);

            NEO.Transfer(Runtime.ExecutingScriptHash, capsule.Owner, expectedPayout);
            UpdateTotalLocked(capsule.Principal, false);
            UpdateUserStatsOnEarlyWithdraw(capsule.Owner, capsule.Principal, expectedPenalty);

            BigInteger totalPenalties = TotalPenalties();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PENALTIES, totalPenalties + expectedPenalty);

            OnEarlyWithdraw(capsuleId, capsule.Owner, expectedPenalty);
        }

        #endregion
    }
}
