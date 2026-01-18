using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Service Interface Definitions for MiniApp Platform
    ///
    /// This file defines the standard interfaces and constants for service
    /// communication between MiniApps and the Service Layer Gateway.
    ///
    /// SERVICE FLOW:
    /// 1. MiniApp calls RequestService() with serviceType and payload
    /// 2. Gateway processes request off-chain via TEE
    /// 3. Gateway calls OnServiceCallback() with result
    /// 4. MiniApp processes callback and updates state
    /// </summary>
    public static class ServiceTypes
    {
        #region Service Type Constants

        /// <summary>Random Number Generation service</summary>
        public const string RNG = "rng";

        /// <summary>Price Feed oracle service</summary>
        public const string PRICE_FEED = "pricefeed";

        /// <summary>TEE Encryption service</summary>
        public const string ENCRYPTION = "encryption";

        /// <summary>TEE Decryption service</summary>
        public const string DECRYPTION = "decryption";

        /// <summary>External API call service</summary>
        public const string API_CALL = "apicall";

        /// <summary>Automation/Scheduled task service</summary>
        public const string AUTOMATION = "automation";

        #endregion
    }

    /// <summary>
    /// Standard service callback result structure.
    /// Used to parse and validate callback data.
    /// </summary>
    public struct ServiceCallbackResult
    {
        /// <summary>Unique request identifier</summary>
        public BigInteger RequestId;

        /// <summary>Application identifier</summary>
        public string AppId;

        /// <summary>Type of service (rng, pricefeed, etc.)</summary>
        public string ServiceType;

        /// <summary>Whether the service call succeeded</summary>
        public bool Success;

        /// <summary>Result data (service-specific format)</summary>
        public ByteString Result;

        /// <summary>Error message if Success is false</summary>
        public string Error;
    }

    /// <summary>
    /// Service request payload structure for RNG service.
    /// </summary>
    public struct RngRequestPayload
    {
        /// <summary>Application-specific context data</summary>
        public ByteString Context;

        /// <summary>Number of random bytes requested (default: 32)</summary>
        public int ByteCount;
    }

    /// <summary>
    /// Service request payload structure for Price Feed service.
    /// </summary>
    public struct PriceFeedRequestPayload
    {
        /// <summary>Token symbol (e.g., "NEO", "GAS")</summary>
        public string Symbol;

        /// <summary>Quote currency (e.g., "USD", "GAS")</summary>
        public string QuoteCurrency;
    }
}
