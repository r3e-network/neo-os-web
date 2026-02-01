using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin
    {
        #region Hybrid Mode - Frontend Calculation Support

        /// <summary>
        /// Get all data needed for frontend to calculate check-in results.
        /// Frontend calculates: newStreak, reward, streakReset, milestones
        /// </summary>
        [Safe]
        public static Map<string, object> GetCheckInStateForFrontend(UInt160 user)
        {
            Map<string, object> state = new Map<string, object>();

            // User state
            state["currentStreak"] = GetUserStreak(user);
            state["highestStreak"] = GetUserHighestStreak(user);
            state["lastCheckinDay"] = GetUserLastCheckin(user);
            state["unclaimed"] = GetUserUnclaimed(user);
            state["totalCheckins"] = GetUserCheckins(user);

            // Current time for frontend calculation
            BigInteger currentTime = Runtime.Time;
            state["currentTime"] = currentTime;
            state["currentDay"] = currentTime / TWENTY_FOUR_HOURS_SECONDS;

            // Constants for frontend calculation
            state["twentyFourHours"] = TWENTY_FOUR_HOURS_SECONDS;
            state["firstReward"] = FIRST_REWARD;
            state["subsequentReward"] = SUBSEQUENT_REWARD;
            state["milestone30Bonus"] = MILESTONE_30_BONUS;
            state["milestone100Bonus"] = MILESTONE_100_BONUS;
            state["milestone365Bonus"] = MILESTONE_365_BONUS;

            return state;
        }

        /// <summary>
        /// Check-in with frontend-calculated results.
        /// Frontend calculates newStreak, reward, streakReset based on GetCheckInStateForFrontend.
        /// Contract verifies calculations and updates state.
        /// </summary>
        public static void CheckInWithCalculation(
            UInt160 user,
            BigInteger receiptId,
            BigInteger calculatedNewStreak,
            BigInteger calculatedReward,
            bool calculatedStreakReset)
        {
            ValidateGateway();
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(user);
            ValidateAndUseReceipt(receiptId);

            BigInteger currentDay = Runtime.Time / TWENTY_FOUR_HOURS_SECONDS;
            BigInteger lastCheckinDay = GetUserLastCheckin(user);
            BigInteger currentStreak = GetUserStreak(user);
            BigInteger highestStreak = GetUserHighestStreak(user);

            bool isNewUser = lastCheckinDay == 0;

            // Verify streak calculation
            if (!isNewUser)
            {
                ExecutionEngine.Assert(currentDay > lastCheckinDay, "already checked in today");

                bool shouldReset = currentDay > lastCheckinDay + 1;
                ExecutionEngine.Assert(calculatedStreakReset == shouldReset, "streak reset mismatch");

                if (shouldReset)
                {
                    BigInteger expectedNewStreak = 1;
                    ExecutionEngine.Assert(calculatedNewStreak == expectedNewStreak, "new streak mismatch");
                }
                else
                {
                    BigInteger expectedNewStreak = currentStreak + 1;
                    ExecutionEngine.Assert(calculatedNewStreak == expectedNewStreak, "new streak mismatch");
                }
            }
            else
            {
                ExecutionEngine.Assert(calculatedNewStreak == 1, "new user streak must be 1");
                ExecutionEngine.Assert(!calculatedStreakReset, "new user cannot have streak reset");
            }

            // Verify reward calculation
            BigInteger expectedReward = CalculateRewardHybrid(calculatedNewStreak);
            ExecutionEngine.Assert(calculatedReward == expectedReward, "reward mismatch");

            // Execute state updates (final state only)
            if (calculatedStreakReset && currentStreak > highestStreak)
            {
                SetUserHighestStreak(user, currentStreak);
                IncrementUserResets(user);
                OnStreakReset(user, currentStreak, currentStreak);
            }

            if (calculatedReward > 0)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + calculatedReward);
            }

            SetUserStreak(user, calculatedNewStreak);
            SetUserLastCheckin(user, currentDay);

            BigInteger userCheckins = GetUserCheckins(user);
            SetUserCheckins(user, userCheckins + 1);

            if (calculatedNewStreak > highestStreak)
            {
                SetUserHighestStreak(user, calculatedNewStreak);
            }

            if (isNewUser)
            {
                IncrementTotalUsers();
                SetUserJoinTime(user, Runtime.Time);
            }
            IncrementTotalCheckins();

            BigInteger nextEligible = (currentDay + 1) * TWENTY_FOUR_HOURS_SECONDS;
            OnCheckedIn(user, calculatedNewStreak, calculatedReward, nextEligible);
        }

        /// <summary>
        /// Internal reward calculation for verification.
        /// Same logic as CalculateReward but exposed for hybrid mode.
        /// </summary>
        private static BigInteger CalculateRewardHybrid(BigInteger streak)
        {
            if (streak < 7) return 0;
            if (streak == 7) return FIRST_REWARD;
            if (streak % 7 == 0) return SUBSEQUENT_REWARD;
            return 0;
        }

        #endregion
    }
}
