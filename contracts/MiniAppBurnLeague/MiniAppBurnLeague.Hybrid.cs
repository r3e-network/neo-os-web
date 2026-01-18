using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppBurnLeague
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get all data needed for frontend to calculate burn results.
        /// Frontend calculates: points, streakBonus, newStreak
        /// </summary>
        [Safe]
        public static Map<string, object> GetBurnStateForFrontend(UInt160 user)
        {
            Map<string, object> state = new Map<string, object>();

            // User streak state
            UserStreak streak = GetUserStreak(user);
            state["currentStreak"] = streak.CurrentStreak;
            state["longestStreak"] = streak.LongestStreak;
            state["lastBurnTime"] = streak.LastBurnTime;

            // Burner stats
            BurnerStats stats = GetBurnerStats(user);
            state["isNewBurner"] = stats.JoinTime == 0;
            state["totalBurned"] = stats.TotalBurned;

            // Season state
            BigInteger seasonId = CurrentSeasonId();
            state["seasonId"] = seasonId;
            Season season = GetSeason(seasonId);
            state["seasonActive"] = season.Active;

            // Current time
            state["currentTime"] = Runtime.Time;

            // Constants for frontend calculation
            state["minBurn"] = MIN_BURN;
            state["tier1Threshold"] = TIER1_THRESHOLD;
            state["tier2Threshold"] = TIER2_THRESHOLD;
            state["tier3Threshold"] = TIER3_THRESHOLD;
            state["streakWindowSeconds"] = STREAK_WINDOW_SECONDS;
            state["maxStreakBonus"] = 10;

            return state;
        }

        /// <summary>
        /// Burn GAS with frontend-calculated results.
        /// Frontend calculates points and streak, contract verifies.
        /// </summary>
        public static void BurnGasWithCalculation(
            UInt160 burner,
            BigInteger amount,
            BigInteger receiptId,
            BigInteger calculatedPoints,
            BigInteger calculatedNewStreak,
            bool calculatedStreakContinued)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(amount >= MIN_BURN, "min 0.1 GAS");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(burner), "unauthorized");

            ValidatePaymentReceipt(APP_ID, burner, amount, receiptId);

            BigInteger seasonId = CurrentSeasonId();
            ExecutionEngine.Assert(seasonId > 0, "no active season");

            Season season = GetSeason(seasonId);
            ExecutionEngine.Assert(season.Active, "season not active");

            // Verify calculations
            VerifyAndExecuteBurn(burner, amount, seasonId, season,
                calculatedPoints, calculatedNewStreak, calculatedStreakContinued);
        }

        private static void VerifyAndExecuteBurn(
            UInt160 burner, BigInteger amount, BigInteger seasonId, Season season,
            BigInteger calculatedPoints, BigInteger calculatedNewStreak, bool calculatedStreakContinued)
        {
            // Verify points calculation
            BigInteger expectedBasePoints = CalculatePointsHybrid(amount);

            // Verify streak calculation
            UserStreak streak = GetUserStreak(burner);
            BigInteger now = Runtime.Time;
            bool shouldContinue = streak.LastBurnTime > 0 &&
                now <= streak.LastBurnTime + STREAK_WINDOW_SECONDS;

            ExecutionEngine.Assert(calculatedStreakContinued == shouldContinue, "streak mismatch");

            BigInteger expectedNewStreak;
            BigInteger expectedPoints;

            if (shouldContinue)
            {
                expectedNewStreak = streak.CurrentStreak + 1;
                BigInteger bonus = expectedNewStreak > 10 ? 10 : expectedNewStreak;
                expectedPoints = expectedBasePoints * (100 + bonus) / 100;
            }
            else
            {
                expectedNewStreak = 1;
                expectedPoints = expectedBasePoints;
            }

            ExecutionEngine.Assert(calculatedNewStreak == expectedNewStreak, "streak value mismatch");
            ExecutionEngine.Assert(calculatedPoints == expectedPoints, "points mismatch");

            // Execute final state updates
            ExecuteBurnStateUpdates(burner, amount, seasonId, season, streak,
                expectedNewStreak, expectedPoints, shouldContinue, now);
        }

        private static void ExecuteBurnStateUpdates(
            UInt160 burner, BigInteger amount, BigInteger seasonId, Season season,
            UserStreak streak, BigInteger newStreak, BigInteger points, bool continued, BigInteger now)
        {
            BurnerStats stats = GetBurnerStats(burner);
            bool isNewBurner = stats.JoinTime == 0;
            bool isTier3 = amount >= TIER3_THRESHOLD;

            // Update streak
            streak.CurrentStreak = newStreak;
            if (newStreak > streak.LongestStreak)
                streak.LongestStreak = newStreak;
            streak.LastBurnTime = now;
            StoreUserStreak(burner, streak);

            if (continued)
            {
                BigInteger bonus = newStreak > 10 ? 10 : newStreak;
                OnStreakBonus(burner, newStreak, 100 + bonus);
            }

            UpdateUserSeasonData(burner, seasonId, amount, points);

            BigInteger totalBurned = TotalBurned();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BURNED, totalBurned + amount);

            season.TotalBurned += amount;
            StoreSeason(seasonId, season);

            UpdateBurnerStats(burner, amount, points, isNewBurner, isTier3);

            OnGasBurned(burner, amount, seasonId);
        }

        private static BigInteger CalculatePointsHybrid(BigInteger amount)
        {
            if (amount >= TIER3_THRESHOLD) return amount * 2;
            if (amount >= TIER2_THRESHOLD) return amount * 15 / 10;
            return amount;
        }

        #endregion
    }
}
