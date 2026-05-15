using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGameContract
    {
        private static void ValidateCoinFlipBetLimits(string appId, UInt160 player, BigInteger amount)
        {
            ExecutionEngine.Assert(amount <= CF_MAX_BET, "bet exceeds maximum");

            BigInteger dailyTotal = GetCoinFlipDailyBet(appId, player);
            ExecutionEngine.Assert(dailyTotal + amount <= CF_DAILY_LIMIT, "daily limit exceeded");

            BigInteger lastBetTime = AppGetInt(appId, CF_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = Runtime.Time - lastBetTime;
            ExecutionEngine.Assert(lastBetTime == 0 || elapsed >= CF_COOLDOWN_MS,
                "please wait before placing another bet");

            BigInteger betCount = AppGetInt(appId, CF_PREFIX_PLAYER_COUNT, player);
            if (elapsed >= CF_COOLDOWN_MS * 5) betCount = 0;
            ExecutionEngine.Assert(betCount < CF_MAX_CONSECUTIVE,
                "max consecutive bets reached, take a break");
        }

        private static void RecordCoinFlipBet(string appId, UInt160 player, BigInteger amount)
        {
            BigInteger currentTime = Runtime.Time;
            BigInteger currentDay = currentTime / 86400000;

            BigInteger dailyTotal = GetCoinFlipDailyBet(appId, player);
            byte[] dailyKey = AppKey(appId, CF_PREFIX_PLAYER_DAILY, player);
            Storage.Put(Storage.CurrentContext, dailyKey,
                StdLib.Serialize(new object[] { currentDay, dailyTotal + amount }));

            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CF_PREFIX_PLAYER_LAST, player), currentTime);

            BigInteger lastBetTime = AppGetInt(appId, CF_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = currentTime - lastBetTime;
            BigInteger betCount = AppGetInt(appId, CF_PREFIX_PLAYER_COUNT, player);

            if (elapsed >= CF_COOLDOWN_MS * 5)
            {
                betCount = 1;
            }
            else
            {
                betCount += 1;
            }

            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CF_PREFIX_PLAYER_COUNT, player), betCount);
        }

        private static BigInteger GetCoinFlipDailyBet(string appId, UInt160 player)
        {
            byte[] dailyKey = AppKey(appId, CF_PREFIX_PLAYER_DAILY, player);
            ByteString data = Storage.Get(Storage.CurrentContext, dailyKey);
            if (data == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400000;

            if (storedDay != currentDay) return 0;
            return (BigInteger)stored[1];
        }

        private static void StoreCoinFlipBet(string appId, BigInteger betId, CoinFlipBet bet)
        {
            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CF_PREFIX_BETS, betId),
                StdLib.Serialize(bet));
        }

        private static CoinFlipBet LoadCoinFlipBet(string appId, BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                AppKey(appId, CF_PREFIX_BETS, betId));
            if (data == null) return new CoinFlipBet();
            return (CoinFlipBet)StdLib.Deserialize(data);
        }
    }
}
