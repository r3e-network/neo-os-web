using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void CheckedInHandler(UInt160 user, BigInteger streak, BigInteger reward, BigInteger nextEligibleTs);
    public delegate void RewardsClaimedHandler(UInt160 user, BigInteger amount, BigInteger totalClaimed);
    public delegate void StreakResetHandler(UInt160 user, BigInteger previousStreak, BigInteger highestStreak);

    /// <summary>
    /// Daily Check-in MiniApp Contract.
    ///
    /// GAME MECHANICS:
    /// - Users check in once every 24 hours (rolling window)
    /// - Build consecutive day streaks to earn GAS rewards
    /// - Day 7: 1 GAS, Day 14+: +1.5 GAS every 7 days (cumulative)
    /// - Miss a day = streak resets to 0, but highest streak is recorded
    /// - Requires valid payment receipt to prevent direct contract calls
    ///
    /// REWARD STRUCTURE:
    /// - Day 7:  1.0 GAS (cumulative: 1.0)
    /// - Day 14: 1.5 GAS (cumulative: 2.5)
    /// - Day 21: 1.5 GAS (cumulative: 4.0)
    /// - Day 28: 1.5 GAS (cumulative: 5.5)
    /// - And so on...
    /// </summary>
    [DisplayName("MiniAppDailyCheckin")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Daily Check-in MiniApp. Check in every day to build streaks and earn GAS rewards.")]
    [ContractPermission("*", "*")]
    public partial class MiniAppContract : SmartContract
    {
        #region App Constants
        private const string APP_ID = "miniapp-dailycheckin";
        private const long TWENTY_FOUR_HOURS = 86400; // seconds
        private const long CHECK_IN_FEE = 100000; // 0.001 GAS
        private const long FIRST_REWARD = 100000000; // 1 GAS at day 7
        private const long SUBSEQUENT_REWARD = 150000000; // 1.5 GAS for day 14+
        #endregion

        #region App Prefixes (0x10+ for app-specific)
        private static readonly byte[] PREFIX_USER_STREAK = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_USER_HIGHEST = new byte[] { 0x11 };
        private static readonly byte[] PREFIX_USER_LAST_CHECKIN = new byte[] { 0x12 };
        private static readonly byte[] PREFIX_USER_UNCLAIMED = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_USER_CLAIMED = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_USER_CHECKINS = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_TOTAL_CHECKINS = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_TOTAL_REWARDED = new byte[] { 0x22 };
        #endregion

        #region Events
        [DisplayName("CheckedIn")]
        public static event CheckedInHandler OnCheckedIn;

        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed;

        [DisplayName("StreakReset")]
        public static event StreakResetHandler OnStreakReset;
        #endregion

        #region Global Stats Getters
        [Safe]
        public static BigInteger TotalUsers() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_USERS);

        [Safe]
        public static BigInteger TotalCheckins() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS);

        [Safe]
        public static BigInteger TotalRewarded() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_REWARDED);

        [Safe]
        public static object[] GetGlobalStats()
        {
            return new object[] {
                TotalUsers(),
                TotalCheckins(),
                TotalRewarded()
            };
        }
        #endregion

        #region User Stats Getters
        [Safe]
        public static BigInteger GetUserStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserHighestStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserLastCheckin(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserUnclaimed(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserClaimed(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CLAIMED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static BigInteger GetUserCheckins(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CHECKINS, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        [Safe]
        public static object[] GetUserStats(UInt160 user)
        {
            return new object[] {
                GetUserStreak(user),
                GetUserHighestStreak(user),
                GetUserLastCheckin(user),
                GetUserUnclaimed(user),
                GetUserClaimed(user),
                GetUserCheckins(user)
            };
        }
        #endregion

        #region Receipt Validation
        /// <summary>
        /// Validates and marks a receipt as used.
        /// SECURITY: Prevents replay attacks and ensures payment went through miniapp.
        /// </summary>
        private static void ValidateAndUseReceipt(BigInteger receiptId)
        {
            ExecutionEngine.Assert(receiptId > 0, "invalid receipt");
            byte[] key = Helper.Concat(PREFIX_RECEIPT_USED, receiptId.ToByteArray());
            ExecutionEngine.Assert(Storage.Get(Storage.CurrentContext, key) == null, "receipt used");
            Storage.Put(Storage.CurrentContext, key, 1);
        }
        #endregion

        #region Check-in Logic
        /// <summary>
        /// Performs daily check-in for a user.
        /// SECURITY: Requires valid receipt from miniapp payment flow.
        /// </summary>
        public static void CheckIn(UInt160 user, BigInteger receiptId)
        {
            ValidateGateway();
            ValidateNotPaused();
            ValidateAddress(user);
            ValidateAndUseReceipt(receiptId);

            BigInteger currentTime = Runtime.Time;
            BigInteger lastCheckin = GetUserLastCheckin(user);
            BigInteger currentStreak = GetUserStreak(user);
            BigInteger highestStreak = GetUserHighestStreak(user);
            BigInteger userCheckins = GetUserCheckins(user);

            // Check if this is a new user
            bool isNewUser = lastCheckin == 0;

            // Check if streak should reset (more than 48 hours since last check-in)
            if (!isNewUser && currentTime > lastCheckin + (TWENTY_FOUR_HOURS * 2))
            {
                // Streak broken - reset
                if (currentStreak > highestStreak)
                {
                    highestStreak = currentStreak;
                    SetUserHighestStreak(user, highestStreak);
                }
                OnStreakReset(user, currentStreak, highestStreak);
                currentStreak = 0;
            }

            // Check if enough time has passed (at least 24 hours)
            if (!isNewUser)
            {
                ExecutionEngine.Assert(currentTime >= lastCheckin + TWENTY_FOUR_HOURS, "too early");
            }

            // Increment streak
            currentStreak += 1;

            // Calculate reward if milestone reached
            BigInteger reward = CalculateReward(currentStreak);
            if (reward > 0)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + reward);
            }

            // Update user stats
            SetUserStreak(user, currentStreak);
            SetUserLastCheckin(user, currentTime);
            SetUserCheckins(user, userCheckins + 1);

            // Update highest streak if needed
            if (currentStreak > highestStreak)
            {
                SetUserHighestStreak(user, currentStreak);
            }

            // Update global stats
            if (isNewUser)
            {
                IncrementTotalUsers();
            }
            IncrementTotalCheckins();

            // Calculate next eligible time
            BigInteger nextEligible = currentTime + TWENTY_FOUR_HOURS;

            OnCheckedIn(user, currentStreak, reward, nextEligible);
        }
        #endregion

        #region Reward Calculation
        /// <summary>
        /// Calculates reward for a given streak day.
        /// Day 7: 1 GAS, Day 14+: 1.5 GAS every 7 days
        /// </summary>
        private static BigInteger CalculateReward(BigInteger streak)
        {
            if (streak < 7) return 0;
            if (streak == 7) return FIRST_REWARD;
            if (streak % 7 == 0) return SUBSEQUENT_REWARD;
            return 0;
        }
        #endregion

        #region Claim Rewards
        /// <summary>
        /// Claims accumulated rewards for a user.
        /// </summary>
        public static void ClaimRewards(UInt160 user)
        {
            ValidateGateway();
            ValidateNotPaused();
            ValidateAddress(user);

            BigInteger unclaimed = GetUserUnclaimed(user);
            ExecutionEngine.Assert(unclaimed > 0, "no rewards");

            // Transfer GAS to user
            UInt160 hub = PaymentHub();
            ExecutionEngine.Assert(hub != null && hub.IsValid, "hub not set");

            bool success = (bool)Contract.Call(hub, "TransferReward", CallFlags.All,
                new object[] { user, unclaimed, APP_ID });
            ExecutionEngine.Assert(success, "transfer failed");

            // Update user stats
            BigInteger claimed = GetUserClaimed(user);
            SetUserClaimed(user, claimed + unclaimed);
            SetUserUnclaimed(user, 0);

            // Update global stats
            IncrementTotalRewarded(unclaimed);

            OnRewardsClaimed(user, unclaimed, claimed + unclaimed);
        }
        #endregion

        #region Storage Setters
        private static void SetUserStreak(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserHighestStreak(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserLastCheckin(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserUnclaimed(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserClaimed(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CLAIMED, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void SetUserCheckins(UInt160 user, BigInteger value)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CHECKINS, user);
            Storage.Put(Storage.CurrentContext, key, value);
        }

        private static void IncrementTotalUsers()
        {
            BigInteger current = TotalUsers();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, current + 1);
        }

        private static void IncrementTotalCheckins()
        {
            BigInteger current = TotalCheckins();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS, current + 1);
        }

        private static void IncrementTotalRewarded(BigInteger amount)
        {
            BigInteger current = TotalRewarded();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDED, current + amount);
        }
        #endregion

        #region Deployment
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_REWARDED, 0);
        }
        #endregion
    }
}