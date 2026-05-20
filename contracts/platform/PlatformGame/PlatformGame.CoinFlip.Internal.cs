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

            // Audit fix M-5: read `lastBetTime` BEFORE overwriting `CF_PREFIX_PLAYER_LAST`
            // so the betCount reset branch (`elapsed >= cooldown*5`) actually fires.
            // Audit fix M-4: rolling 24-hour window keyed on an anchor timestamp rather
            // than a calendar-day bucket so straddling UTC midnight no longer halves the
            // effective daily cap.
            BigInteger lastBetTime = AppGetInt(appId, CF_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = currentTime - lastBetTime;

            byte[] dailyKey = AppKey(appId, CF_PREFIX_PLAYER_DAILY, player);
            ByteString existing = Storage.Get(Storage.CurrentContext, dailyKey);
            BigInteger anchor = currentTime;
            BigInteger storedTotal = 0;
            if (existing != null)
            {
                object[] stored = (object[])StdLib.Deserialize(existing);
                BigInteger storedAnchor = (BigInteger)stored[0];
                BigInteger candidateTotal = (BigInteger)stored[1];
                if (currentTime - storedAnchor < 86400000)
                {
                    anchor = storedAnchor;
                    storedTotal = candidateTotal;
                }
            }
            Storage.Put(Storage.CurrentContext, dailyKey,
                StdLib.Serialize(new object[] { anchor, storedTotal + amount }));

            Storage.Put(Storage.CurrentContext,
                AppKey(appId, CF_PREFIX_PLAYER_LAST, player), currentTime);

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

            // Audit fix M-4: rolling 24h window, see RecordCoinFlipBet.
            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger anchor = (BigInteger)stored[0];
            if (Runtime.Time - anchor >= 86400000) return 0;
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
