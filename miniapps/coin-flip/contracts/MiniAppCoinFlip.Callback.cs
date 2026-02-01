using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppCoinFlip
    {
        #region Service Callback

        /// <summary>
        /// Handle RNG service callback for bet resolution.
        /// 
        /// TRIGGERED BY: Oracle RNG service
        /// 
        /// PROCESS:
        /// - Validates callback is from authorized gateway
        /// - Retrieves bet data from request ID
        /// - Determines win/loss based on random result
        /// - Calculates payout with streak bonuses
        /// - Handles jackpot wins for eligible bets
        /// - Updates player statistics
        /// 
        /// SECURITY:
        /// - Marks bet as resolved BEFORE transfer (reentrancy protection)
        /// - Validates request data exists
        /// - Validates bet not already resolved
        /// </summary>
        /// <param name="requestId">RNG request ID</param>
        /// <param name="appId">Application ID (must match APP_ID)</param>
        /// <param name="serviceType">Service type (must be RNG)</param>
        /// <param name="success">Whether RNG request succeeded</param>
        /// <param name="result">Random result bytes</param>
        /// <param name="error">Error message if failed</param>
        public static void OnServiceCallback(
            BigInteger requestId,
            string appId,
            string serviceType,
            bool success,
            ByteString result,
            string error)
        {
            ValidateGateway();
            ExecutionEngine.Assert(appId == APP_ID, "app mismatch");
            ExecutionEngine.Assert(serviceType == ServiceTypes.RNG, "service mismatch");

            ByteString betIdData = GetRequestData(requestId);
            ExecutionEngine.Assert(betIdData != null, "unknown request");
            BigInteger betId = (BigInteger)betIdData;
            DeleteRequestData(requestId);

            BetData bet = GetBet(betId);
            ExecutionEngine.Assert(bet.Player != UInt160.Zero, "bet not found");
            ExecutionEngine.Assert(!bet.Resolved, "already resolved");

            if (!success || result == null || result.Length == 0)
            {
                bet.Resolved = true;
                bet.Won = false;
                bet.Payout = 0;
                bet.StreakBonus = 0;
                StoreBet(betId, bet);

                UpdatePlayerStats(bet.Player, bet.Amount, false, 0, false);
                OnBetResolved(bet.Player, betId, false, 0);
                return;
            }

            ByteString hash = CryptoLib.Sha256(result);
            BigInteger randomNumber = ToPositiveInteger((byte[])hash);
            bool resultFlip = (randomNumber % 2) == 0;
            bool won = (resultFlip == bet.Choice);

            BigInteger payout = 0;
            BigInteger streakBonus = 0;
            bool wonJackpot = false;

            // SECURITY FIX: Mark as resolved BEFORE transfer to prevent reentrancy
            bet.Resolved = true;
            bet.Won = won;
            bet.Payout = payout;
            bet.StreakBonus = streakBonus;
            StoreBet(betId, bet);

            if (won)
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

                // Update payout in storage after calculations
                bet.Payout = payout;
                bet.StreakBonus = streakBonus;
                StoreBet(betId, bet);

                bool transferred = GAS.Transfer(Runtime.ExecutingScriptHash, bet.Player, payout);
                ExecutionEngine.Assert(transferred, "transfer failed");

                BigInteger totalPaid = GetTotalPaid();
                Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PAID, totalPaid + payout);
            }

            UpdatePlayerStats(bet.Player, bet.Amount, won, payout, wonJackpot);

            OnBetResolved(bet.Player, betId, won, payout);
        }

        #endregion
    }
}
