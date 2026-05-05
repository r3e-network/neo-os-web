using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Countdown (LastSurvivor) game module
    //
    //  Ported from MiniAppLastSurvivor.  Every method takes appId as its
    //  first parameter and all storage is namespaced via AppKey().
    //
    //  GAME MECHANICS:
    //  - Admin starts a round with a countdown timer
    //  - Players buy keys with GAS; each key extends the timer
    //  - When the timer expires the last buyer wins the pot
    //  - Dynamic key pricing via arithmetic sequence formula
    //  - Pot split: 48% winner, 30% dividends, 10% next round, 7% referral, 5% platform
    // ===================================================================
    public partial class PlatformGameContract
    {
        // ---------------------------------------------------------------
        //  Countdown constants
        // ---------------------------------------------------------------
        private const int CD_PLATFORM_FEE_BPS     = 500;
        private const int CD_WINNER_SHARE_BPS      = 4800;
        private const int CD_DIVIDEND_SHARE_BPS    = 3000;
        private const int CD_NEXT_ROUND_SHARE_BPS  = 1000;
        private const int CD_REFERRAL_SHARE_BPS    = 700;
        private const long CD_BASE_KEY_PRICE       = 10000000;   // 0.1 GAS
        private const int CD_KEY_PRICE_INCREMENT_BPS = 10;
        private const long CD_TIME_PER_KEY_SECONDS = 86400;
        private const long CD_INITIAL_DURATION     = 86400;      // 24 hours
        private const long CD_MAX_DURATION         = 86400;
        private const long CD_MIN_KEYS             = 1;

        // ---------------------------------------------------------------
        //  Countdown storage prefixes (0xA0 - 0xAF)
        // ---------------------------------------------------------------
        private static readonly byte[] CD_PREFIX_ROUND_ID           = new byte[] { 0xA0 };
        private static readonly byte[] CD_PREFIX_ROUNDS             = new byte[] { 0xA1 };
        private static readonly byte[] CD_PREFIX_PLAYER_KEYS        = new byte[] { 0xA2 };
        private static readonly byte[] CD_PREFIX_PLAYER_STATS       = new byte[] { 0xA3 };
        private static readonly byte[] CD_PREFIX_TOTAL_KEYS_SOLD    = new byte[] { 0xA4 };
        private static readonly byte[] CD_PREFIX_TOTAL_POT_DIST     = new byte[] { 0xA5 };
        private static readonly byte[] CD_PREFIX_TOTAL_PLAYERS      = new byte[] { 0xA6 };
        private static readonly byte[] CD_PREFIX_TOTAL_ROUNDS       = new byte[] { 0xA7 };
        private static readonly byte[] CD_PREFIX_PLAYER_BADGES      = new byte[] { 0xA8 };
        private static readonly byte[] CD_PREFIX_DIVIDENDS_CLAIMED  = new byte[] { 0xA9 };

        // ---------------------------------------------------------------
        //  Countdown data structures
        // ---------------------------------------------------------------
        public struct CountdownRound
        {
            public BigInteger Id;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger Pot;
            public BigInteger TotalKeys;
            public UInt160 LastBuyer;
            public UInt160 Winner;
            public BigInteger WinnerPrize;
            public bool Active;
            public bool Settled;
        }

        public struct CountdownPlayerStats
        {
            public BigInteger TotalKeysOwned;
            public BigInteger TotalSpent;
            public BigInteger TotalWon;
            public BigInteger RoundsPlayed;
            public BigInteger RoundsWon;
            public BigInteger ReferralEarnings;
            public BigInteger BadgeCount;
            public BigInteger JoinTime;
            public BigInteger LastActivityTime;
            public BigInteger HighestSinglePurchase;
            public BigInteger DividendsClaimed;
        }

        // ---------------------------------------------------------------
        //  Countdown events
        // ---------------------------------------------------------------
        public delegate void CountdownKeysPurchasedHandler(string appId, UInt160 player, BigInteger keys, BigInteger potContribution, BigInteger roundId);
        public delegate void CountdownWinnerHandler(string appId, UInt160 winner, BigInteger prize, BigInteger roundId);
        public delegate void CountdownRoundStartedHandler(string appId, BigInteger roundId, BigInteger endTime);
        public delegate void CountdownTimeExtendedHandler(string appId, BigInteger roundId, BigInteger newEndTime, BigInteger keysAdded);
        public delegate void CountdownBadgeHandler(string appId, UInt160 player, BigInteger badgeType, string badgeName);

        [DisplayName("CountdownKeysPurchased")]
        public static event CountdownKeysPurchasedHandler OnCountdownKeysPurchased;

        [DisplayName("CountdownWinner")]
        public static event CountdownWinnerHandler OnCountdownWinner;

        [DisplayName("CountdownRoundStarted")]
        public static event CountdownRoundStartedHandler OnCountdownRoundStarted;

        [DisplayName("CountdownTimeExtended")]
        public static event CountdownTimeExtendedHandler OnCountdownTimeExtended;

        [DisplayName("CountdownBadge")]
        public static event CountdownBadgeHandler OnCountdownBadge;

        // ===================================================================
        //  Admin: start a new countdown round
        // ===================================================================

        /// <summary>
        /// Start a new countdown round for the given appId.
        /// Only the app admin (or platform admin) may call.
        /// The previous round (if any) must not be active.
        /// </summary>
        public static void StartCountdownRound(string appId)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Countdown);
            RequireAppAdminOrPlatformAdmin(appId);

            BigInteger currentId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (currentId > 0)
            {
                CountdownRound prev = LoadCountdownRound(appId, currentId);
                ExecutionEngine.Assert(!prev.Active, "previous round still active");
            }

            StartNextCountdownRound(appId, 0);
        }

        // ===================================================================
        //  Player: buy keys
        // ===================================================================

        /// <summary>
        /// Buy countdown keys. Called after the player has prepaid GAS.
        ///
        /// FLOW:
        /// 1. Validate game state and player authorization
        /// 2. Auto-settle round if timer expired
        /// 3. Calculate cost with O(1) arithmetic formula
        /// 4. Consume prepaid GAS credit
        /// 5. Update round state, player stats, extend timer
        /// </summary>
        public static void BuyCountdownKeys(string appId, UInt160 player, BigInteger keyCount)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Countdown);
            ExecutionEngine.Assert(keyCount >= CD_MIN_KEYS, "min 1 key");

            ValidateUserOrAbstractAccount(player);

            AcquireReentrancyLock(appId);

            CountdownRound round = EnsureActiveCountdownRound(appId);
            BigInteger roundId = round.Id;

            // O(1) cost calculation via arithmetic sequence sum
            BigInteger cost = CalculateCountdownKeyCost(keyCount, round.TotalKeys);
            ConsumeDirectGasCredit(appId, player, cost);

            // Update round
            BigInteger potContribution = cost * (10000 - CD_PLATFORM_FEE_BPS) / 10000;
            round.Pot += potContribution;
            round.TotalKeys += keyCount;
            round.LastBuyer = player;

            // Extend timer (capped at max duration from now)
            BigInteger timeToAdd = keyCount * CD_TIME_PER_KEY_SECONDS;
            BigInteger newEndTime = round.EndTime + timeToAdd;
            BigInteger maxEndTime = Runtime.Time + CD_MAX_DURATION;
            if (newEndTime > maxEndTime) newEndTime = maxEndTime;
            round.EndTime = newEndTime;

            StoreCountdownRound(appId, roundId, round);

            // Update player keys for this round
            byte[] pkKey = AppKeyAddrId(appId, CD_PREFIX_PLAYER_KEYS, player, roundId);
            BigInteger currentKeys = (BigInteger)Storage.Get(Storage.CurrentContext, pkKey);
            Storage.Put(Storage.CurrentContext, pkKey, currentKeys + keyCount);

            // Update player stats
            UpdateCountdownPlayerStats(appId, player, keyCount, cost);

            // Update global stats
            BigInteger totalKeys = AppGetInt(appId, CD_PREFIX_TOTAL_KEYS_SOLD);
            AppPut(appId, CD_PREFIX_TOTAL_KEYS_SOLD, totalKeys + keyCount);

            ReleaseReentrancyLock(appId);

            OnCountdownKeysPurchased(appId, player, keyCount, potContribution, roundId);
            OnCountdownTimeExtended(appId, roundId, newEndTime, keyCount);
        }

        /// <summary>
        /// Explicitly check and settle a round whose timer expired.
        /// Can be called by anyone (permissionless settlement).
        /// </summary>
        public static void CheckAndEndCountdownRound(string appId)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Countdown);

            AcquireReentrancyLock(appId);

            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId == 0)
            {
                StartNextCountdownRound(appId, 0);
                ReleaseReentrancyLock(appId);
                return;
            }

            CountdownRound round = LoadCountdownRound(appId, roundId);
            if (!round.Active)
            {
                ExecutionEngine.Assert(round.Settled, "round unavailable");
                StartNextCountdownRound(appId, 0);
                ReleaseReentrancyLock(appId);
                return;
            }

            ExecutionEngine.Assert(Runtime.Time >= round.EndTime, "round not ended");

            SettleCountdownRound(appId, roundId);
            ReleaseReentrancyLock(appId);
        }

        // ===================================================================
        //  Read methods
        // ===================================================================

        /// <summary>
        /// Get the current countdown status for an appId.
        /// Returns a Map with round state, timer, key price, etc.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCountdownStatus(string appId)
        {
            Map<string, object> status = new Map<string, object>();

            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId == 0)
            {
                status["roundId"] = 0;
                status["active"] = false;
                return status;
            }

            CountdownRound round = LoadCountdownRound(appId, roundId);

            status["roundId"] = roundId;
            status["active"] = round.Active;
            status["pot"] = round.Pot;
            status["totalKeys"] = round.TotalKeys;
            status["lastBuyer"] = round.LastBuyer;
            status["startTime"] = round.StartTime;
            status["endTime"] = round.EndTime;
            status["settled"] = round.Settled;

            // Current key price
            BigInteger keyPrice = CD_BASE_KEY_PRICE +
                (round.TotalKeys * CD_BASE_KEY_PRICE * CD_KEY_PRICE_INCREMENT_BPS / 10000);
            status["currentKeyPrice"] = keyPrice;

            if (round.Active)
            {
                BigInteger remaining = round.EndTime - Runtime.Time;
                status["remainingTime"] = remaining > 0 ? remaining : 0;
                status["status"] = remaining > 0 ? "active" : "ending";
            }
            else
            {
                status["status"] = round.Settled ? "settled" : "ended";
                status["winner"] = round.Winner;
                status["winnerPrize"] = round.WinnerPrize;
            }

            // Constants for frontend calculation
            status["baseKeyPrice"] = CD_BASE_KEY_PRICE;
            status["keyPriceIncrementBps"] = CD_KEY_PRICE_INCREMENT_BPS;
            status["timeAddedPerKey"] = CD_TIME_PER_KEY_SECONDS;
            status["maxDuration"] = CD_MAX_DURATION;
            status["platformFeeBps"] = CD_PLATFORM_FEE_BPS;
            status["winnerShareBps"] = CD_WINNER_SHARE_BPS;
            status["dividendShareBps"] = CD_DIVIDEND_SHARE_BPS;

            // Aggregate stats
            status["totalKeysSold"] = AppGetInt(appId, CD_PREFIX_TOTAL_KEYS_SOLD);
            status["totalPotDistributed"] = AppGetInt(appId, CD_PREFIX_TOTAL_POT_DIST);
            status["totalPlayers"] = AppGetInt(appId, CD_PREFIX_TOTAL_PLAYERS);
            status["totalRounds"] = AppGetInt(appId, CD_PREFIX_TOTAL_ROUNDS);

            return status;
        }

        /// <summary>
        /// Get per-player stats for the countdown game.
        /// </summary>
        [Safe]
        public static Map<string, object> GetCountdownPlayerStats(string appId, UInt160 player)
        {
            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);
            Map<string, object> details = new Map<string, object>();

            details["totalKeysOwned"] = stats.TotalKeysOwned;
            details["totalSpent"] = stats.TotalSpent;
            details["totalWon"] = stats.TotalWon;
            details["roundsPlayed"] = stats.RoundsPlayed;
            details["roundsWon"] = stats.RoundsWon;
            details["referralEarnings"] = stats.ReferralEarnings;
            details["badgeCount"] = stats.BadgeCount;
            details["joinTime"] = stats.JoinTime;
            details["lastActivityTime"] = stats.LastActivityTime;
            details["highestSinglePurchase"] = stats.HighestSinglePurchase;
            details["dividendsClaimed"] = stats.DividendsClaimed;
            details["netProfit"] = stats.TotalWon - stats.TotalSpent;

            if (stats.RoundsPlayed > 0)
            {
                details["winRate"] = stats.RoundsWon * 10000 / stats.RoundsPlayed;
            }

            // Current round keys
            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId > 0)
            {
                byte[] pkKey = AppKeyAddrId(appId, CD_PREFIX_PLAYER_KEYS, player, roundId);
                details["currentRoundKeys"] = (BigInteger)Storage.Get(Storage.CurrentContext, pkKey);
            }

            return details;
        }

        /// <summary>
        /// Calculate the cost for buying multiple keys using O(1) formula.
        /// Sum of arithmetic sequence: n * firstPrice + d * n * (n-1) / 2
        /// </summary>
        [Safe]
        public static BigInteger CalculateCountdownKeyCost(BigInteger keyCount, BigInteger currentTotalKeys)
        {
            if (keyCount <= 0) return 0;

            BigInteger commonDiff = CD_BASE_KEY_PRICE * CD_KEY_PRICE_INCREMENT_BPS / 10000;
            BigInteger firstKeyPrice = CD_BASE_KEY_PRICE + (currentTotalKeys * commonDiff);
            BigInteger totalCost = keyCount * firstKeyPrice +
                commonDiff * keyCount * (keyCount - 1) / 2;

            return totalCost;
        }

        // ===================================================================
        //  Internal countdown helpers
        // ===================================================================

        /// <summary>
        /// Settle a countdown round: pay the winner, update stats.
        /// </summary>
        private static void SettleCountdownRound(string appId, BigInteger roundId)
        {
            CountdownRound round = LoadCountdownRound(appId, roundId);
            if (!round.Active || round.Settled) return;

            UInt160 winner = round.LastBuyer;
            BigInteger winnerPrize = round.Pot * CD_WINNER_SHARE_BPS / 10000;
            BigInteger nextRoundPot = round.Pot * CD_NEXT_ROUND_SHARE_BPS / 10000;

            round.Active = false;
            round.Settled = true;
            round.Winner = winner;
            round.WinnerPrize = winnerPrize;
            StoreCountdownRound(appId, roundId, round);

            // Transfer prize to winner
            if (winner != UInt160.Zero && winnerPrize > 0)
            {
                ExecutionEngine.Assert(
                    GAS.Transfer(Runtime.ExecutingScriptHash, winner, winnerPrize),
                    "winner payout failed");

                // Update winner stats
                CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, winner);
                stats.TotalWon += winnerPrize;
                stats.RoundsWon += 1;
                StoreCountdownPlayerStats(appId, winner, stats);
            }

            // Update total distributed
            BigInteger totalDistributed = AppGetInt(appId, CD_PREFIX_TOTAL_POT_DIST);
            AppPut(appId, CD_PREFIX_TOTAL_POT_DIST, totalDistributed + round.Pot);

            OnCountdownWinner(appId, winner, winnerPrize, roundId);
            StartNextCountdownRound(appId, nextRoundPot);
        }

        /// <summary>
        /// Ensure the app has a live round. Expired rounds are settled and
        /// immediately rolled forward so LastSurvivor never remains stopped.
        /// </summary>
        private static CountdownRound EnsureActiveCountdownRound(string appId)
        {
            BigInteger roundId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            if (roundId == 0)
            {
                return StartNextCountdownRound(appId, 0);
            }

            CountdownRound round = LoadCountdownRound(appId, roundId);
            if (round.Active)
            {
                if (Runtime.Time >= round.EndTime)
                {
                    SettleCountdownRound(appId, roundId);
                    return LoadCountdownRound(appId, AppGetInt(appId, CD_PREFIX_ROUND_ID));
                }

                return round;
            }

            ExecutionEngine.Assert(round.Settled, "round unavailable");
            return StartNextCountdownRound(appId, 0);
        }

        /// <summary>Start the next countdown round with an optional rollover pot.</summary>
        private static CountdownRound StartNextCountdownRound(string appId, BigInteger seedPot)
        {
            BigInteger currentId = AppGetInt(appId, CD_PREFIX_ROUND_ID);
            BigInteger newRoundId = currentId + 1;
            AppPut(appId, CD_PREFIX_ROUND_ID, newRoundId);

            CountdownRound round = new CountdownRound
            {
                Id = newRoundId,
                StartTime = Runtime.Time,
                EndTime = Runtime.Time + CD_INITIAL_DURATION,
                Pot = seedPot,
                TotalKeys = 0,
                LastBuyer = UInt160.Zero,
                Winner = UInt160.Zero,
                WinnerPrize = 0,
                Active = true,
                Settled = false
            };
            StoreCountdownRound(appId, newRoundId, round);

            BigInteger totalRounds = AppGetInt(appId, CD_PREFIX_TOTAL_ROUNDS);
            AppPut(appId, CD_PREFIX_TOTAL_ROUNDS, totalRounds + 1);

            OnCountdownRoundStarted(appId, newRoundId, round.EndTime);
            return round;
        }

        /// <summary>Update player stats after a key purchase.</summary>
        private static void UpdateCountdownPlayerStats(string appId, UInt160 player, BigInteger keyCount, BigInteger spent)
        {
            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);

            bool isNewPlayer = stats.JoinTime == 0;
            if (isNewPlayer)
            {
                stats.JoinTime = Runtime.Time;
                BigInteger totalPlayers = AppGetInt(appId, CD_PREFIX_TOTAL_PLAYERS);
                AppPut(appId, CD_PREFIX_TOTAL_PLAYERS, totalPlayers + 1);
            }

            stats.TotalKeysOwned += keyCount;
            stats.TotalSpent += spent;
            stats.RoundsPlayed += 1;
            stats.LastActivityTime = Runtime.Time;

            if (spent > stats.HighestSinglePurchase)
            {
                stats.HighestSinglePurchase = spent;
            }

            StoreCountdownPlayerStats(appId, player, stats);

            // Badge checks
            CheckCountdownBadges(appId, player, stats);
        }

        /// <summary>Award badges based on player milestones.</summary>
        private static void CheckCountdownBadges(string appId, UInt160 player, CountdownPlayerStats stats)
        {
            if (stats.TotalKeysOwned >= 1)
                AwardCountdownBadge(appId, player, 1, "First Key");
            if (stats.TotalKeysOwned >= 100)
                AwardCountdownBadge(appId, player, 2, "Key Collector");
            if (stats.TotalSpent >= 1000000000)
                AwardCountdownBadge(appId, player, 3, "Big Spender");
            if (stats.RoundsWon >= 1)
                AwardCountdownBadge(appId, player, 4, "Winner");
            if (stats.RoundsWon >= 5)
                AwardCountdownBadge(appId, player, 5, "Champion");
            if (stats.TotalSpent >= 10000000000)
                AwardCountdownBadge(appId, player, 6, "Whale");
        }

        /// <summary>Award a badge if not already held.</summary>
        private static void AwardCountdownBadge(string appId, UInt160 player, BigInteger badgeType, string badgeName)
        {
            byte[] badgeKey = (byte[])Helper.Concat(
                (ByteString)AppKey(appId, CD_PREFIX_PLAYER_BADGES, player),
                (ByteString)badgeType.ToByteArray());

            if ((BigInteger)Storage.Get(Storage.CurrentContext, badgeKey) == 1) return;

            Storage.Put(Storage.CurrentContext, badgeKey, 1);

            CountdownPlayerStats stats = LoadCountdownPlayerStats(appId, player);
            stats.BadgeCount += 1;
            StoreCountdownPlayerStats(appId, player, stats);

            OnCountdownBadge(appId, player, badgeType, badgeName);
        }

        // ---------------------------------------------------------------
        //  Countdown storage load/store
        // ---------------------------------------------------------------

        private static void StoreCountdownRound(string appId, BigInteger roundId, CountdownRound round)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_ROUNDS, roundId),
                StdLib.Serialize(round));
        }

        private static CountdownRound LoadCountdownRound(string appId, BigInteger roundId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_ROUNDS, roundId));
            if (data == null) return new CountdownRound();
            return (CountdownRound)StdLib.Deserialize(data);
        }

        private static void StoreCountdownPlayerStats(string appId, UInt160 player, CountdownPlayerStats stats)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_PLAYER_STATS, player),
                StdLib.Serialize(stats));
        }

        private static CountdownPlayerStats LoadCountdownPlayerStats(string appId, UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, CD_PREFIX_PLAYER_STATS, player));
            if (data == null) return new CountdownPlayerStats();
            return (CountdownPlayerStats)StdLib.Deserialize(data);
        }
    }
}
