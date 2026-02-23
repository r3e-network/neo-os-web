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
    /// <summary>
    /// Highly abstract and customizable Lottery/Giveaway Contract Template.
    /// Driven entirely by instantiation parameters, enabling "No-Code" deployment.
    /// </summary>
    [DisplayName("MiniAppTemplate.Lottery")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Parameter-driven lottery and giveaway template")]
    [ContractPermission("*", "*")]
    public class TemplateLottery : MiniAppTemplate
    {
        private static readonly byte[] PREFIX_LOTTERY_STATE = new byte[] { 0x40 };
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x41 };
        private static readonly byte[] PREFIX_WINNERS = new byte[] { 0x42 };

        public struct LotteryParams
        {
            public UInt160 TokenAddress;      // Token used for tickets/prizes
            public BigInteger TicketPrice;    // 0 means free entry
            public BigInteger MaxTicketsPerUser;
            public BigInteger MaxTotalTickets;
            public ulong EndTimestamp;
            public ulong DrawTimestamp;
            public BigInteger PrizePool;      // Initial prize pool
            public BigInteger WinnerCount;
            public UInt160 OracleAddress;     // Oracle for randomness
        }

        public struct LotteryState
        {
            public bool IsDrawn;
            public BigInteger TotalTicketsSold;
            public BigInteger TotalPrizePool;
        }

        [DisplayName("LotteryDeployed")]
        public static event Action<UInt160> OnLotteryDeployed;

        [DisplayName("TicketBought")]
        public static event Action<UInt160, BigInteger> OnTicketBought;

        [DisplayName("LotteryDrawn")]
        public static event Action<BigInteger> OnLotteryDrawn;

        [DisplayName("PrizeClaimed")]
        public static event Action<UInt160, BigInteger> OnPrizeClaimed;

        public static void _deploy(object data, bool update)
        {
            if (update) return;

            InitializeTemplate(data);

            object[] initArgs = data as object[];
            if (initArgs != null && initArgs.Length > 1)
            {
                ByteString paramsRaw = initArgs[1] as ByteString;
                if (paramsRaw != null && paramsRaw.Length > 0)
                {
                    LotteryParams config = (LotteryParams)StdLib.Deserialize(paramsRaw);
                    SetMetadata("lotteryParams", paramsRaw);

                    LotteryState state = new LotteryState
                    {
                        IsDrawn = false,
                        TotalTicketsSold = 0,
                        TotalPrizePool = config.PrizePool
                    };
                    Storage.Put(Storage.CurrentContext, PREFIX_LOTTERY_STATE, StdLib.Serialize(state));
                    OnLotteryDeployed(Runtime.Transaction.Sender);
                }
            }
        }

        [Safe]
        public static LotteryParams GetLotteryParams()
        {
            ByteString raw = GetMetadata("lotteryParams");
            if (raw == null || raw.Length == 0) return new LotteryParams();
            return (LotteryParams)StdLib.Deserialize(raw);
        }

        [Safe]
        public static LotteryState GetLotteryState()
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, PREFIX_LOTTERY_STATE);
            if (raw == null || raw.Length == 0) return new LotteryState();
            return (LotteryState)StdLib.Deserialize(raw);
        }

        [Safe]
        public static BigInteger GetUserTickets(UInt160 user)
        {
            ByteString raw = GetPlayerData(user, PREFIX_TICKETS);
            if (raw == null || raw.Length == 0) return 0;
            return (BigInteger)raw;
        }

        public static void BuyTicket(BigInteger amount)
        {
            UInt160 caller = ((Transaction)Runtime.ScriptContainer).Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");
            ExecutionEngine.Assert(amount > 0, "Amount must be positive");

            LotteryParams config = GetLotteryParams();
            LotteryState state = GetLotteryState();

            ExecutionEngine.Assert(!state.IsDrawn, "Lottery already drawn");
            ExecutionEngine.Assert(Runtime.Time < config.EndTimestamp, "Ticket sale ended");

            BigInteger userTickets = GetUserTickets(caller);
            ExecutionEngine.Assert(userTickets + amount <= config.MaxTicketsPerUser, "Exceeds max tickets per user");
            
            if (config.MaxTotalTickets > 0)
            {
                ExecutionEngine.Assert(state.TotalTicketsSold + amount <= config.MaxTotalTickets, "Exceeds max total tickets");
            }

            if (config.TicketPrice > 0)
            {
                BigInteger totalCost = config.TicketPrice * amount;
                bool success = (bool)Contract.Call(config.TokenAddress, "transfer", CallFlags.All, new object[] { caller, Runtime.ExecutingScriptHash, totalCost, null });
                ExecutionEngine.Assert(success, "Payment failed");
                state.TotalPrizePool += totalCost;
            }

            // Record tickets
            SetPlayerData(caller, PREFIX_TICKETS, (ByteString)(userTickets + amount));
            
            // Simplified: we just increment the total tickets. In a real system, we might need a mapping of TicketID -> User.
            // For template abstraction, we can use a counter and map index to user.
            for (int i = 0; i < amount; i++)
            {
                BigInteger ticketId = state.TotalTicketsSold + i + 1;
                StorageMap ticketMap = new StorageMap(Storage.CurrentContext, PREFIX_TICKETS);
                ticketMap.Put((ByteString)ticketId, caller);
            }

            state.TotalTicketsSold += amount;
            Storage.Put(Storage.CurrentContext, PREFIX_LOTTERY_STATE, StdLib.Serialize(state));

            OnTicketBought(caller, amount);
        }

        public static void Draw(BigInteger randomSeed)
        {
            LotteryParams config = GetLotteryParams();
            ExecutionEngine.Assert(Runtime.CheckWitness(config.OracleAddress), "Only oracle can draw");

            LotteryState state = GetLotteryState();
            ExecutionEngine.Assert(!state.IsDrawn, "Already drawn");
            ExecutionEngine.Assert(Runtime.Time >= config.DrawTimestamp, "Too early to draw");
            ExecutionEngine.Assert(state.TotalTicketsSold > 0, "No tickets sold");

            // Simple pseudo-random selection based on seed for template demonstration
            BigInteger winnerCount = config.WinnerCount;
            if (state.TotalTicketsSold < winnerCount)
            {
                winnerCount = state.TotalTicketsSold;
            }

            BigInteger prizePerWinner = state.TotalPrizePool / winnerCount;
            StorageMap ticketMap = new StorageMap(Storage.CurrentContext, PREFIX_TICKETS);
            StorageMap winnerMap = new StorageMap(Storage.CurrentContext, PREFIX_WINNERS);

            // Very simple pseudo-random for template (in prod, use true VRF)
            for (int i = 0; i < winnerCount; i++)
            {
                BigInteger seedHash = (BigInteger)CryptoLib.Sha256((ByteString)(randomSeed + i));
                BigInteger winningTicketId = (seedHash % state.TotalTicketsSold) + 1;
                UInt160 winner = (UInt160)ticketMap.Get((ByteString)winningTicketId);
                
                // Record winner and their prize
                ByteString currentPrizeRaw = winnerMap.Get((ByteString)winner);
                BigInteger currentPrize = currentPrizeRaw != null && currentPrizeRaw.Length > 0 ? (BigInteger)currentPrizeRaw : 0;
                winnerMap.Put((ByteString)winner, (ByteString)(currentPrize + prizePerWinner));
            }

            state.IsDrawn = true;
            Storage.Put(Storage.CurrentContext, PREFIX_LOTTERY_STATE, StdLib.Serialize(state));

            OnLotteryDrawn(state.TotalPrizePool);
        }

        public static void ClaimPrize()
        {
            UInt160 caller = ((Transaction)Runtime.ScriptContainer).Sender;
            ExecutionEngine.Assert(Runtime.CheckWitness(caller), "Unauthorized");

            LotteryState state = GetLotteryState();
            ExecutionEngine.Assert(state.IsDrawn, "Lottery not drawn yet");

            StorageMap winnerMap = new StorageMap(Storage.CurrentContext, PREFIX_WINNERS);
            ByteString prizeRaw = winnerMap.Get((ByteString)caller);
            ExecutionEngine.Assert(prizeRaw != null && prizeRaw.Length > 0, "No prize to claim");

            BigInteger prize = (BigInteger)prizeRaw;
            ExecutionEngine.Assert(prize > 0, "Prize is zero");

            LotteryParams config = GetLotteryParams();
            
            // Mark as claimed (delete from map or set to 0)
            winnerMap.Delete((ByteString)caller);

            bool success = (bool)Contract.Call(config.TokenAddress, "transfer", CallFlags.All, new object[] { Runtime.ExecutingScriptHash, caller, prize, null });
            ExecutionEngine.Assert(success, "Prize transfer failed");

            OnPrizeClaimed(caller, prize);
        }
    }
}