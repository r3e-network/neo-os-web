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
    /// <summary>
    /// DailyCheckin MiniApp - Reward users for daily engagement with streak mechanics.
    ///
    /// KEY FEATURES:
    /// - Daily check-in with streak tracking
    /// - Progressive rewards based on streak length
    /// - Milestone bonuses at 7, 30, 100, 365 days
    /// - Badge system for achievements
    /// - Anti-gaming: 24-hour minimum between check-ins
    ///
    /// SECURITY:
    /// - Requires valid payment receipt
    /// - Gateway validation for automation
    /// - Global pause mechanism
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for rewards
    /// </summary>
    [DisplayName("MiniAppDailyCheckin")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "DailyCheckin rewards users for consistent engagement with streak mechanics and milestone bonuses.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppDailyCheckin : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the DailyCheckin miniapp.</summary>
        private const string APP_ID = "miniapp-daily-checkin";
        
        /// <summary>Seconds in 24 hours for day calculation (86,400 seconds).</summary>
        private const long TWENTY_FOUR_HOURS_SECONDS = 86400;
        
        /// <summary>Base reward amount in GAS (0.01 GAS = 1,000,000).</summary>
        private const long BASE_REWARD = 1000000;
        
        /// <summary>Streak multiplier cap at 30 days to prevent excessive rewards.</summary>
        private const int MAX_STREAK_MULTIPLIER = 30;
        
        /// <summary>Bonus reward for 7-day streak milestone.</summary>
        private const long MILESTONE_7_BONUS = 5000000;
        
        /// <summary>Bonus reward for 30-day streak milestone.</summary>
        private const long MILESTONE_30_BONUS = 20000000;
        
        /// <summary>Bonus reward for 100-day streak milestone.</summary>
        private const long MILESTONE_100_BONUS = 50000000;
        
        /// <summary>Bonus reward for 365-day streak milestone.</summary>
        private const long MILESTONE_365_BONUS = 100000000;
        #endregion

        #region App Prefixes (0x20+ to avoid collision with MiniAppBase)
        /// <summary>Prefix 0x20: User last check-in day number.</summary>
        private static readonly byte[] PREFIX_USER_LAST_CHECKIN = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: User current streak count.</summary>
        private static readonly byte[] PREFIX_USER_STREAK = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: User total check-ins.</summary>
        private static readonly byte[] PREFIX_USER_CHECKINS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: User unclaimed rewards balance.</summary>
        private static readonly byte[] PREFIX_USER_UNCLAIMED = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: User highest streak achieved.</summary>
        private static readonly byte[] PREFIX_USER_HIGHEST_STREAK = new byte[] { 0x24 };
        
        /// <summary>Prefix 0x25: Total check-ins across all users.</summary>
        private static readonly byte[] PREFIX_TOTAL_CHECKINS = new byte[] { 0x25 };
        
        /// <summary>Prefix 0x26: User streak reset count.</summary>
        private static readonly byte[] PREFIX_USER_RESETS = new byte[] { 0x26 };
        
        /// <summary>Prefix 0x27: User join timestamp.</summary>
        private static readonly byte[] PREFIX_USER_JOIN_TIME = new byte[] { 0x27 };
        
        /// <summary>Prefix 0x28: User badges tracking.</summary>
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x28 };
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when user checks in.</summary>
        /// <param name="user">Address of the user checking in.</param>
        /// <param name="streak">Current streak after check-in.</param>
        /// <param name="reward">Reward amount for this check-in.</param>
        /// <param name="nextEligible">Timestamp when next check-in is allowed.</param>
        public delegate void CheckedInHandler(UInt160 user, BigInteger streak, BigInteger reward, BigInteger nextEligible);
        
        /// <summary>Event emitted when streak is reset (missed day).</summary>
        /// <param name="user">Address of the user whose streak reset.</param>
        /// <param name="oldStreak">The streak count before reset.</param>
        /// <param name="highestStreak">User's highest streak achieved.</param>
        public delegate void StreakResetHandler(UInt160 user, BigInteger oldStreak, BigInteger highestStreak);
        
        /// <summary>Event emitted when milestone is reached.</summary>
        /// <param name="user">Address of the user reaching milestone.</param>
        /// <param name="milestone">Milestone number (7, 30, 100, 365).</param>
        /// <param name="bonus">Bonus reward amount.</param>
        public delegate void MilestoneReachedHandler(UInt160 user, BigInteger milestone, BigInteger bonus);
        
        /// <summary>Event emitted when user claims rewards.</summary>
        /// <param name="user">Address claiming rewards.</param>
        /// <param name="amount">Amount of GAS claimed.</param>
        public delegate void RewardsClaimedHandler(UInt160 user, BigInteger amount);
        
        /// <summary>Event emitted when user earns a badge.</summary>
        /// <param name="user">Address earning the badge.</param>
        /// <param name="badgeType">Type identifier of the badge.</param>
        /// <param name="badgeName">Human-readable badge name.</param>
        public delegate void UserBadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
        #endregion

        #region Events
        [DisplayName("CheckedIn")]
        public static event CheckedInHandler OnCheckedIn;

        [DisplayName("StreakReset")]
        public static event StreakResetHandler OnStreakReset;

        [DisplayName("MilestoneReached")]
        public static event MilestoneReachedHandler OnMilestoneReached;

        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed;

        [DisplayName("UserBadgeEarned")]
        public static event UserBadgeEarnedHandler OnUserBadgeEarned;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// Sets admin and initializes counters.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_USERS, 0);
        }
        #endregion

        #region Read Methods
        /// <summary>
        /// Gets the last check-in day number for a user.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Day number of last check-in (0 if never checked in).</returns>
        [Safe]
        public static BigInteger GetUserLastCheckin(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Gets the current streak for a user.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Current streak count.</returns>
        [Safe]
        public static BigInteger GetUserStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Gets the highest streak achieved by a user.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Highest streak count achieved.</returns>
        [Safe]
        public static BigInteger GetUserHighestStreak(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST_STREAK, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Gets total check-ins across all users.
        /// </summary>
        /// <returns>Total check-in count.</returns>
        [Safe]
        public static BigInteger GetTotalCheckins() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS);

        /// <summary>
        /// Gets unclaimed rewards balance for a user.
        /// </summary>
        /// <param name="user">User address.</param>
        /// <returns>Unclaimed rewards amount.</returns>
        [Safe]
        public static BigInteger GetUserUnclaimed(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        /// <summary>
        /// Calculates reward for a given streak length.
        /// </summary>
        /// <param name="streak">Current streak length.</param>
        /// <returns>Calculated reward amount.</returns>
        [Safe]
        public static BigInteger CalculateReward(BigInteger streak)
        {
            BigInteger multiplier = streak > MAX_STREAK_MULTIPLIER ? MAX_STREAK_MULTIPLIER : streak;
            if (multiplier < 1) multiplier = 1;
            return BASE_REWARD * multiplier;
        }
        #endregion

        #region Internal Helpers
        private static void SetUserLastCheckin(UInt160 user, BigInteger day)
        {
            byte[] key = Helper.Concat(PREFIX_USER_LAST_CHECKIN, user);
            Storage.Put(Storage.CurrentContext, key, day);
        }

        private static void SetUserStreak(UInt160 user, BigInteger streak)
        {
            byte[] key = Helper.Concat(PREFIX_USER_STREAK, user);
            Storage.Put(Storage.CurrentContext, key, streak);
        }

        private static void SetUserHighestStreak(UInt160 user, BigInteger streak)
        {
            byte[] key = Helper.Concat(PREFIX_USER_HIGHEST_STREAK, user);
            Storage.Put(Storage.CurrentContext, key, streak);
        }

        private static void SetUserCheckins(UInt160 user, BigInteger count)
        {
            byte[] key = Helper.Concat(PREFIX_USER_CHECKINS, user);
            Storage.Put(Storage.CurrentContext, key, count);
        }

        private static void SetUserUnclaimed(UInt160 user, BigInteger amount)
        {
            byte[] key = Helper.Concat(PREFIX_USER_UNCLAIMED, user);
            Storage.Put(Storage.CurrentContext, key, amount);
        }

        private static void IncrementTotalCheckins()
        {
            BigInteger total = GetTotalCheckins();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_CHECKINS, total + 1);
        }

        private static void IncrementUserResets(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_RESETS, user);
            BigInteger resets = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            Storage.Put(Storage.CurrentContext, key, resets + 1);
        }

        private static void SetUserJoinTime(UInt160 user, BigInteger time)
        {
            byte[] key = Helper.Concat(PREFIX_USER_JOIN_TIME, user);
            Storage.Put(Storage.CurrentContext, key, time);
        }
        #endregion

        #region Badge Logic
        private static void CheckBadges(UInt160 user, BigInteger streak, bool isNewUser)
        {
            // Badge 1: First Check-in
            if (!HasUserBadge(user, 1))
            {
                AwardUserBadge(user, 1, "First Check-in");
            }

            // Badge 2: Week Streak (7 days)
            if (streak >= 7 && !HasUserBadge(user, 2))
            {
                AwardUserBadge(user, 2, "Week Warrior");
            }

            // Badge 3: Month Streak (30 days)
            if (streak >= 30 && !HasUserBadge(user, 3))
            {
                AwardUserBadge(user, 3, "Monthly Master");
            }

            // Badge 4: Century Streak (100 days)
            if (streak >= 100 && !HasUserBadge(user, 4))
            {
                AwardUserBadge(user, 4, "Century Club");
            }

            // Badge 5: Year Streak (365 days)
            if (streak >= 365 && !HasUserBadge(user, 5))
            {
                AwardUserBadge(user, 5, "Year Legend");
            }
        }

        private static void AwardUserBadge(UInt160 user, BigInteger badgeType, string badgeName)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);
            OnUserBadgeEarned(user, badgeType, badgeName);
        }

        private static bool HasUserBadge(UInt160 user, BigInteger badgeType)
        {
            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_USER_BADGES, user),
                (ByteString)badgeType.ToByteArray());
            return (BigInteger)Storage.Get(Storage.CurrentContext, key) == 1;
        }
        #endregion

        #region Milestones
        private static void CheckMilestones(UInt160 user, BigInteger streak)
        {
            if (streak == 7)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + MILESTONE_7_BONUS);
                OnMilestoneReached(user, 7, MILESTONE_7_BONUS);
            }
            else if (streak == 30)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + MILESTONE_30_BONUS);
                OnMilestoneReached(user, 30, MILESTONE_30_BONUS);
            }
            else if (streak == 100)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + MILESTONE_100_BONUS);
                OnMilestoneReached(user, 100, MILESTONE_100_BONUS);
            }
            else if (streak == 365)
            {
                BigInteger unclaimed = GetUserUnclaimed(user);
                SetUserUnclaimed(user, unclaimed + MILESTONE_365_BONUS);
                OnMilestoneReached(user, 365, MILESTONE_365_BONUS);
            }
        }
        #endregion
    }
}
