using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Scratch Ticket Methods

        /// <summary>
        /// Buy an instant scratch ticket
        /// Prize is pre-determined at purchase using deterministic seed
        /// </summary>
        public static BigInteger BuyScratchTicket(
            UInt160 player,
            byte lotteryType,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(player);

            // Validate lottery type is instant
            LotteryConfig config = GetLotteryConfig(lotteryType);
            ExecutionEngine.Assert(config.Enabled, "lottery type disabled");
            ExecutionEngine.Assert(config.IsInstant, "not instant lottery");

            // Validate authorization
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Validate payment
            ValidatePaymentReceipt(APP_ID, player, config.TicketPrice, receiptId);

            // Generate ticket ID
            BigInteger ticketId = GetNextScratchId();

            // Generate deterministic seed for prize calculation
            // Seed = Hash(blockHash + txHash + ticketId + player)
            ByteString seed = GenerateScratchSeed(ticketId, player);
            ByteString hash = CryptoLib.Sha256(seed);
            byte[] hashBytes = (byte[])hash;

            // Convert first 8 bytes to positive BigInteger (same pattern as SelectWinner)
            BigInteger seedNumber = 0;
            for (int i = 0; i < 8; i++)
            {
                seedNumber = seedNumber * 256 + hashBytes[i];
            }

            // Pre-calculate prize (determined at purchase, not reveal)
            BigInteger prize = CalculatePrize(lotteryType, seedNumber);

            // Create and store ticket
            ScratchTicket ticket = new ScratchTicket
            {
                Id = ticketId,
                Player = player,
                Type = lotteryType,
                PurchaseTime = Runtime.Time,
                Scratched = false,
                Prize = prize,
                Seed = seedNumber
            };
            StoreScratchTicket(ticketId, ticket);

            // Add to player's scratch tickets
            AddPlayerScratchTicket(player, ticketId);

            // Update type pool stats
            UpdateTypePoolStats(lotteryType, config.TicketPrice);

            // Emit event
            OnScratchTicketPurchased(player, ticketId, lotteryType, config.TicketPrice);

            return ticketId;
        }

        /// <summary>
        /// Reveal/scratch a ticket to see the prize
        /// </summary>
        public static Map<string, object> RevealScratchTicket(UInt160 player, BigInteger ticketId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(player);

            // Validate authorization
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Get ticket
            ScratchTicket ticket = GetScratchTicket(ticketId);
            ExecutionEngine.Assert(ticket.Id > 0, "ticket not found");
            ExecutionEngine.Assert(ticket.Player == player, "not ticket owner");
            ExecutionEngine.Assert(!ticket.Scratched, "already scratched");

            // Mark as scratched
            ticket.Scratched = true;
            StoreScratchTicket(ticketId, ticket);

            bool isWinner = ticket.Prize > 0;

            // Process payout if winner
            if (isWinner)
            {
                bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, player, ticket.Prize);
                ExecutionEngine.Assert(transferred, "payout failed");

                // Update stats
                UpdateScratchWinStats(player, ticket.Type, ticket.Prize);
            }

            // Emit event
            OnScratchTicketRevealed(player, ticketId, ticket.Prize, isWinner);

            // Return result
            Map<string, object> result = new Map<string, object>();
            result["ticketId"] = ticketId;
            result["lotteryType"] = ticket.Type;
            result["isWinner"] = isWinner;
            result["prize"] = ticket.Prize;
            result["purchaseTime"] = ticket.PurchaseTime;

            return result;
        }

        #endregion

        #region Scratch Ticket Storage

        private static BigInteger GetNextScratchId()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_SCRATCH_ID);
            BigInteger id = data == null ? 0 : (BigInteger)data;
            id += 1;
            Storage.Put(Storage.CurrentContext, PREFIX_SCRATCH_ID, id);
            return id;
        }

        private static void StoreScratchTicket(BigInteger ticketId, ScratchTicket ticket)
        {
            byte[] key = Helper.Concat(PREFIX_SCRATCH_TICKET, (ByteString)ticketId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(ticket));
        }

        [Safe]
        public static ScratchTicket GetScratchTicket(BigInteger ticketId)
        {
            byte[] key = Helper.Concat(PREFIX_SCRATCH_TICKET, (ByteString)ticketId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            if (data == null)
            {
                return new ScratchTicket();
            }
            return (ScratchTicket)StdLib.Deserialize(data);
        }

        #endregion

        #region Player Scratch Tickets

        private static void AddPlayerScratchTicket(UInt160 player, BigInteger ticketId)
        {
            // Store ticket ID in player's list
            byte[] key = Helper.Concat(PREFIX_PLAYER_SCRATCH, (ByteString)player);
            key = Helper.Concat(key, (ByteString)ticketId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, 1);

            // Increment player's scratch count
            byte[] countKey = Helper.Concat(PREFIX_PLAYER_SCRATCH_COUNT, (ByteString)player);
            ByteString countData = Storage.Get(Storage.CurrentContext, countKey);
            BigInteger count = countData == null ? 0 : (BigInteger)countData;
            Storage.Put(Storage.CurrentContext, countKey, count + 1);
        }

        [Safe]
        public static BigInteger GetPlayerScratchCount(UInt160 player)
        {
            byte[] key = Helper.Concat(PREFIX_PLAYER_SCRATCH_COUNT, (ByteString)player);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        #endregion
    }
}
