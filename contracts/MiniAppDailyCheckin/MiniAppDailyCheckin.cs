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
    public delegate void MilestoneReachedHandler(UInt160 user, BigInteger milestoneType, BigInteger streak);
    public delegate void BadgeEarnedHandler(UInt160 user, BigInteger badgeType, string badgeName);
    public delegate void BonusRewardHandler(UInt160 user, BigInteger bonusAmount, string bonusType);

    [DisplayName("MiniAppDailyCheckin")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Daily Check-in engagement platform with streak tracking and rewards")]
    [ContractPermission("*", "*")]
    public partial class MiniAppDailyCheckin : MiniAppBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-dailycheckin";
        private const long TWENTY_FOUR_HOURS_SECONDS = 86400;
        private const long CHECK_IN_FEE = 100000;
        private const long FIRST_REWARD = 100000000;
        private const long SUBSEQUENT_REWARD = 150000000;
        private const long MILESTONE_30_BONUS = 500000000;
        private const long MILESTONE_100_BONUS = 2000000000;
        private const long MILESTONE_365_BONUS = 10000000000;
        #endregion

        #region App Prefixes
        private static readonly byte[] PREFIX_USER_STREAK = new byte[] { 0x20 };
        private static readonly byte[] PREFIX_USER_HIGHEST = new byte[] { 0x21 };
        private static readonly byte[] PREFIX_USER_LAST_CHECKIN = new byte[] { 0x22 };
        private static readonly byte[] PREFIX_USER_UNCLAIMED = new byte[] { 0x23 };
        private static readonly byte[] PREFIX_USER_CLAIMED = new byte[] { 0x24 };
        private static readonly byte[] PREFIX_USER_CHECKINS = new byte[] { 0x25 };
        private static readonly byte[] PREFIX_TOTAL_USERS = new byte[] { 0x26 };
        private static readonly byte[] PREFIX_TOTAL_CHECKINS = new byte[] { 0x27 };
        private static readonly byte[] PREFIX_TOTAL_REWARDED = new byte[] { 0x28 };
        private static readonly byte[] PREFIX_USER_BADGES = new byte[] { 0x29 };
        private static readonly byte[] PREFIX_USER_STATS = new byte[] { 0x2A };
        private static readonly byte[] PREFIX_USER_RESETS = new byte[] { 0x2B };
        private static readonly byte[] PREFIX_USER_JOIN_TIME = new byte[] { 0x2C };
        private static readonly byte[] PREFIX_USER_BADGE_COUNT = new byte[] { 0x2D };
        #endregion

        #region Data Structures
        public struct UserStats
        {
            public BigInteger TotalCheckins;
            public BigInteger CurrentStreak;
            public BigInteger HighestStreak;
            public BigInteger TotalRewardsClaimed;
            public BigInteger UnclaimedRewards;
            public BigInteger StreakResets;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastCheckinTime;
            public BigInteger ComebackCount;
        }
        #endregion

        #region Events
        [DisplayName("CheckedIn")]
        public static event CheckedInHandler OnCheckedIn;

        [DisplayName("RewardsClaimed")]
        public static event RewardsClaimedHandler OnRewardsClaimed;

        [DisplayName("StreakReset")]
        public static event StreakResetHandler OnStreakReset;

        [DisplayName("MilestoneReached")]
        public static event MilestoneReachedHandler OnMilestoneReached;

        [DisplayName("DailyBadgeEarned")]
        public static event BadgeEarnedHandler OnBadgeEarned;

        [DisplayName("BonusReward")]
        public static event BonusRewardHandler OnBonusReward;
        #endregion
    }
}
