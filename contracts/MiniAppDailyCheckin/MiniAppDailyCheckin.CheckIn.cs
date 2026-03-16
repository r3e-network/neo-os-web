using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Check-in Logic

        public static void CheckIn(UInt160 user, BigInteger receiptId)
        {
            ValidateUserOrAbstractAccount(user);
            ValidateNotPaused();
            ValidateAddress(user);
            ConsumeDirectGasCredit(user, CHECK_IN_FEE);
            ProcessCheckIn(user);
        }

        private static void ProcessCheckIn(UInt160 user)
        {
            BigInteger currentDay = Runtime.Time / TWENTY_FOUR_HOURS_SECONDS;
            BigInteger lastCheckinDay = GetUserLastCheckin(user);
            BigInteger currentStreak = GetUserStreak(user);
            BigInteger highestStreak = GetUserHighestStreak(user);
            BigInteger userCheckins = GetUserCheckins(user);

            bool isNewUser = lastCheckinDay == 0;

            if (!isNewUser)
            {
                ExecutionEngine.Assert(currentDay > lastCheckinDay, "already checked in today");

                if (currentDay > lastCheckinDay + 1)
                {
                    if (currentStreak > highestStreak)
                    {
                        highestStreak = currentStreak;
                        SetUserHighestStreak(user, highestStreak);
                    }
                    IncrementUserResets(user);
                    OnStreakReset(user, currentStreak, highestStreak);
                    currentStreak = 0;
                }
            }

            currentStreak += 1;

            BigInteger reward = CalculateReward(currentStreak);
            if (reward > 0)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + reward);
            }

            SetUserLastCheckin(user, currentDay);
            SetUserCheckins(user, userCheckins + 1);

            if (currentStreak > highestStreak)
            {
                SetUserHighestStreak(user, currentStreak);
            }

            if (isNewUser)
            {
                IncrementTotalUsers();
                SetUserJoinTime(user, (BigInteger)Runtime.Time);
            }
            IncrementTotalCheckins();

            CheckMilestones(user, currentStreak);
            CheckBadges(user, currentStreak, isNewUser);

            BigInteger storedStreak = currentStreak >= STREAK_RESET_DAYS ? 0 : currentStreak;
            SetUserStreak(user, storedStreak);

            BigInteger nextEligible = (currentDay + 1) * TWENTY_FOUR_HOURS_SECONDS;
            OnCheckedIn(user, currentStreak, reward, nextEligible);
        }

        #endregion

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            CreditDirectGasPayment(APP_ID, from, amount, data);
            if (amount == CHECK_IN_FEE && ReadPaymentMemo(data) == APP_ID + ":checkin")
            {
                ValidateNotPaused();
                ValidateAddress(from);
                ConsumeDirectGasCredit(from, CHECK_IN_FEE);
                ProcessCheckIn(from);
            }
        }
    }
}
