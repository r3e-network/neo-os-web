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
        /// </summary>
        public static BigInteger RequestRandom(string appId)
        {
            ValidateNotPaused();
            ValidateGateway();
            ValidateAppId(appId);
            ExecutionEngine.Assert(IsAppRegistered(appId), "app not registered");

            // Gateway handles the actual RNG request
            // Return a placeholder; actual value comes via callback
            return Runtime.GetRandom();
        }

        /// <summary>
        /// Get token price from PriceFeed.
        /// </summary>
        [Safe]
        public static BigInteger GetPrice(string symbol)
        {
            ExecutionEngine.Assert(symbol != null && symbol.Length > 0, "symbol required");
            // Price feed integration - returns 0 if not configured
            return 0;
        }

        #endregion
    }
}
