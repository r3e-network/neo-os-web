using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  Dice game module
    //
    //  GAME MECHANICS:
    //  - Player chooses one face from 1 to 6
    //  - Player prepays GAS with memo "appId:*", then calls PlaceDiceBet
    //  - Bet state is stored before requesting Morpheus VRF
    //  - Oracle callback resolves exactly the stored requestId -> betId
    //  - Win: 6x stake minus 5% platform fee
    //  - Lose: stake remains in the game liquidity pool
    //
    //  SECURITY:
    //  - Only configured oracle can settle or refund oracle requests
    //  - requestId mapping prevents forged callback settlement
    //  - Payout recipient is always the stored bet player
    //  - Anti-Martingale limits cap per-bet, daily, and rapid-fire exposure
    // ===================================================================
    public partial class PlatformGameContract
    {
        private const int DI_PLATFORM_FEE_PERCENT = 5;
        private const long DI_MIN_BET = 5000000;       // 0.05 GAS
        private const long DI_MAX_BET = 2000000000;    // 20 GAS
        private const long DI_DAILY_LIMIT = 50000000000; // 500 GAS
        private const long DI_COOLDOWN_MS = 30000;
        private const int DI_MAX_CONSECUTIVE = 20;

        private static readonly byte[] DI_PREFIX_BET_ID = new byte[] { 0xE0 };
        private static readonly byte[] DI_PREFIX_BETS = new byte[] { 0xE1 };
        private static readonly byte[] DI_PREFIX_REQ_TO_BET = new byte[] { 0xE2 };
        private static readonly byte[] DI_PREFIX_PLAYER_DAILY = new byte[] { 0xE3 };
        private static readonly byte[] DI_PREFIX_PLAYER_LAST = new byte[] { 0xE4 };
        private static readonly byte[] DI_PREFIX_PLAYER_COUNT = new byte[] { 0xE5 };

        public struct DiceBet
        {
            public UInt160 Player;
            public BigInteger ChosenNumber;
            public BigInteger Amount;
            public BigInteger Timestamp;
            public bool Resolved;
            public BigInteger RolledNumber;
            public BigInteger Payout;
        }

        public delegate void DiceBetPlacedHandler(string appId, UInt160 player, BigInteger chosenNumber, BigInteger amount, BigInteger betId);
        public delegate void DiceBetResolvedHandler(string appId, UInt160 player, BigInteger chosenNumber, BigInteger rolledNumber, BigInteger payout, bool won, BigInteger betId);
        public delegate void DiceRngRequestedHandler(string appId, BigInteger betId, BigInteger requestId);
        public delegate void DiceBetRefundedHandler(string appId, UInt160 player, BigInteger amount, BigInteger betId);

        [DisplayName("DiceBetPlaced")]
        public static event DiceBetPlacedHandler OnDiceBetPlaced;

        [DisplayName("DiceBetResolved")]
        public static event DiceBetResolvedHandler OnDiceBetResolved;

        [DisplayName("DiceRngRequested")]
        public static event DiceRngRequestedHandler OnDiceRngRequested;

        [DisplayName("DiceBetRefunded")]
        public static event DiceBetRefundedHandler OnDiceBetRefunded;

        public static BigInteger PlaceDiceBet(string appId, UInt160 player, BigInteger chosenNumber, BigInteger amount)
        {
            RequireRegistered(appId);
            RequireNotPaused(appId);
            RequireGameType(appId, GameType_Dice);
            ValidateUserOrAbstractAccount(player);

            ExecutionEngine.Assert(chosenNumber >= 1 && chosenNumber <= 6, "choose 1-6");
            ExecutionEngine.Assert(amount >= DI_MIN_BET, "min bet 0.05 GAS");
            ExecutionEngine.Assert(amount <= DI_MAX_BET, "max bet 20 GAS");
            ValidateDiceBetLimits(appId, player, amount);

            BigInteger maxPayout = amount * 6 * (100 - DI_PLATFORM_FEE_PERCENT) / 100;
            ExecutionEngine.Assert(GAS.BalanceOf(Runtime.ExecutingScriptHash) >= maxPayout, "insufficient payout liquidity");

            AcquireReentrancyLock(appId);
            ConsumeDirectGasCredit(appId, player, amount);

            BigInteger betId = AppGetInt(appId, DI_PREFIX_BET_ID) + 1;
            AppPut(appId, DI_PREFIX_BET_ID, betId);

            DiceBet bet = new DiceBet
            {
                Player = player,
                ChosenNumber = chosenNumber,
                Amount = amount,
                Timestamp = Runtime.Time,
                Resolved = false,
                RolledNumber = 0,
                Payout = 0
            };
            StoreDiceBet(appId, betId, bet);
            RecordDiceBet(appId, player, amount);

            ByteString payload = StdLib.Serialize(new object[] { appId, betId, chosenNumber });
            BigInteger requestId = RequestOracleForCallback(player, "vrf_random", payload);
            ExecutionEngine.Assert(requestId > 0, "oracle request failed");

            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_REQ_TO_BET, requestId), betId);
            StoreOracleRequestContext(requestId, appId, GameType_Dice, betId);

            ReleaseReentrancyLock(appId);

            OnDiceBetPlaced(appId, player, chosenNumber, amount, betId);
            OnDiceRngRequested(appId, betId, requestId);
            return betId;
        }

        public static void ResolveDiceBet(string appId, BigInteger betId, BigInteger requestId, ByteString oracleResult)
        {
            ValidateOracle();
            ResolveDiceBetFromOracle(appId, betId, requestId, oracleResult);
        }

        private static void ResolveDiceBetFromOracle(
            string appId,
            BigInteger betId,
            BigInteger requestId,
            ByteString oracleResult)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Dice);
            ValidateDiceRequestMapping(appId, betId, requestId);

            DiceBet bet = LoadDiceBet(appId, betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");
            ExecutionEngine.Assert(oracleResult != null && oracleResult.Length > 0, "empty oracle result");

            AcquireReentrancyLock(appId);

            byte[] randomBytes = (byte[])oracleResult;
            BigInteger rolled = (randomBytes[0] % 6) + 1;
            bool won = rolled == bet.ChosenNumber;
            BigInteger payout = won
                ? bet.Amount * 6 * (100 - DI_PLATFORM_FEE_PERCENT) / 100
                : 0;

            bet.Resolved = true;
            bet.RolledNumber = rolled;
            bet.Payout = payout;
            StoreDiceBet(appId, betId, bet);

            if (payout > 0)
            {
                ExecutionEngine.Assert(GAS.BalanceOf(Runtime.ExecutingScriptHash) >= payout, "insufficient payout liquidity");
                ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout), "dice payout failed");
            }

            ReleaseReentrancyLock(appId);
            OnDiceBetResolved(appId, bet.Player, bet.ChosenNumber, rolled, payout, won, betId);
        }

        private static void RefundDiceBetFromOracle(string appId, BigInteger betId, BigInteger requestId)
        {
            RequireRegistered(appId);
            RequireGameType(appId, GameType_Dice);
            ValidateDiceRequestMapping(appId, betId, requestId);

            DiceBet bet = LoadDiceBet(appId, betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");

            bet.Resolved = true;
            bet.Payout = bet.Amount;
            StoreDiceBet(appId, betId, bet);

            ExecutionEngine.Assert(GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, bet.Amount), "dice refund failed");
            OnDiceBetRefunded(appId, bet.Player, bet.Amount, betId);
        }

        [Safe]
        public static Map<string, object> GetDiceBet(string appId, BigInteger betId)
        {
            DiceBet bet = LoadDiceBet(appId, betId);
            Map<string, object> details = new Map<string, object>();

            if (bet.Player == UInt160.Zero) return details;

            details["betId"] = betId;
            details["player"] = bet.Player;
            details["chosenNumber"] = bet.ChosenNumber;
            details["amount"] = bet.Amount;
            details["timestamp"] = bet.Timestamp;
            details["resolved"] = bet.Resolved;
            details["rolledNumber"] = bet.RolledNumber;
            details["payout"] = bet.Payout;
            return details;
        }

        [Safe]
        public static Map<string, object> GetDiceBetLimits(string appId)
        {
            Map<string, object> limits = new Map<string, object>();
            limits["minBet"] = DI_MIN_BET;
            limits["maxBet"] = DI_MAX_BET;
            limits["dailyLimit"] = DI_DAILY_LIMIT;
            limits["cooldownMs"] = DI_COOLDOWN_MS;
            limits["maxConsecutive"] = DI_MAX_CONSECUTIVE;
            limits["platformFeePercent"] = DI_PLATFORM_FEE_PERCENT;
            limits["totalBets"] = AppGetInt(appId, DI_PREFIX_BET_ID);
            return limits;
        }

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
            BigInteger currentDay = currentTime / 86400000;
            BigInteger dailyTotal = GetDiceDailyBet(appId, player);
            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_DAILY, player),
                StdLib.Serialize(new object[] { currentDay, dailyTotal + amount }));

            BigInteger lastBetTime = AppGetInt(appId, DI_PREFIX_PLAYER_LAST, player);
            BigInteger elapsed = currentTime - lastBetTime;
            BigInteger betCount = AppGetInt(appId, DI_PREFIX_PLAYER_COUNT, player);
            betCount = elapsed >= DI_COOLDOWN_MS * 5 ? 1 : betCount + 1;

            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_LAST, player), currentTime);
            Storage.Put(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_COUNT, player), betCount);
        }

        private static BigInteger GetDiceDailyBet(string appId, UInt160 player)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, AppKey(appId, DI_PREFIX_PLAYER_DAILY, player));
            if (data == null) return 0;

            object[] stored = (object[])StdLib.Deserialize(data);
            BigInteger storedDay = (BigInteger)stored[0];
            BigInteger currentDay = Runtime.Time / 86400000;

            if (storedDay != currentDay) return 0;
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
