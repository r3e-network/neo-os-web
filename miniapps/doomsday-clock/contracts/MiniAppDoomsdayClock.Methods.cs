using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region User Methods

        /// <summary>
        /// Buy keys to extend timer and increase pot.
        /// </summary>
        public static void BuyKeys(UInt160 player, BigInteger keyCount, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(keyCount >= MIN_KEYS, "min 1 key");

            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);
            ExecutionEngine.Assert(round.Active, "no active round");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

            // Check if round ended
            if (Runtime.Time >= round.EndTime)
            {
                SettleRound(roundId);
                return;
            }

            // Calculate cost with dynamic pricing
            BigInteger cost = CalculateKeyCost(keyCount, round.TotalKeys);
            ValidatePaymentReceipt(APP_ID, player, cost, receiptId);

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

        #endregion
    }
}
