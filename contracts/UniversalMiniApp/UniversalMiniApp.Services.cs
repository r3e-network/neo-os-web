using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class UniversalMiniApp
    {
        #region Service Integration

        /// <summary>
        /// Request a random number via ServiceLayerGateway.
        /// IMPORTANT: This is a placeholder. Actual RNG is generated off-chain by NeoVRF
        /// and delivered via gateway callbacks. The return value here is NOT random.
        /// Use the RNG service through the SDK which handles the async callback flow.
        /// </summary>
        /// <returns>Always returns 0 - use SDK for actual random numbers</returns>
        public static BigInteger RequestRandom(string appId)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");

            // RNG is generated off-chain by NeoVRF and delivered via gateway callbacks.
            // This method returns 0 as a placeholder - actual randomness comes via events.
            return 0;
        }

        /// <summary>
        /// Get token price from PriceFeed.
        /// IMPORTANT: This is a placeholder. Price feed integration requires
        /// oracle setup. Use the datafeed service through the SDK instead.
        /// </summary>
        /// <returns>Always returns 0 - use SDK datafeed for actual prices</returns>
        [Safe]
        public static BigInteger GetPrice(string symbol)
        {
            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            ExecutionEngine.Assert(symbol.Length <= 10, "symbol too long");
            // Price feed integration - returns 0 if not configured
            // Actual prices should be fetched via SDK datafeed service
            return 0;
        }

        #endregion
    }
}
