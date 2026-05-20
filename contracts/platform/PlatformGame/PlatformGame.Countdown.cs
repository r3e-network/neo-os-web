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
        private const long CD_BASE_KEY_PRICE       = 10000000;       // 0.1 GAS
        private const int CD_KEY_PRICE_INCREMENT_BPS = 10;
        // Runtime.Time on Neo N3 is BLOCK TIMESTAMP IN MILLISECONDS. Every
        // duration below is expressed in ms so the round-end checks
        // (`Runtime.Time >= round.EndTime`) actually measure the documented
        // wall-clock interval. Previously these were seconds, giving a
        // ~24-second effective round instead of 24 hours.
        private const long CD_TIME_PER_KEY_MS      = 86400000L;      // 24h per key buy
        private const long CD_INITIAL_DURATION_MS  = 86400000L;      // 24 hours
        private const long CD_MAX_DURATION_MS      = 86400000L;      // 24 hours
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
        // Per-buy 5% platform fee accumulator. Without this the fee was siphoned
        // off into untracked contract balance — admin could never recover it.
        private static readonly byte[] CD_PREFIX_PLATFORM_FEES      = new byte[] { 0xAA };

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
        public delegate void CountdownPlatformFeesWithdrawnHandler(string appId, UInt160 to, BigInteger amount);

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

        [DisplayName("CountdownPlatformFeesWithdrawn")]
        public static event CountdownPlatformFeesWithdrawnHandler OnCountdownPlatformFeesWithdrawn;

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

            // Track the 5% platform fee in a per-app accumulator so admin can sweep
            // it via WithdrawCountdownPlatformFees. Previously the fee was just
            // subtracted from the pot contribution and sat untracked in contract
            // GAS balance forever.
            BigInteger platformFee = cost - potContribution;
            if (platformFee > 0)
            {
                ByteString feeKey = AppKey(appId, CD_PREFIX_PLATFORM_FEES);
                BigInteger accumulated = (BigInteger)Storage.Get(Storage.CurrentContext, feeKey);
                Storage.Put(Storage.CurrentContext, feeKey, accumulated + platformFee);
            }

            // Extend timer (capped at max duration from now)
            BigInteger timeToAdd = keyCount * CD_TIME_PER_KEY_MS;
            BigInteger newEndTime = round.EndTime + timeToAdd;
            BigInteger maxEndTime = Runtime.Time + CD_MAX_DURATION_MS;
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
        /// Sweep the accumulated 5% per-buy platform fee to a designated recipient.
        /// Same admin-gated pattern as the capsule and abandoned-loan sweeps.
        /// Without this the platform-fee portion of every Countdown buy would be
        /// permanently locked in the contract.
        /// </summary>
        public static void WithdrawCountdownPlatformFees(string appId, UInt160 to)
        {
            RequireRegistered(appId);
            RequireAppAdminOrPlatformAdmin(appId);
            ValidateAddress(to);

            ByteString feeKey = AppKey(appId, CD_PREFIX_PLATFORM_FEES);
            BigInteger amount = (BigInteger)Storage.Get(Storage.CurrentContext, feeKey);
            ExecutionEngine.Assert(amount > 0, "no platform fees");

            Storage.Put(Storage.CurrentContext, feeKey, 0);

            ExecutionEngine.Assert(
                GAS.Transfer(Runtime.ExecutingScriptHash, to, amount),
                "platform fee transfer failed");

            OnCountdownPlatformFeesWithdrawn(appId, to, amount);
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
    }
}
