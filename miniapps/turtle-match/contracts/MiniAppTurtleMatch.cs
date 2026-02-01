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
    // Hybrid Architecture: Only initial state (StartGame) and final state (SettleGame) on-chain
    // Middle process (game calculation) happens on frontend using deterministic seed
    /// <summary>Event emitted when game started.</summary>
    public delegate void GameStartedHandler(UInt160 player, BigInteger sessionId, BigInteger boxCount, string seed);
    /// <summary>Event emitted when game settled.</summary>
    public delegate void GameSettledHandler(UInt160 player, BigInteger sessionId, BigInteger totalMatches, BigInteger reward);

    [DisplayName("MiniAppTurtleMatch")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Turtle Match blindbox game with color matching")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    public partial class MiniAppTurtleMatch : MiniAppGameComputeBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the turtle-match miniapp.</summary>
        private const string APP_ID = "miniapp-turtle-match";
        private const string SCRIPT_MATCH_LOGIC = "turtle-match-logic";
        private const int PLATFORM_FEE_PERCENT = 5;
        /// <summary>Configuration constant .</summary>
        private const long BLINDBOX_PRICE = 10000000; // 0.1 GAS
        private const int GRID_SIZE = 9;              // 3x3 grid
        private const int MAX_QUEUE_SIZE = 10;
        private const int COLOR_COUNT = 8;
        private const int MIN_BLINDBOXES = 3;
        private const int MAX_BLINDBOXES = 20;
        #endregion

        #region Turtle Colors
        public enum TurtleColor : byte
        {
            Red = 0,      // Common - 20%
            Orange = 1,   // Common - 20%
            Yellow = 2,   // Common - 18%
            Green = 3,    // Uncommon - 15%
            Blue = 4,     // Uncommon - 12%
            Purple = 5,   // Rare - 8%
            Pink = 6,     // Rare - 5%
            Gold = 7      // Legendary - 2%
        }
        #endregion

        #region Color Odds (cumulative, out of 100)
        private static readonly BigInteger[] COLOR_ODDS = new BigInteger[]
        {
            20,  // Red: 0-19 (20%)
            40,  // Orange: 20-39 (20%)
            58,  // Yellow: 40-57 (18%)
            73,  // Green: 58-72 (15%)
            85,  // Blue: 73-84 (12%)
            93,  // Purple: 85-92 (8%)
            98,  // Pink: 93-97 (5%)
            100  // Gold: 98-99 (2%)
        };
        #endregion

        #region Color Rewards (in GAS units, 1 GAS = 100000000)
        private static readonly BigInteger[] COLOR_REWARDS = new BigInteger[]
        {
            15000000,   // Red: 0.15 GAS
            15000000,   // Orange: 0.15 GAS
            18000000,   // Yellow: 0.18 GAS
            20000000,   // Green: 0.20 GAS
            25000000,   // Blue: 0.25 GAS
            35000000,   // Purple: 0.35 GAS
            50000000,   // Pink: 0.50 GAS
            100000000   // Gold: 1.00 GAS
        };
        #endregion

        #region App Prefixes (0x40+ to avoid collision with MiniAppGameComputeBase 0x30-0x3F)
        /// <summary>Storage prefix for session.</summary>
        private static readonly byte[] PREFIX_SESSION = new byte[] { 0x40 };
        /// <summary>Storage prefix for session id.</summary>
        private static readonly byte[] PREFIX_SESSION_ID = new byte[] { 0x41 };
        /// <summary>Storage prefix for player sessions.</summary>
        private static readonly byte[] PREFIX_PLAYER_SESSIONS = new byte[] { 0x42 };
        /// <summary>Storage prefix for player session count.</summary>
        private static readonly byte[] PREFIX_PLAYER_SESSION_COUNT = new byte[] { 0x43 };
        /// <summary>Storage prefix for total sessions.</summary>
        private static readonly byte[] PREFIX_TOTAL_SESSIONS = new byte[] { 0x44 };
        /// <summary>Storage prefix for total boxes.</summary>
        private static readonly byte[] PREFIX_TOTAL_BOXES = new byte[] { 0x45 };
        /// <summary>Storage prefix for total matches.</summary>
        private static readonly byte[] PREFIX_TOTAL_MATCHES = new byte[] { 0x46 };
        /// <summary>Storage prefix for total paid.</summary>
        private static readonly byte[] PREFIX_TOTAL_PAID = new byte[] { 0x47 };
        #endregion

        #region Data Structures
        // Simplified session - only initial and final state
        public struct GameSession
        {
            public BigInteger SessionId;
            public UInt160 Player;
            public BigInteger BoxCount;         // Number of blindboxes purchased
            public ByteString Seed;             // Random seed for deterministic generation
            public BigInteger Payment;          // Amount paid
            public BigInteger StartTime;
            public bool Settled;                // Whether game is settled
            public BigInteger TotalMatches;     // Final: number of matches
            public BigInteger TotalReward;      // Final: reward amount
            public BigInteger SettleTime;       // When settled
        }

        // Match result for settlement verification
        public struct MatchResult
        {
            public BigInteger Color;
            public BigInteger Count;            // How many pairs of this color matched
        }

        public struct PlatformStats
        {
            public BigInteger TotalSessions;
            public BigInteger TotalBoxesSold;
            public BigInteger TotalMatches;
            public BigInteger TotalPaid;
            public BigInteger TotalPlayers;
        }
        #endregion

        #region Events
        [DisplayName("GameStarted")]
        public static event GameStartedHandler OnGameStarted;

        [DisplayName("GameSettled")]
        public static event GameSettledHandler OnGameSettled;
        #endregion

        #region Lifecycle
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_SESSION_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SESSIONS, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_BOXES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_MATCHES, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAID, 0);
        }
        #endregion

        #region Read Methods
        [Safe]
        public static BigInteger GetSessionCount() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_SESSION_ID);

        [Safe]
        public static BigInteger GetTotalSessions() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SESSIONS);

        [Safe]
        public static BigInteger GetTotalBoxes() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_BOXES);

        [Safe]
        public static BigInteger GetTotalMatches() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_MATCHES);

        [Safe]
        public static BigInteger GetTotalPaid() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PAID);

        [Safe]
        public static BigInteger GetBlindboxPrice() => BLINDBOX_PRICE;

        [Safe]
        public static BigInteger GetColorReward(BigInteger color)
        {
            if (color < 0 || color >= COLOR_COUNT) return 0;
            return COLOR_REWARDS[(int)color];
        }

        [Safe]
        public static Map<string, object> GetColorInfo()
        {
            Map<string, object> info = new Map<string, object>();
            info["count"] = COLOR_COUNT;
            // info["odds"] = COLOR_ODDS;
            // info["rewards"] = COLOR_REWARDS;
            return info;
        }
        #endregion
    }
}
