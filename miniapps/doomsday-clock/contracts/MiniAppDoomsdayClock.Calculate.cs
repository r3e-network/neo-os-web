using System.Numerics;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDoomsdayClock
    {
        #region Calculate Methods

        /// <summary>
        /// Calculate total cost for buying multiple keys using O(1) arithmetic formula.
        /// Replaces O(n) loop with arithmetic sequence sum formula.
        /// Formula: Sum = n * firstKeyPrice + d * n * (n-1) / 2
        /// where d = BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000
        /// </summary>
        private static BigInteger CalculateKeyCost(BigInteger keyCount, BigInteger currentTotalKeys)
        {
            if (keyCount <= 0) return 0;

            // First key price: BASE_KEY_PRICE + currentTotalKeys * BASE_KEY_PRICE * INCREMENT / 10000
            BigInteger firstKeyPrice = BASE_KEY_PRICE +
                (currentTotalKeys * BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000);

            // Common difference (price increment per key)
            BigInteger d = BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS / 10000;

            // Arithmetic sequence sum: n * a + d * n * (n-1) / 2
            BigInteger totalCost = keyCount * firstKeyPrice +
                d * keyCount * (keyCount - 1) / 2;

            return totalCost;
        }

        #endregion
    }
}
