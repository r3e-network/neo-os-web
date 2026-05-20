using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Audit fix M-4 / M-5 / M-2: helpers extracted from PlatformGame.Dice.cs to
    // keep that partial file under the 300-line reviewability budget (enforced
    // by ContractProjectConventionsTest.ContractPartialFilesStayReviewable).
    public partial class PlatformGameContract
    {
        private static void ValidateDiceRequestMapping(string appId, BigInteger betId, BigInteger requestId)
        {
            ExecutionEngine.Assert(requestId > 0, "requestId required");
            ByteString mappedBet = Storage.Get(Storage.CurrentContext, AppKey(appId, DI_PREFIX_REQ_TO_BET, requestId));
            ExecutionEngine.Assert(mappedBet != null && (BigInteger)mappedBet == betId, "oracle request mismatch");
            Storage.Delete(Storage.CurrentContext, AppKey(appId, DI_PREFIX_REQ_TO_BET, requestId));
        }

        private static void ValidateDiceBetLimits(string appId, UInt160 player, BigInteger amount)
        {
            ExecutionEngine.Assert(amount <= DI_MAX_BET, "bet exceeds maximum");

            // Audit fix M-4: rolling 24-hour window (see RecordDiceBet/GetDiceDailyBet).
            BigInteger dailyTotal = GetDiceDailyBet(appId, player);
            ExecutionEngine.Assert(dailyTotal + amount <= DI_DAILY_LIMIT, "daily limit exceeded");

            BigInteger lastBetTime = AppGetInt(appId, DI_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = Runtime.Time - lastBetTime;
            ExecutionEngine.Assert(lastBetTime == 0 || elapsed >= DI_COOLDOWN_MS, "please wait before placing another bet");

            BigInteger betCount = AppGetInt(appId, DI_PREFIX_PLAYER_COUNT, player);
            if (elapsed >= DI_COOLDOWN_MS * 5) betCount = 0;
            ExecutionEngine.Assert(betCount < DI_MAX_CONSECUTIVE, "max consecutive bets reached");
        }

        private static void RecordDiceBet(string appId, UInt160 player, BigInteger amount)
        {
            BigInteger currentTime = Runtime.Time;

            // Audit fix M-5: read `lastBetTime` BEFORE overwriting it so the consecutive-
            // bet reset branch (elapsed >= cooldown*5) actually fires.
            BigInteger lastBetTime = AppGetInt(appId, DI_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = currentTime - lastBetTime;

            // Audit fix M-4: rolling 24h window keyed on an anchor timestamp rather
            // than a calendar-day bucket so straddling UTC midnight no longer halves
            // the effective daily cap.
            BigInteger anchor = currentTime;
            BigInteger storedTotal = 0;
            ByteString existing = Storage.Get(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_DAILY, player));
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
            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_DAILY, player),
                StdLib.Serialize(new object[] { anchor, storedTotal + amount }));

            BigInteger betCount = AppGetInt(appId, DI_PREFIX_PLAYER_COUNT, player);
            betCount = elapsed >= DI_COOLDOWN_MS * 5 ? 1 : betCount + 1;

            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_LAST, player), currentTime);
            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_COUNT, player), betCount);
        }

        private static BigInteger GetDiceDailyBet(string appId, UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_DAILY, player));
            if (data == null) return 0;

            // Audit fix M-4: rolling 24h window, see RecordDiceBet.
            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger anchor = (BigInteger)stored[0];
            if (Runtime.Time - anchor >= 86400000) return 0;
            return (BigInteger)stored[1];
        }

        private static void StoreDiceBet(string appId, BigInteger betId, DiceBet bet)
        {
            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_BETS, betId), StdLib.Serialize(bet));
        }

        private static DiceBet LoadDiceBet(string appId, BigInteger betId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, DI_PREFIX_BETS, betId));
            if (data == null) return new DiceBet();
            return (DiceBet)StdLib.Deserialize(data);
        }
    }
}
