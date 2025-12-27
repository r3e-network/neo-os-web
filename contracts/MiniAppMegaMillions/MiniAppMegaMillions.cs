using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Event delegates with meaningful parameter names
    public delegate void TicketPurchasedHandler(UInt160 player, BigInteger roundId, byte[] mainNumbers, byte megaBall);
    public delegate void DrawCompletedHandler(BigInteger roundId, byte[] winningNumbers, BigInteger jackpotPool);
    public delegate void PrizeWonHandler(UInt160 player, BigInteger roundId, int tier, BigInteger amount);
    public delegate void JackpotWonHandler(UInt160 player, BigInteger roundId, BigInteger amount);

    /// <summary>
    /// MegaMillions Lottery - Multi-tier winning system
    ///
    /// Game Rules:
    /// - Pick 5 numbers from 1-70 (main numbers)
    /// - Pick 1 Mega Ball from 1-25
    /// - Match combinations for different prize tiers
    ///
    /// Prize Tiers (9 levels):
    /// 1. Jackpot:     5 + Mega = Jackpot Pool (starts 1000 GAS)
    /// 2. Match 5:     5 + 0    = 100 GAS
    /// 3. Match 4+M:   4 + Mega = 50 GAS
    /// 4. Match 4:     4 + 0    = 5 GAS
    /// 5. Match 3+M:   3 + Mega = 2 GAS
    /// 6. Match 3:     3 + 0    = 0.5 GAS
    /// 7. Match 2+M:   2 + Mega = 0.5 GAS
    /// 8. Match 1+M:   1 + Mega = 0.2 GAS
    /// 9. Match 0+M:   0 + Mega = 0.1 GAS
    /// </summary>
    [DisplayName("MiniAppMegaMillions")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Multi-tier MegaMillions lottery with 9 prize levels")]
    public class MiniAppMegaMillions : SmartContract
    {
        // Storage prefixes
        private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_ROUND = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TICKET = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_JACKPOT = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_CONFIG = new byte[] { 0x06 };

        // Constants
        private const int MAIN_NUMBERS_COUNT = 5;
        private const int MAIN_NUMBERS_MAX = 70;
        private const int MEGA_BALL_MAX = 25;
        private const long TICKET_PRICE = 20000000; // 0.2 GAS
        private const long INITIAL_JACKPOT = 100000000000; // 1000 GAS

        // Prize tiers (in GAS with 8 decimals)
        private static readonly long[] PRIZE_AMOUNTS = new long[]
        {
            0,              // Tier 0: Jackpot (dynamic)
            10000000000,    // Tier 1: 5+0 = 100 GAS
            5000000000,     // Tier 2: 4+M = 50 GAS
            500000000,      // Tier 3: 4+0 = 5 GAS
            200000000,      // Tier 4: 3+M = 2 GAS
            50000000,       // Tier 5: 3+0 = 0.5 GAS
            50000000,       // Tier 6: 2+M = 0.5 GAS
            20000000,       // Tier 7: 1+M = 0.2 GAS
            10000000        // Tier 8: 0+M = 0.1 GAS
        };

        // Structs
        public struct Ticket
        {
            public UInt160 Player;
            public BigInteger RoundId;
            public byte[] MainNumbers; // 5 numbers (1-70)
            public byte MegaBall;      // 1 number (1-25)
            public ulong PurchaseTime;
        }

        public struct Round
        {
            public BigInteger RoundId;
            public ulong StartTime;
            public ulong DrawTime;
            public BigInteger TicketCount;
            public BigInteger JackpotPool;
            public byte[] WinningNumbers; // 5 main + 1 mega
            public bool IsDrawn;
        }

        // Events
        [DisplayName("TicketPurchased")]
        public static event TicketPurchasedHandler OnTicketPurchased;

        [DisplayName("DrawCompleted")]
        public static event DrawCompletedHandler OnDrawCompleted;

        [DisplayName("PrizeWon")]
        public static event PrizeWonHandler OnPrizeWon;

        [DisplayName("JackpotWon")]
        public static event JackpotWonHandler OnJackpotWon;

        // Deploy
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            var tx = Runtime.Transaction;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, tx.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, INITIAL_JACKPOT);
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, 1);
        }

        // Admin functions
        public static UInt160 Admin() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_ADMIN);

        public static void SetGateway(UInt160 gateway)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Admin()), "unauthorized");
            Storage.Put(Storage.CurrentContext, PREFIX_GATEWAY, gateway);
        }

        public static UInt160 Gateway() => (UInt160)Storage.Get(Storage.CurrentContext, PREFIX_GATEWAY);

        // Get current round
        public static BigInteger CurrentRound() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_ROUND);

        // Get jackpot pool
        public static BigInteger JackpotPool() => (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_JACKPOT);

        /// <summary>
        /// Purchase a ticket with chosen numbers
        /// </summary>
        public static void BuyTicket(UInt160 player, byte[] mainNumbers, byte megaBall)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Gateway()), "only gateway");
            ExecutionEngine.Assert(player.IsValid, "invalid player");
            ExecutionEngine.Assert(mainNumbers.Length == MAIN_NUMBERS_COUNT, "need 5 numbers");
            ExecutionEngine.Assert(megaBall >= 1 && megaBall <= MEGA_BALL_MAX, "mega 1-25");

            // Validate main numbers
            for (int i = 0; i < MAIN_NUMBERS_COUNT; i++)
            {
                ExecutionEngine.Assert(mainNumbers[i] >= 1 && mainNumbers[i] <= MAIN_NUMBERS_MAX, "main 1-70");
            }

            BigInteger roundId = CurrentRound();
            BigInteger jackpot = JackpotPool();

            // Add to jackpot (50% of ticket price)
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, jackpot + TICKET_PRICE / 2);

            OnTicketPurchased(player, roundId, mainNumbers, megaBall);
        }

        /// <summary>
        /// Draw winning numbers using VRF randomness
        /// </summary>
        public static void Draw(ByteString randomness)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Gateway()), "only gateway");
            ExecutionEngine.Assert(randomness.Length >= 32, "need randomness");

            BigInteger roundId = CurrentRound();
            BigInteger jackpot = JackpotPool();

            // Generate winning numbers from randomness
            byte[] winning = new byte[6];
            for (int i = 0; i < 5; i++)
            {
                winning[i] = (byte)(((byte)randomness[i * 4] % MAIN_NUMBERS_MAX) + 1);
            }
            winning[5] = (byte)(((byte)randomness[20] % MEGA_BALL_MAX) + 1);

            // Start new round
            Storage.Put(Storage.CurrentContext, PREFIX_ROUND, roundId + 1);

            OnDrawCompleted(roundId, winning, jackpot);
        }

        /// <summary>
        /// Calculate prize tier based on matches
        /// Returns: 0=Jackpot, 1-8=other tiers, 9=no win
        /// </summary>
        public static int CalculateTier(byte[] ticket, byte ticketMega, byte[] winning)
        {
            int mainMatches = 0;
            bool megaMatch = (ticketMega == winning[5]);

            // Count main number matches
            for (int i = 0; i < 5; i++)
            {
                for (int j = 0; j < 5; j++)
                {
                    if (ticket[i] == winning[j])
                    {
                        mainMatches++;
                        break;
                    }
                }
            }

            // Determine tier
            if (mainMatches == 5 && megaMatch) return 0;  // Jackpot
            if (mainMatches == 5) return 1;               // 5+0
            if (mainMatches == 4 && megaMatch) return 2;  // 4+M
            if (mainMatches == 4) return 3;               // 4+0
            if (mainMatches == 3 && megaMatch) return 4;  // 3+M
            if (mainMatches == 3) return 5;               // 3+0
            if (mainMatches == 2 && megaMatch) return 6;  // 2+M
            if (mainMatches == 1 && megaMatch) return 7;  // 1+M
            if (megaMatch) return 8;                      // 0+M
            return 9; // No win
        }

        /// <summary>
        /// Claim prize for a winning ticket
        /// </summary>
        public static BigInteger ClaimPrize(UInt160 player, byte[] ticket, byte mega, byte[] winning)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Gateway()), "only gateway");

            int tier = CalculateTier(ticket, mega, winning);
            if (tier == 9) return 0;

            BigInteger prize;
            if (tier == 0)
            {
                prize = JackpotPool();
                Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT, INITIAL_JACKPOT);
                OnJackpotWon(player, CurrentRound() - 1, prize);
            }
            else
            {
                prize = PRIZE_AMOUNTS[tier];
                OnPrizeWon(player, CurrentRound() - 1, tier, prize);
            }
            return prize;
        }

        /// <summary>
        /// Get prize amount for a tier
        /// </summary>
        public static BigInteger GetPrizeAmount(int tier)
        {
            if (tier == 0) return JackpotPool();
            if (tier >= 1 && tier <= 8) return PRIZE_AMOUNTS[tier];
            return 0;
        }
    }
}