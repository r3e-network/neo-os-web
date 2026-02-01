using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Hybrid Mode with Script Verification

        // Script name for coin flip calculation (registered via MiniAppComputeBase)
        private const string SCRIPT_FLIP_COIN = "flip-coin";

        /// <summary>
        /// Initiate a bet with deterministic seed for hybrid mode.
        /// Uses MiniAppComputeBase for script verification.
        /// </summary>
        public static object[] InitiateBet(UInt160 player, BigInteger amount, bool choice, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            // Verify script is registered
            ExecutionEngine.Assert(IsScriptEnabled(SCRIPT_FLIP_COIN), "script not registered");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            ExecutionEngine.Assert(amount >= MIN_BET, "bet too small");
            ExecutionEngine.Assert(amount <= MAX_BET, "bet too large");
            ValidateGameBetLimits(player, amount);
            ValidatePaymentReceipt(APP_ID, player, amount, receiptId);

            BigInteger betId = GetBetCount() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_BET_ID, betId);

            // Generate deterministic seed using MiniAppComputeBase
            ByteString seed = GenerateOperationSeed(betId, player, SCRIPT_FLIP_COIN);

            BetData bet = new BetData
            {
                Player = player,
                Amount = amount,
                Choice = choice,
                Timestamp = Runtime.Time,
                Resolved = false,
                Won = false,
                Payout = 0,
                StreakBonus = 0,
                Seed = seed,
                HybridMode = true
            };
            StoreBet(betId, bet);

            AddUserBet(player, betId);
            RecordGameBet(player, amount);

            BigInteger jackpotContribution = amount * JACKPOT_CONTRIBUTION_BPS / 10000;
            BigInteger currentJackpot = GetJackpotPool();
            Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT_POOL, currentJackpot + jackpotContribution);

            BigInteger totalWagered = GetTotalWagered();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_WAGERED, totalWagered + amount);

            OnBetInitiated(player, betId, amount, choice, (string)(ByteString)seed);

            return new object[] { betId, seed, SCRIPT_FLIP_COIN };
        }

        /// <summary>
        /// Settle a hybrid mode bet. Verifies script hash matches registered script.
        /// </summary>
        public static void SettleBet(UInt160 player, BigInteger betId, bool claimedWon, ByteString scriptHash)
        {
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Verify script hash using MiniAppComputeBase
            ValidateScriptHash(SCRIPT_FLIP_COIN, scriptHash);

            BetData bet = GetBet(betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(bet.Player == player, "not your bet");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");
            ExecutionEngine.Assert(bet.HybridMode, "not hybrid mode");
            ExecutionEngine.Assert(bet.Seed != null, "no seed");

            // Clean up operation seed
            DeleteOperationSeed(betId);

            BigInteger payout = 0;
            BigInteger streakBonus = 0;
            bool wonJackpot = false;

            // Verify claimed result matches deterministic seed
            bool expectedWin = CalculateExpectedResult(bet.Seed, bet.Choice);
            ExecutionEngine.Assert(claimedWon == expectedWin, "result mismatch");

            if (claimedWon)
            {
                BigInteger platformFee = bet.Amount * PLATFORM_FEE_PERCENT / 100;
                payout = bet.Amount * 2 - platformFee;

                PlayerStats stats = GetPlayerStats(bet.Player);
                if (stats.CurrentWinStreak > 0)
                {
                    BigInteger bonusBps = stats.CurrentWinStreak * STREAK_BONUS_BPS;
                    if (bonusBps > MAX_STREAK_BONUS) bonusBps = MAX_STREAK_BONUS;
                    streakBonus = payout * bonusBps / 10000;
                    payout += streakBonus;
                }

                if (bet.Amount >= JACKPOT_THRESHOLD)
                {
                    BigInteger randomNumber = ToPositiveInteger((byte[])bet.Seed);
                    BigInteger jackpotRoll = randomNumber % 10000;
                    if (jackpotRoll < JACKPOT_CHANCE_BPS)
                    {
                        BigInteger jackpotPool = GetJackpotPool();
                        payout += jackpotPool;
                        Storage.Put(Storage.CurrentContext, PREFIX_JACKPOT_POOL, 0);
                        wonJackpot = true;
                        OnJackpotWon(bet.Player, jackpotPool);
                    }
                }

                bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout);
                ExecutionEngine.Assert(transferred, "transfer failed");

                BigInteger totalPaid = GetTotalPaid();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAID, totalPaid + payout);
            }

            bet.Resolved = true;
            bet.Won = claimedWon;
            bet.Payout = payout;
            bet.StreakBonus = streakBonus;
            StoreBet(betId, bet);

            UpdatePlayerStats(bet.Player, bet.Amount, claimedWon, payout, wonJackpot);

            OnBetResolved(bet.Player, betId, claimedWon, payout);
        }

        #endregion

        #region Script Query Methods

        /// <summary>
        /// Get script info for frontend verification.
        /// </summary>
        [Safe]
        public static Map<string, object> GetFlipScriptInfo()
        {
            return GetScriptInfo(SCRIPT_FLIP_COIN);
        }

        /// <summary>
        /// Calculate expected result from seed (reference implementation).
        /// TEE script uses the same algorithm.
        /// </summary>
        [Safe]
        public static bool CalculateExpectedResult(ByteString seed, bool choice)
        {
            ByteString hash = CryptoLib.Sha256(seed);
            BigInteger randomNumber = ToPositiveInteger((byte[])hash);
            bool resultFlip = (randomNumber % 2) == 0;
            return resultFlip == choice;
        }

        #endregion
    }
}
