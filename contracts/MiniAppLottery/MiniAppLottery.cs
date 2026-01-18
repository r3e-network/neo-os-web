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
    public delegate void TicketPurchasedHandler(UInt160 player, BigInteger ticketCount, BigInteger roundId);
    public delegate void DrawInitiatedHandler(BigInteger roundId, BigInteger requestId);
    public delegate void WinnerDrawnHandler(UInt160 winner, BigInteger prize, BigInteger roundId);
    public delegate void RoundCompletedHandler(BigInteger roundId, UInt160 winner, BigInteger prize, BigInteger totalTickets);
    public delegate void AchievementUnlockedHandler(UInt160 player, BigInteger achievementId, string achievementName);
    public delegate void JackpotRolloverHandler(BigInteger roundId, BigInteger rolloverAmount);

    // Multi-type lottery event delegates
    public delegate void ScratchTicketPurchasedHandler(UInt160 player, BigInteger ticketId, byte lotteryType, BigInteger price);
    public delegate void ScratchTicketRevealedHandler(UInt160 player, BigInteger ticketId, BigInteger prize, bool isWinner);
    public delegate void TypeTicketPurchasedHandler(UInt160 player, byte lotteryType, BigInteger ticketCount, BigInteger roundId);

    [DisplayName("MiniAppLottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "3.0.0")]
    [ManifestExtra("Description", "Lottery jackpot gaming with provable random draws")]
    [ContractPermission("*", "*")]
    public partial class MiniAppLottery : MiniAppGameComputeBase
    {
        #region App Constants
        private const string APP_ID = "miniapp-lottery";
        private const long TICKET_PRICE = 10000000;
        private const int PLATFORM_FEE_PERCENT = 10;
        private const int MAX_TICKETS_PER_TX = 100;
        private const int MIN_PARTICIPANTS = 3;
        private const long BIG_WIN_THRESHOLD = 1000000000;
        #endregion

        #region App Storage Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase)
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_POOL = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x42 };
        private static readonly byte[] PREFIX_TICKET_COUNT = new byte[] { 0x43 };
        private static readonly byte[] PREFIX_PARTICIPANTS = new byte[] { 0x44 };
        private static readonly byte[] PREFIX_DRAW_PENDING = new byte[] { 0x45 };
        private static readonly byte[] PREFIX_PARTICIPANT_COUNT = new byte[] { 0x46 };
        private static readonly byte[] PREFIX_PLAYER_STATS = new byte[] { 0x47 };
        private static readonly byte[] PREFIX_ROUND_DATA = new byte[] { 0x48 };
        private static readonly byte[] PREFIX_ACHIEVEMENTS = new byte[] { 0x49 };
        private static readonly byte[] PREFIX_TOTAL_PLAYERS = new byte[] { 0x4A };
        private static readonly byte[] PREFIX_TOTAL_PRIZES = new byte[] { 0x4B };
        private static readonly byte[] PREFIX_ROLLOVER = new byte[] { 0x4C };

        // Multi-type lottery storage prefixes (0x50-0x5F)
        private static readonly byte[] PREFIX_LOTTERY_CONFIG = new byte[] { 0x50 };
        private static readonly byte[] PREFIX_SCRATCH_TICKET = new byte[] { 0x51 };
        private static readonly byte[] PREFIX_SCRATCH_ID = new byte[] { 0x52 };
        private static readonly byte[] PREFIX_TYPE_POOL = new byte[] { 0x53 };
        private static readonly byte[] PREFIX_TYPE_STATS = new byte[] { 0x54 };
        private static readonly byte[] PREFIX_PLAYER_SCRATCH = new byte[] { 0x55 };
        private static readonly byte[] PREFIX_TYPE_ROUND = new byte[] { 0x56 };
        private static readonly byte[] PREFIX_PLAYER_SCRATCH_COUNT = new byte[] { 0x57 };
        #endregion

        #region App Events

        [DisplayName("TicketPurchased")]
        public static event TicketPurchasedHandler OnTicketPurchased;

        [DisplayName("DrawInitiated")]
        public static event DrawInitiatedHandler OnDrawInitiated;

        [DisplayName("WinnerDrawn")]
        public static event WinnerDrawnHandler OnWinnerDrawn;

        [DisplayName("RoundCompleted")]
        public static event RoundCompletedHandler OnRoundCompleted;

        [DisplayName("AchievementUnlocked")]
        public static event AchievementUnlockedHandler OnAchievementUnlocked;

        [DisplayName("JackpotRollover")]
        public static event JackpotRolloverHandler OnJackpotRollover;

        // Multi-type lottery events
        [DisplayName("ScratchTicketPurchased")]
        public static event ScratchTicketPurchasedHandler OnScratchTicketPurchased;

        [DisplayName("ScratchTicketRevealed")]
        public static event ScratchTicketRevealedHandler OnScratchTicketRevealed;

        [DisplayName("TypeTicketPurchased")]
        public static event TypeTicketPurchasedHandler OnTypeTicketPurchased;

        #endregion

        #region Data Structures

        public struct PlayerStats
        {
            public BigInteger TotalTickets;
            public BigInteger TotalSpent;
            public BigInteger TotalWins;
            public BigInteger TotalWon;
            public BigInteger RoundsPlayed;
            public BigInteger ConsecutiveWins;
            public BigInteger BestWinStreak;
            public BigInteger HighestWin;
            public BigInteger AchievementCount;
            public BigInteger JoinTime;
            public BigInteger LastPlayTime;
        }

        public struct RoundData
        {
            public BigInteger Id;
            public BigInteger TotalTickets;
            public BigInteger PrizePool;
            public BigInteger ParticipantCount;
            public UInt160 Winner;
            public BigInteger WinnerPrize;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public bool Completed;
        }

        #endregion

        #region Multi-Type Lottery System

        /// <summary>
        /// Lottery types - 中国福彩风格
        /// </summary>
        public enum LotteryType : byte
        {
            ScratchWin = 0,      // 福彩刮刮乐 - Instant
            DoubleColor = 1,     // 双色球 - Scheduled
            Happy8 = 2,          // 快乐8 - Instant
            Lucky7 = 3,          // 七乐彩 - Scheduled
            SuperLotto = 4,      // 大乐透 - Scheduled
            Supreme = 5          // 至尊彩 - Scheduled
        }

        /// <summary>
        /// Configuration for each lottery type
        /// </summary>
        public struct LotteryConfig
        {
            public byte Type;
            public BigInteger TicketPrice;
            public bool IsInstant;
            public BigInteger MaxJackpot;
            public bool Enabled;
            public BigInteger PrizePool;
            public BigInteger JackpotRate;
            public BigInteger Tier1Rate;
            public BigInteger Tier2Rate;
            public BigInteger Tier3Rate;
            public BigInteger JackpotPrize;
            public BigInteger Tier1Prize;
            public BigInteger Tier2Prize;
            public BigInteger Tier3Prize;
        }

        /// <summary>
        /// Scratch ticket data
        /// </summary>
        public struct ScratchTicket
        {
            public BigInteger Id;
            public UInt160 Player;
            public byte Type;
            public BigInteger PurchaseTime;
            public bool Scratched;
            public BigInteger Prize;
            public BigInteger Seed;
        }

        /// <summary>
        /// Type-specific round data
        /// </summary>
        public struct TypeRoundData
        {
            public byte Type;
            public BigInteger RoundId;
            public BigInteger TotalTickets;
            public BigInteger PrizePool;
            public BigInteger ParticipantCount;
            public BigInteger StartTime;
            public bool DrawPending;
        }

        #endregion
    }
}
