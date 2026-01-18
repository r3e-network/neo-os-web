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
        #region Lottery Type Queries

        [Safe]
        public static Map<string, object>[] GetLotteryTypes()
        {
            Map<string, object>[] types = new Map<string, object>[6];

            for (byte i = 0; i < 6; i++)
            {
                LotteryConfig config = GetLotteryConfig(i);
                Map<string, object> typeInfo = new Map<string, object>();

                typeInfo["type"] = i;
                typeInfo["name"] = GetLotteryTypeName(i);
                typeInfo["price"] = config.TicketPrice;
                typeInfo["isInstant"] = config.IsInstant;
                typeInfo["maxJackpot"] = config.MaxJackpot;
                typeInfo["enabled"] = config.Enabled;
                typeInfo["pool"] = GetTypePool(i);

                types[i] = typeInfo;
            }

            return types;
        }

        [Safe]
        public static string GetLotteryTypeName(byte lotteryType)
        {
            LotteryType type = (LotteryType)lotteryType;

            switch (type)
            {
                case LotteryType.ScratchWin:
                    return "福彩刮刮乐";
                case LotteryType.DoubleColor:
                    return "双色球";
                case LotteryType.Happy8:
                    return "快乐8";
                case LotteryType.Lucky7:
                    return "七乐彩";
                case LotteryType.SuperLotto:
                    return "大乐透";
                case LotteryType.Supreme:
                    return "至尊彩";
                default:
                    return "Unknown";
            }
        }

        #endregion

        #region Player Scratch Ticket Queries

        [Safe]
        public static ScratchTicket[] GetPlayerScratchTickets(
            UInt160 player,
            BigInteger offset,
            BigInteger limit)
        {
            ValidateAddress(player);

            BigInteger count = GetPlayerScratchCount(player);
            if (count == 0 || offset >= count)
            {
                return new ScratchTicket[0];
            }

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            ScratchTicket[] tickets = new ScratchTicket[(int)resultCount];

            // Iterate through player's scratch tickets
            byte[] prefix = Helper.Concat(PREFIX_PLAYER_SCRATCH, (ByteString)player);
            StorageMap map = new StorageMap(Storage.CurrentContext, prefix);
            Iterator iterator = map.Find(FindOptions.KeysOnly | FindOptions.RemovePrefix);

            BigInteger index = 0;
            BigInteger resultIndex = 0;

            while (iterator.Next() && resultIndex < resultCount)
            {
                if (index >= offset)
                {
                    ByteString ticketIdBytes = (ByteString)iterator.Value;
                    BigInteger ticketId = (BigInteger)ticketIdBytes;
                    tickets[(int)resultIndex] = GetScratchTicket(ticketId);
                    resultIndex++;
                }
                index++;
            }

            return tickets;
        }

        /// <summary>
        /// [DEPRECATED] O(2n) two-pass iteration - use frontend filtering instead.
        /// Frontend should call GetPlayerScratchTickets() with pagination,
        /// then filter unrevealed tickets locally.
        /// </summary>
        [Safe]
        public static ScratchTicket[] GetPlayerUnrevealedTickets(UInt160 player)
        {
            ValidateAddress(player);

            BigInteger count = GetPlayerScratchCount(player);
            if (count == 0) return new ScratchTicket[0];

            // First pass: count unrevealed
            byte[] prefix = Helper.Concat(PREFIX_PLAYER_SCRATCH, (ByteString)player);
            StorageMap map = new StorageMap(Storage.CurrentContext, prefix);
            Iterator iterator = map.Find(FindOptions.KeysOnly | FindOptions.RemovePrefix);

            BigInteger unrevealedCount = 0;
            while (iterator.Next())
            {
                ByteString ticketIdBytes = (ByteString)iterator.Value;
                BigInteger ticketId = (BigInteger)ticketIdBytes;
                ScratchTicket ticket = GetScratchTicket(ticketId);
                if (!ticket.Scratched) unrevealedCount++;
            }

            if (unrevealedCount == 0) return new ScratchTicket[0];

            // Second pass: collect unrevealed
            ScratchTicket[] tickets = new ScratchTicket[(int)unrevealedCount];
            iterator = map.Find(FindOptions.KeysOnly | FindOptions.RemovePrefix);

            BigInteger resultIndex = 0;
            while (iterator.Next() && resultIndex < unrevealedCount)
            {
                ByteString ticketIdBytes = (ByteString)iterator.Value;
                BigInteger ticketId = (BigInteger)ticketIdBytes;
                ScratchTicket ticket = GetScratchTicket(ticketId);
                if (!ticket.Scratched)
                {
                    tickets[(int)resultIndex] = ticket;
                    resultIndex++;
                }
            }

            return tickets;
        }

        #endregion
    }
}
