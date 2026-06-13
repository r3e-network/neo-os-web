using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDailyCheckin : SmartContract
    {
        #region Reads — frontend ABI (useCheckin.ts)
        /// <summary>
        /// Combined per-user state the frontend hydrates from. Day fields are in the
        /// contract's own UTC-day unit; GAS amounts are base units.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCheckInStateForFrontend(UInt160 user)
        {
            StorageContext ctx = Storage.CurrentContext;
            UserState u = LoadUser(ctx, user);
            BigInteger today = CurrentUtcDay();
            Map<string, object> r = new Map<string, object>();
            r["currentStreak"] = u.CurrentStreak;
            r["highestStreak"] = u.HighestStreak;
            r["lastCheckinDay"] = u.LastCheckinDay;
            r["unclaimed"] = u.Unclaimed;
            r["totalCheckins"] = u.TotalCheckins;
            r["currentTime"] = (BigInteger)Runtime.Time;
            r["currentDay"] = today;
            r["twentyFourHours"] = (BigInteger)MS_PER_DAY;
            r["weekReward"] = WeekRewardValue(ctx);
            r["twoWeekReward"] = TwoWeekRewardValue(ctx);
            r["resetAfterDays"] = (BigInteger)1; // streak resets after a single missed UTC day
            return r;
        }

        /// <summary>Eligibility view for the connected user.</summary>
        [Safe]
        public static Map<string, object> GetCheckinStatus(UInt160 user)
        {
            StorageContext ctx = Storage.CurrentContext;
            UserState u = LoadUser(ctx, user);
            BigInteger today = CurrentUtcDay();
            bool canCheckin = u.LastCheckinDay < today;
            BigInteger nextMidnight = (today + 1) * MS_PER_DAY; // wall-clock ms of next UTC midnight
            BigInteger timeUntilEligible = canCheckin ? 0 : nextMidnight - (BigInteger)Runtime.Time;
            if (timeUntilEligible < 0) timeUntilEligible = 0;
            // Streak resets if the user misses the very next day (i.e. they did not
            // check in yesterday or today): a check-in tomorrow keeps the streak only
            // when lastCheckinDay == today.
            bool streakWillReset = u.CurrentStreak > 0 && u.LastCheckinDay < today;

            Map<string, object> r = new Map<string, object>();
            r["currentUtcDay"] = today;
            r["lastCheckinDay"] = u.LastCheckinDay;
            r["canCheckin"] = canCheckin;
            r["timeUntilEligible"] = timeUntilEligible;
            r["streakWillReset"] = streakWillReset;
            r["currentStreak"] = u.CurrentStreak;
            r["nextRewardDay"] = NextRewardDay(u.CurrentStreak);
            return r;
        }

        /// <summary>Detailed per-user stats (includes lifetime claimed).</summary>
        [Safe]
        public static Map<string, object> GetUserStatsDetails(UInt160 user)
        {
            UserState u = LoadUser(Storage.CurrentContext, user);
            Map<string, object> r = new Map<string, object>();
            r["streak"] = u.CurrentStreak;
            r["highestStreak"] = u.HighestStreak;
            r["lastCheckinDay"] = u.LastCheckinDay;
            r["unclaimed"] = u.Unclaimed;
            r["claimed"] = u.Claimed;
            r["totalCheckins"] = u.TotalCheckins;
            return r;
        }

        /// <summary>Global platform stats + current config.</summary>
        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger today = CurrentUtcDay();
            Map<string, object> r = new Map<string, object>();
            r["totalUsers"] = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_USERS);
            r["totalCheckins"] = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_CHECKINS);
            r["totalRewarded"] = (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_REWARDED);
            r["checkInFee"] = FeeValue(ctx);
            r["currentUtcDay"] = today;
            r["nextMidnight"] = (today + 1) * MS_PER_DAY;
            r["weekReward"] = WeekRewardValue(ctx);
            r["twoWeekReward"] = TwoWeekRewardValue(ctx);
            r["resetAfterDays"] = (BigInteger)1;
            return r;
        }

        /// <summary>Whether check-ins / claims are currently paused.</summary>
        [Safe]
        public static bool IsPaused() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != 0;

        /// <summary>The reward-backing GAS pool the contract holds (base units).</summary>
        [Safe]
        public static BigInteger RewardPool() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_POOL);

        /// <summary>
        /// The protected obligation: sum of every user's accrued-but-unclaimed
        /// reward. WithdrawRevenue can never reduce the pool below this (base units).
        /// </summary>
        [Safe]
        public static BigInteger TotalUnclaimed() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_UNCLAIMED);

        /// <summary>The configured check-in fee (base units).</summary>
        [Safe]
        public static BigInteger CheckInFee() => FeeValue(Storage.CurrentContext);
        #endregion

        #region Internal (reads)
        /// <summary>The next streak day that accrues a reward, given the current streak.</summary>
        private static BigInteger NextRewardDay(BigInteger streak)
        {
            if (streak < WEEK_DAY) return WEEK_DAY;
            if (streak < TWO_WEEK_DAY) return TWO_WEEK_DAY;
            return TWO_WEEK_DAY; // no further milestones; cap at the last one
        }
        #endregion
    }
}
