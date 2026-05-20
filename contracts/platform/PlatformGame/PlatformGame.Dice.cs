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

            // Audit fix M-2: rejection sampling to eliminate modular bias.
            // Naively taking the first byte mod 6 makes outcomes 1..4 occur with
            // probability 43/256 (16.8%) and 5..6 with probability 41/256 (16.0%).
            // We scan oracleResult byte-by-byte for the first value in the unbiased
            // range [0, 252) (the largest multiple of 6 below 256) and use that.
            byte[] randomBytes = (byte[])oracleResult;
            int rngIndex = 0;
            byte sampled = 0xFF;
            while (rngIndex < randomBytes.Length)
            {
                byte candidate = randomBytes[rngIndex];
                if (candidate < 252) { sampled = candidate; break; }
                rngIndex++;
            }
            // Fallback: if every byte landed in the bias zone (probability < 2^-2048
            // for a 256-byte oracle result), fall back to the first byte to remain
            // deterministic. Astronomically unlikely in practice.
            if (sampled == 0xFF) sampled = randomBytes[0];
            BigInteger rolled = (sampled % 6) + 1;
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

        // Audit fix M-4 / M-5 / M-2 / partial-file-budget: dice limit + storage
        // helpers moved to PlatformGame.Dice.Internal.cs to keep this file under
        // 300 lines (ContractProjectConventionsTest.ContractPartialFilesStayReviewable).
    }
}
