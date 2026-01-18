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
        #region Type-Specific Round Management

        [Safe]
        public static TypeRoundData GetTypeRound(byte lotteryType)
        {
            byte[] key = Helper.Concat(PREFIX_TYPE_ROUND, new byte[] { lotteryType });
            ByteString data = Storage.Get(Storage.CurrentContext, key);

            if (data == null)
            {
                return new TypeRoundData
                {
                    Type = lotteryType,
                    RoundId = 1,
                    TotalTickets = 0,
                    PrizePool = 0,
                    ParticipantCount = 0,
                    StartTime = Runtime.Time,
                    DrawPending = false
                };
            }
            return (TypeRoundData)StdLib.Deserialize(data);
        }

        private static void StoreTypeRound(byte lotteryType, TypeRoundData round)
        {
            byte[] key = Helper.Concat(PREFIX_TYPE_ROUND, new byte[] { lotteryType });
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(round));
        }

        #endregion

        #region Type Pool Management

        [Safe]
        public static BigInteger GetTypePool(byte lotteryType)
        {
            byte[] key = Helper.Concat(PREFIX_TYPE_POOL, new byte[] { lotteryType });
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        private static void UpdateTypePoolStats(byte lotteryType, BigInteger amount)
        {
            // Update pool balance
            byte[] poolKey = Helper.Concat(PREFIX_TYPE_POOL, new byte[] { lotteryType });
            BigInteger pool = GetTypePool(lotteryType);
            Storage.Put(Storage.CurrentContext, poolKey, pool + amount);

            // Update type stats
            UpdateTypeStats(lotteryType, amount, false, 0);
        }

        #endregion

        #region Type Statistics

        public struct TypeStats
        {
            public BigInteger TotalTicketsSold;
            public BigInteger TotalRevenue;
            public BigInteger TotalPrizesPaid;
            public BigInteger TotalWinners;
        }

        [Safe]
        public static TypeStats GetTypeStats(byte lotteryType)
        {
            byte[] key = Helper.Concat(PREFIX_TYPE_STATS, new byte[] { lotteryType });
            ByteString data = Storage.Get(Storage.CurrentContext, key);

            if (data == null)
            {
                return new TypeStats
                {
                    TotalTicketsSold = 0,
                    TotalRevenue = 0,
                    TotalPrizesPaid = 0,
                    TotalWinners = 0
                };
            }
            return (TypeStats)StdLib.Deserialize(data);
        }

        private static void UpdateTypeStats(
            byte lotteryType,
            BigInteger revenue,
            bool isWin,
            BigInteger prizePaid)
        {
            TypeStats stats = GetTypeStats(lotteryType);
            stats.TotalTicketsSold += 1;
            stats.TotalRevenue += revenue;

            if (isWin)
            {
                stats.TotalWinners += 1;
                stats.TotalPrizesPaid += prizePaid;
            }

            byte[] key = Helper.Concat(PREFIX_TYPE_STATS, new byte[] { lotteryType });
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(stats));
        }

        private static void UpdateScratchWinStats(
            UInt160 player,
            byte lotteryType,
            BigInteger prize)
        {
            // Update type stats
            TypeStats stats = GetTypeStats(lotteryType);
            stats.TotalWinners += 1;
            stats.TotalPrizesPaid += prize;

            byte[] key = Helper.Concat(PREFIX_TYPE_STATS, new byte[] { lotteryType });
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(stats));

            // Deduct from type pool
            byte[] poolKey = Helper.Concat(PREFIX_TYPE_POOL, new byte[] { lotteryType });
            BigInteger pool = GetTypePool(lotteryType);
            if (pool >= prize)
            {
                Storage.Put(Storage.CurrentContext, poolKey, pool - prize);
            }
        }

        #endregion

        #region Seed Generation

        private static ByteString GenerateScratchSeed(BigInteger ticketId, UInt160 player)
        {
            // Combine multiple entropy sources for deterministic but unpredictable seed
            Transaction tx = Runtime.Transaction;
            ByteString txHash = (ByteString)tx.Hash;
            BigInteger blockTime = Runtime.Time;
            ByteString blockTimeBytes = (ByteString)blockTime.ToByteArray();
            ByteString ticketBytes = (ByteString)ticketId.ToByteArray();
            ByteString playerBytes = (ByteString)player;

            // Concatenate all sources
            byte[] combined = Helper.Concat(
                (byte[])txHash,
                Helper.Concat(
                    (byte[])blockTimeBytes,
                    Helper.Concat((byte[])ticketBytes, (byte[])playerBytes)
                )
            );

            return (ByteString)combined;
        }

        #endregion
    }
}
