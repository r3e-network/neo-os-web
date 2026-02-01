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
    /// Event emitted when a player purchases lottery tickets.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="ticketCount">Number of tickets purchased</param>
    /// <param name="roundId">The round ID tickets were purchased for</param>
    public delegate void TicketPurchasedHandler(UInt160 player, BigInteger ticketCount, BigInteger roundId);
    
    /// <summary>
    /// Event emitted when a draw is initiated via oracle RNG request.
    /// </summary>
    /// <param name="roundId">The round being drawn</param>
    /// <param name="requestId">Oracle RNG request ID</param>
    public delegate void DrawInitiatedHandler(BigInteger roundId, BigInteger requestId);
    
    /// <summary>
    /// Event emitted when a winner is drawn.
    /// </summary>
    /// <param name="winner">The winning player's address</param>
    /// <param name="prize">Prize amount in GAS</param>
    /// <param name="roundId">The round ID</param>
    public delegate void WinnerDrawnHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
    
    /// <summary>
    /// Event emitted when a round completes.
    /// </summary>
    /// <param name="roundId">The completed round ID</param>
    /// <param name="winner">The winning player's address</param>
    /// <param name="prize">Total prize amount in GAS</param>
    /// <param name="totalTickets">Total tickets sold in the round</param>
    public delegate void RoundCompletedHandler(BigInteger roundId, UInt160 winner, BigInteger prize, BigInteger totalTickets);
    
    /// <summary>
    /// Event emitted when a player unlocks an achievement.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="achievementId">Achievement identifier</param>
    /// <param name="achievementName">Achievement name</param>
    public delegate void AchievementUnlockedHandler(UInt160 player, BigInteger achievementId, string achievementName);
    
    /// <summary>
    /// Event emitted when jackpot rolls over to next round.
    /// </summary>
    /// <param name="roundId">The round where rollover occurred</param>
    /// <param name="rolloverAmount">Amount rolled over in GAS</param>
    public delegate void JackpotRolloverHandler(BigInteger roundId, BigInteger rolloverAmount);

    // Multi-type lottery event delegates
    
    /// <summary>
    /// Event emitted when a scratch ticket is purchased.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="ticketId">Unique ticket identifier</param>
    /// <param name="lotteryType">Type of lottery (0-5)</param>
    /// <param name="price">Ticket price in GAS</param>
    public delegate void ScratchTicketPurchasedHandler(UInt160 player, BigInteger ticketId, byte lotteryType, BigInteger price);
    
    /// <summary>
    /// Event emitted when a scratch ticket is revealed.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="ticketId">The ticket identifier</param>
    /// <param name="prize">Prize amount in GAS (0 if no win)</param>
    /// <param name="isWinner">Whether the ticket is a winner</param>
    public delegate void ScratchTicketRevealedHandler(UInt160 player, BigInteger ticketId, BigInteger prize, bool isWinner);
    
    /// <summary>
    /// Event emitted when type-specific tickets are purchased.
    /// </summary>
    /// <param name="player">The player's address</param>
    /// <param name="lotteryType">Type of lottery</param>
    /// <param name="ticketCount">Number of tickets</param>
    /// <param name="roundId">The round ID</param>
    public delegate void TypeTicketPurchasedHandler(UInt160 player, byte lotteryType, BigInteger ticketCount, BigInteger roundId);

    /// <summary>
    /// Lottery MiniApp - Multi-type lottery gaming system with provably fair draws.
    /// 
    /// FEATURES:
    /// - Multiple lottery types (Classic, Scratch, Double Color, Happy 8, etc.)
    /// - Provably fair random draws via oracle RNG
    /// - Progressive jackpot system with rollover
    /// - Achievement system for milestones
    /// - Player statistics and streak tracking
    /// 
    /// LOTTERY TYPES:
    /// - Classic: Traditional ticket-based lottery with scheduled draws
    /// - Scratch: Instant win scratch tickets with immediate results
    /// - Double Color Ball (双色球): Chinese lottery style with scheduled draws
    /// - Happy 8 (快乐8): Instant number matching game
    /// - Lucky 7 (七乐彩): 7-number selection lottery
    /// - Super Lotto (大乐透): Multi-tier prize structure
    /// - Supreme (至尊彩): High-stakes scheduled lottery
    /// 
    /// GAME MECHANICS:
    /// - Players buy tickets with GAS
    /// - 90% of ticket price goes to prize pool, 10% platform fee
    /// - Winner selected randomly when draw is triggered
    /// - Minimum 3 participants required for draw
    /// - Unclaimed jackpots roll over to next round
    /// 
    /// SECURITY:
    /// - Oracle-verified randomness for draws
    /// - Min/max limits on tickets per transaction
    /// - Access control on administrative functions
    /// - Reentrancy protection via state updates
    /// 
    /// PERMISSIONS:
    /// - GAS token transfers only (0xd2a4cff31913016155e38e474a2c06d08be276cf)
    /// </summary>
    [DisplayName("MiniAppLottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "Lottery jackpot gaming with provable random draws")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    public partial class MiniAppLottery : MiniAppGameComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the Lottery miniapp.</summary>
        private const string APP_ID = "miniapp-lottery";
        
        /// <summary>Price per ticket in GAS (0.1 GAS = 10,000,000).</summary>
        private const long TICKET_PRICE = 10000000;
        
        /// <summary>Platform fee percentage taken from each ticket (10%). Remaining 90% goes to prize pool.</summary>
        private const int PLATFORM_FEE_PERCENT = 10;
        
        /// <summary>Maximum tickets per transaction to prevent gas limit issues (100 tickets).</summary>
        private const int MAX_TICKETS_PER_TX = 100;
        
        /// <summary>Minimum participants required before a draw can occur (3 participants).</summary>
        private const int MIN_PARTICIPANTS = 3;
        
        /// <summary>Threshold for "big win" classification in GAS (10 GAS). Used for achievements.</summary>
        private const long BIG_WIN_THRESHOLD = 1000000000;
        #endregion

        #region App Storage Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase)
        // STORAGE LAYOUT:
        // 0x40-0x4F: Classic lottery data
        // 0x50-0x5F: Multi-type lottery data
        // Note: coin-flip uses 0x40-0x49, lottery uses overlapping range - ensure separate deployments
        
        /// <summary>Prefix 0x40: Current round ID storage.</summary>
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x40 };
        /// <summary>Prefix 0x41: Total prize pool storage.</summary>
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x41 };
        /// <summary>Prefix 0x42: Ticket ownership storage.</summary>
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x42 };
        /// <summary>Prefix 0x43: Total ticket count storage.</summary>
        private static readonly byte[] PREFIX_TICKET_COUNT = new byte[] { 0x43 };
        /// <summary>Prefix 0x44: Round participants list storage.</summary>
        private static readonly byte[] PREFIX_PARTICIPANTS = new byte[] { 0x44 };
        /// <summary>Prefix 0x45: Pending draw flag storage.</summary>
        private static readonly byte[] PREFIX_DRAW_PENDING = new byte[] { 0x45 };
        /// <summary>Prefix 0x46: Participant count storage.</summary>
        private static readonly byte[] PREFIX_PARTICIPANT_COUNT = new byte[] { 0x46 };
        /// <summary>Prefix 0x47: Player statistics storage.</summary>
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x47 };
        /// <summary>Prefix 0x48: Round data storage.</summary>
        private static readonly byte[] PREFIX_ROUND_DATA = new byte[] { 0x48 };
        /// <summary>Prefix 0x49: Player achievements storage.</summary>
        private static readonly byte[] PREFIX_ACHIEVEMENTS = new byte[] { 0x49 };
        /// <summary>Prefix 0x4A: Total players count storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x4A };
        /// <summary>Prefix 0x4B: Total prizes paid storage.</summary>
        private static readonly byte[] PREFIX_TOTAL_PRIZES = new byte[] { 0x4B };
        /// <summary>Prefix 0x4C: Rollover amount storage.</summary>
        private static readonly byte[] PREFIX_ROLLOVER = new byte[] { 0x4C };

        // Multi-type lottery storage prefixes (0x50-0x5F)
        /// <summary>Prefix 0x50: Lottery type configuration storage.</summary>
        private static readonly byte[] PREFIX_LOTTERY_CONFIG = new byte[] { 0x50 };
        /// <summary>Prefix 0x51: Scratch ticket data storage.</summary>
        private static readonly byte[] PREFIX_SCRATCH_TICKET = new byte[] { 0x51 };
        /// <summary>Prefix 0x52: Scratch ticket ID counter storage.</summary>
        private static readonly byte[] PREFIX_SCRATCH_ID = new byte[] { 0x52 };
        /// <summary>Prefix 0x53: Type-specific prize pool storage.</summary>
        private static readonly byte[] PREFIX_TYPE_POOL = new byte[] { 0x53 };
        /// <summary>Prefix 0x54: Type statistics storage.</summary>
        private static readonly byte[] PREFIX_TYPE_STATS = new byte[] { 0x54 };
        /// <summary>Prefix 0x55: Player scratch ticket ownership storage.</summary>
        private static readonly byte[] PREFIX_PLAYER_SCRATCH = new byte[] { 0x55 };
        /// <summary>Prefix 0x56: Type-specific round data storage.</summary>
        private static readonly byte[] PREFIX_TYPE_ROUND = new byte[] { 0x56 };
        /// <summary>Prefix 0x57: Player scratch ticket count storage.</summary>
        private static readonly byte[] PREFIX_PLAYER_SCRATCH_COUNT = new byte[] { 0x57 };
        #endregion

        #region App Events

        /// <summary>
        /// Emitted when tickets are purchased.
        /// Parameters: player, ticketCount, roundId
        /// </summary>
        [DisplayName("TicketPurchased")]
        public static event TicketPurchasedHandler OnTicketPurchased;

        /// <summary>
        /// Emitted when a draw is initiated via oracle.
        /// Parameters: roundId, requestId
        /// </summary>
        [DisplayName("DrawInitiated")]
        public static event DrawInitiatedHandler OnDrawInitiated;

        /// <summary>
        /// Emitted when a winner is drawn.
        /// Parameters: winner, prize, roundId
        /// </summary>
        [DisplayName("WinnerDrawn")]
        public static event WinnerDrawnHandler OnWinnerDrawn;

        /// <summary>
        /// Emitted when a round completes.
        /// Parameters: roundId, winner, prize, totalTickets
        /// </summary>
        [DisplayName("RoundCompleted")]
        public static event RoundCompletedHandler OnRoundCompleted;

        /// <summary>
        /// Emitted when a player unlocks an achievement.
        /// Parameters: player, achievementId, achievementName
        /// </summary>
        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;

        /// <summary>
        /// Emitted when jackpot rolls over to next round.
        /// Parameters: roundId, rolloverAmount
        /// </summary>
        [DisplayName("JackpotRollover")]
        public static event JackpotRolloverHandler OnJackpotRollover;

        // Multi-type lottery events
        /// <summary>
        /// Emitted when a scratch ticket is purchased.
        /// Parameters: player, ticketId, lotteryType, price
        /// </summary>
        [DisplayName("ScratchTicketPurchased")]
        public static event ScratchTicketPurchasedHandler OnScratchTicketPurchased;

        /// <summary>
        /// Emitted when a scratch ticket is revealed.
        /// Parameters: player, ticketId, prize, isWinner
        /// </summary>
        [DisplayName("ScratchTicketRevealed")]
        public static event ScratchTicketRevealedHandler OnScratchTicketRevealed;

        /// <summary>
        /// Emitted when type-specific tickets are purchased.
        /// Parameters: player, lotteryType, ticketCount, roundId
        /// </summary>
        [DisplayName("TypeTicketPurchased")]
        public static event TypeTicketPurchasedHandler OnTypeTicketPurchased;

        #endregion

        #region Data Structures

        /// <summary>
        /// Player statistics tracked across all lottery plays.
        /// 
        /// Storage: Serialized and stored with PREFIX_PLAYER_STATS + player address
        /// Updated: After each ticket purchase and win
        /// </summary>
        public struct PlayerStats
        {
            /// <summary>Total number of tickets purchased across all rounds.</summary>
            public BigInteger TotalTickets;
            /// <summary>Total amount spent on tickets in GAS.</summary>
            public BigInteger TotalSpent;
            /// <summary>Total number of winning rounds.</summary>
            public BigInteger TotalWins;
            /// <summary>Total amount won in GAS.</summary>
            public BigInteger TotalWon;
            /// <summary>Number of rounds participated in.</summary>
            public BigInteger RoundsPlayed;
            /// <summary>Current consecutive winning streak.</summary>
            public BigInteger ConsecutiveWins;
            /// <summary>Best winning streak ever achieved.</summary>
            public BigInteger BestWinStreak;
            /// <summary>Largest single win amount in GAS.</summary>
            public BigInteger HighestWin;
            /// <summary>Number of achievements unlocked.</summary>
            public BigInteger AchievementCount;
            /// <summary>Unix timestamp of first play (player join time).</summary>
            public BigInteger JoinTime;
            /// <summary>Unix timestamp of most recent play.</summary>
            public BigInteger LastPlayTime;
        }

        /// <summary>
        /// Data for a single lottery round.
        /// 
        /// Storage: Serialized and stored with PREFIX_ROUND_DATA + roundId
        /// Created: When round is initialized
        /// Updated: When tickets purchased, winner drawn, round completed
        /// </summary>
        public struct RoundData
        {
            /// <summary>Unique round identifier.</summary>
            public BigInteger Id;
            /// <summary>Total number of tickets sold in this round.</summary>
            public BigInteger TotalTickets;
            /// <summary>Total prize pool accumulated in GAS.</summary>
            public BigInteger PrizePool;
            /// <summary>Number of unique participants in this round.</summary>
            public BigInteger ParticipantCount;
            /// <summary>Address of the winner (zero address if not drawn).</summary>
            public UInt160 Winner;
            /// <summary>Prize amount won in GAS (0 if not drawn).</summary>
            public BigInteger WinnerPrize;
            /// <summary>Unix timestamp when round started.</summary>
            public BigInteger StartTime;
            /// <summary>Unix timestamp when round ended (winner drawn).</summary>
            public BigInteger EndTime;
            /// <summary>Whether the round has been completed.</summary>
            public bool Completed;
        }

        #endregion

        #region Multi-Type Lottery System

        /// <summary>
        /// Lottery types inspired by Chinese Welfare Lottery (中国福彩) system.
        /// Each type has different mechanics: instant vs scheduled, single vs multi-tier prizes.
        /// </summary>
        public enum LotteryType : byte
        {
            /// <summary>Instant scratch ticket with immediate results (刮刮乐).</summary>
            ScratchWin = 0,
            /// <summary>Scheduled draw with 6+1 number format (双色球).</summary>
            DoubleColor = 1,
            /// <summary>Instant number matching game with 20/80 format (快乐8).</summary>
            Happy8 = 2,
            /// <summary>Scheduled 7-number selection lottery (七乐彩).</summary>
            Lucky7 = 3,
            /// <summary>Scheduled multi-tier prize lottery (大乐透).</summary>
            SuperLotto = 4,
            /// <summary>High-stakes scheduled lottery with largest prizes (至尊彩).</summary>
            Supreme = 5
        }

        /// <summary>
        /// Configuration parameters for each lottery type.
        /// Defines pricing, prize structure, and payout rates.
        /// 
        /// Storage: Serialized and stored with PREFIX_LOTTERY_CONFIG + type
        /// </summary>
        public struct LotteryConfig
        {
            /// <summary>Lottery type identifier (0-5).</summary>
            public byte Type;
            /// <summary>Ticket price for this lottery type in GAS.</summary>
            public BigInteger TicketPrice;
            /// <summary>Whether results are instant (true) or scheduled (false).</summary>
            public bool IsInstant;
            /// <summary>Maximum jackpot size before forced draw in GAS.</summary>
            public BigInteger MaxJackpot;
            /// <summary>Whether this lottery type is currently enabled.</summary>
            public bool Enabled;
            /// <summary>Current prize pool for this type in GAS.</summary>
            public BigInteger PrizePool;
            /// <summary>Percentage of prize pool allocated to jackpot winner (basis points).</summary>
            public BigInteger JackpotRate;
            /// <summary>Percentage of prize pool allocated to tier 1 winners (basis points).</summary>
            public BigInteger Tier1Rate;
            /// <summary>Percentage of prize pool allocated to tier 2 winners (basis points).</summary>
            public BigInteger Tier2Rate;
            /// <summary>Percentage of prize pool allocated to tier 3 winners (basis points).</summary>
            public BigInteger Tier3Rate;
            /// <summary>Fixed jackpot prize amount in GAS (if applicable).</summary>
            public BigInteger JackpotPrize;
            /// <summary>Fixed tier 1 prize amount in GAS (if applicable).</summary>
            public BigInteger Tier1Prize;
            /// <summary>Fixed tier 2 prize amount in GAS (if applicable).</summary>
            public BigInteger Tier2Prize;
            /// <summary>Fixed tier 3 prize amount in GAS (if applicable).</summary>
            public BigInteger Tier3Prize;
        }

        /// <summary>
        /// Scratch ticket data for instant-win lottery type.
        /// 
        /// Storage: Serialized and stored with PREFIX_SCRATCH_TICKET + ticketId
        /// Created: When ticket is purchased
        /// Updated: When ticket is scratched/revealed
        /// </summary>
        public struct ScratchTicket
        {
            /// <summary>Unique ticket identifier.</summary>
            public BigInteger Id;
            /// <summary>Player who purchased the ticket.</summary>
            public UInt160 Player;
            /// <summary>Lottery type (should be 0 for ScratchWin).</summary>
            public byte Type;
            /// <summary>Unix timestamp when ticket was purchased.</summary>
            public BigInteger PurchaseTime;
            /// <summary>Whether the ticket has been scratched/revealed.</summary>
            public bool Scratched;
            /// <summary>Prize amount in GAS (0 if not a winner, set after scratching).</summary>
            public BigInteger Prize;
            /// <summary>Random seed for prize determination.</summary>
            public BigInteger Seed;
        }

        /// <summary>
        /// Round data specific to a lottery type.
        /// Used for tracking multi-type lottery rounds separately.
        /// 
        /// Storage: Serialized and stored with PREFIX_TYPE_ROUND + type + roundId
        /// </summary>
        public struct TypeRoundData
        {
            /// <summary>Lottery type identifier.</summary>
            public byte Type;
            /// <summary>Round identifier within this type.</summary>
            public BigInteger RoundId;
            /// <summary>Total tickets sold for this type in this round.</summary>
            public BigInteger TotalTickets;
            /// <summary>Prize pool accumulated for this type in GAS.</summary>
            public BigInteger PrizePool;
            /// <summary>Number of unique participants.</summary>
            public BigInteger ParticipantCount;
            /// <summary>Unix timestamp when round started.</summary>
            public BigInteger StartTime;
            /// <summary>Whether a draw is pending oracle resolution.</summary>
            public bool DrawPending;
        }

        #endregion
    }
}
