using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region User Methods

        /// <summary>
        /// Direct key purchase entrypoint backed by prepaid GAS credit.
        ///
        /// CURRENT LIVE FLOW:
        /// - the wallet prepays GAS directly to this contract with an APP_ID-prefixed memo
        /// - the contract records direct GAS credit in OnNEP17Payment
        ///
        /// NOTE:
        /// - newer frontend code prefers BuyKeysWithCost so the contract can verify the
        ///   user-visible price formula without looping
        /// </summary>
        public static void BuyKeys(UInt160 player, BigInteger keyCount)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(keyCount >= MIN_KEYS, "min 1 key");

            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            ExecutionEngine.Assert(round.Active, "no active round");

            ValidateUserOrAbstractAccount(player);

            // Check if round ended
            if (Runtime.Time >= round.EndTime)
            {
                SettleRound(roundId);
                return;
            }

            // Calculate cost with dynamic pricing
            BigInteger cost = CalculateKeyCost(keyCount, round.TotalKeys);
            ConsumeDirectGasCredit(player, cost);

            // Update round
            BigInteger potContribution = cost * (10000 - PLATFORM_FEE_BPS) / 10000;
            round.Pot += potContribution;
            round.TotalKeys += keyCount;
            round.LastBuyer = player;

            // Extend time
            BigInteger timeToAdd = keyCount * TIME_ADDED_PER_KEY_SECONDS;
            BigInteger newEndTime = round.EndTime + timeToAdd;
            BigInteger maxEndTime = Runtime.Time + MAX_DURATION_SECONDS;
            if (newEndTime > maxEndTime) newEndTime = maxEndTime;
            round.EndTime = newEndTime;

            StoreRound(roundId, round);

            // Update player keys
            UpdatePlayerKeys(player, roundId, keyCount);

            // Update player stats
            UpdatePlayerStats(player, keyCount, cost);

            // Update global stats
            BigInteger totalKeys = TotalKeysSold();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_KEYS_SOLD, totalKeys + keyCount);

            OnKeysPurchased(player, keyCount, potContribution, roundId);
            OnTimeExtended(roundId, newEndTime, keyCount);
        }

        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            CreditDirectGasPayment(APP_ID, from, amount, data);
        }

        #endregion
    }
}
