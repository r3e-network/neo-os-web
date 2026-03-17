using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppContract
    {
        #region Hybrid Mode - Formula-Based Cost Calculation

        /// <summary>
        /// Calculate key cost using closed-form formula instead of loop.
        /// Formula: Sum of arithmetic sequence where:
        /// - First term: BASE_PRICE + currentKeys * BASE_PRICE * INCREMENT_BPS / 10000
        /// - Common difference: BASE_PRICE * INCREMENT_BPS / 10000
        /// - Sum = n * firstTerm + n*(n-1)/2 * commonDiff
        /// </summary>
        [Safe]
        public static BigInteger CalculateKeyCostFormula(BigInteger keyCount, BigInteger currentTotalKeys)
        {
            if (keyCount <= 0) return 0;

            // Common difference per key
            BigInteger commonDiff = BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000;

            // First key price
            BigInteger firstKeyPrice = BASE_KEY_PRICE + (currentTotalKeys * commonDiff);

            // Sum of arithmetic sequence: n * first + n*(n-1)/2 * diff
            BigInteger baseCost = keyCount * firstKeyPrice;
            BigInteger incrementCost = keyCount * (keyCount - 1) / 2 * commonDiff;

            return baseCost + incrementCost;
        }

        /// <summary>
        /// Buy keys with frontend-calculated pricing and direct prepaid GAS credit.
        ///
        /// LIVE FLOW:
        /// - frontend calculates the exact key cost with CalculateKeyCostFormula
        /// - wallet prepays that amount directly to this contract with an APP_ID memo
        /// - frontend passes a placeholder receiptId for ABI compatibility
        /// - contract rechecks the formula and consumes the user's direct GAS credit
        /// </summary>
        public static void BuyKeysWithCost(
            UInt160 player,
            BigInteger keyCount,
            BigInteger submittedCost,
            BigInteger receiptId)
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

            // Verify cost using formula (O(1) instead of O(n))
            BigInteger expectedCost = CalculateKeyCostFormula(keyCount, round.TotalKeys);
            ExecutionEngine.Assert(submittedCost == expectedCost, "cost mismatch");

            ConsumeDirectGasCredit(player, expectedCost);

            // Update round
            BigInteger potContribution = expectedCost * (10000 - PLATFORM_FEE_BPS) / 10000;
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
            UpdatePlayerStats(player, keyCount, expectedCost);

            // Update global stats
            BigInteger totalKeys = TotalKeysSold();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_KEYS_SOLD, totalKeys + keyCount);

            OnKeysPurchased(player, keyCount, potContribution, roundId);
            OnTimeExtended(roundId, newEndTime, keyCount);
        }

        /// <summary>
        /// Get all data needed for frontend to calculate costs and display UI.
        /// Returns current round state for frontend simulation.
        /// </summary>
        [Safe]
        public static Map<string, object> GetRoundStateForFrontend()
        {
            BigInteger roundId = CurrentRoundId();
            Round round = GetRound(roundId);

            Map<string, object> state = new Map<string, object>();
            state["roundId"] = roundId;
            state["active"] = round.Active;
            state["startTime"] = round.StartTime;
            state["endTime"] = round.EndTime;
            state["pot"] = round.Pot;
            state["totalKeys"] = round.TotalKeys;
            state["lastBuyer"] = round.LastBuyer;
            state["currentTime"] = Runtime.Time;

            // Constants for frontend calculation
            state["baseKeyPrice"] = BASE_KEY_PRICE;
            state["keyPriceIncrementBps"] = KEY_PRICE_INCREMENT_BPS;
            state["timeAddedPerKey"] = TIME_ADDED_PER_KEY_SECONDS;
            state["maxDuration"] = MAX_DURATION_SECONDS;
            state["platformFeeBps"] = PLATFORM_FEE_BPS;
            state["winnerShareBps"] = WINNER_SHARE_BPS;
            state["dividendShareBps"] = DIVIDEND_SHARE_BPS;

            return state;
        }

        #endregion
    }
}
