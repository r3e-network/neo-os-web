using Neo;
using Neo.SmartContract;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;
using System;
using System.ComponentModel;
using System.Numerics;

namespace ServiceLayer
{
    [DisplayName("ServiceLayer.OracleConsumer")]
    [ManifestExtra("Author", "WillTech Services")]
    [ManifestExtra("Email", "info@willtech.com")]
    [ManifestExtra("Description", "Oracle consumer contract for Neo N3 Service Layer")]
    public class OracleConsumer : SmartContract
    {
        // Events
        [DisplayName("PriceUpdated")]
        public static event Action<string, BigInteger> OnPriceUpdated;
        
        [DisplayName("RandomGenerated")]
        public static event Action<BigInteger, string> OnRandomGenerated;
        
        [DisplayName("ContractAutomated")]
        public static event Action<string> OnContractAutomated;

        // Storage keys
        private static readonly byte[] PriceKey = "price".ToByteArray();
        private static readonly byte[] RandomKey = "random".ToByteArray();
        private static readonly byte[] OwnerKey = "owner".ToByteArray();
        private static readonly byte[] OracleRequestIDKey = "oracleRequestID".ToByteArray();
        
        // Oracle callback URLs
        private static readonly string PriceFeedURL = "https://api.servicelayer.neo.org/v1/oracle/price";
        private static readonly string RandomGeneratorURL = "https://api.servicelayer.neo.org/v1/oracle/random";
        
        /// <summary>
        /// Constructor method is called when the contract is deployed
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            
            // Set the contract owner to the transaction sender
            Storage.Put(Storage.CurrentContext, OwnerKey, Runtime.CallingScriptHash);
        }
        
        /// <summary>
        /// Method is automatically called when the contract receives NEP-17 tokens
        /// </summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            // Handle receiving tokens (can be used for gas bank deposits)
        }
        
        /// <summary>
        /// Request a price update from the oracle service
        /// </summary>
        /// <param name="assetSymbol">Symbol of the asset (e.g., "NEO")</param>
        public static void RequestPrice(string assetSymbol)
        {
            // Only contract owner can request price updates
            VerifyOwner();
            
            // Construct the oracle request URL with the asset symbol
            string url = $"{PriceFeedURL}/{assetSymbol}";
            
            // Make the oracle request and store the request ID
            Oracle.Request(url, "getPrice", "callback", null, Oracle.MinimumResponseFee);
        }
        
        /// <summary>
        /// Callback method for the price oracle request
        /// </summary>
        public static void Callback(string url, byte[] userData, int code, byte[] result)
        {
            // Ensure callback is from the Oracle native contract
            VerifyOracle();
            
            // Check if the request was successful
            if (code != 0)
            {
                throw new Exception("Oracle request failed with code: " + code);
            }
            
            // Parse the asset symbol from the URL
            string[] urlParts = url.Split('/');
            string assetSymbol = urlParts[urlParts.Length - 1];
            
            // Parse the price result (as a string representation of an integer with 8 decimal places)
            BigInteger price = BigInteger.Parse(result.ToByteString());
            
            // Store the price
            Storage.Put(Storage.CurrentContext, PriceKey + assetSymbol, price);
            
            // Emit event
            OnPriceUpdated(assetSymbol, price);
        }
        
        /// <summary>
        /// Get the stored price for an asset
        /// </summary>
        /// <param name="assetSymbol">Symbol of the asset (e.g., "NEO")</param>
        /// <returns>Price as a BigInteger with 8 decimal places, or 0 if not set</returns>
        [DisplayName("getPrice")]
        public static BigInteger GetPrice(string assetSymbol)
        {
            return Storage.Get(Storage.CurrentContext, PriceKey + assetSymbol).ToBigInteger();
        }
        
        /// <summary>
        /// Request a random number from the oracle service
        /// </summary>
        /// <param name="min">Minimum value (inclusive)</param>
        /// <param name="max">Maximum value (inclusive)</param>
        public static void RequestRandom(BigInteger min, BigInteger max)
        {
            // Only contract owner can request random numbers
            VerifyOwner();
            
            // Ensure min is less than max
            if (min >= max)
            {
                throw new Exception("Minimum value must be less than maximum value");
            }
            
            // Construct the oracle request URL with parameters
            string url = $"{RandomGeneratorURL}?min={min}&max={max}";
            
            // Make the oracle request
            Oracle.Request(url, "getRandom", "randomCallback", null, Oracle.MinimumResponseFee);
        }
        
        /// <summary>
        /// Callback method for the random number oracle request
        /// </summary>
        public static void RandomCallback(string url, byte[] userData, int code, byte[] result)
        {
            // Ensure callback is from the Oracle native contract
            VerifyOracle();
            
            // Check if the request was successful
            if (code != 0)
            {
                throw new Exception("Oracle request failed with code: " + code);
            }
            
            // Parse the random number result (as a string representation of an integer)
            BigInteger randomNumber = BigInteger.Parse(result.ToByteString());
            
            // Store the random number
            Storage.Put(Storage.CurrentContext, RandomKey, randomNumber);
            
            // Parse the proof from the result (contains cryptographic proof)
            string proof = result.ToByteString();
            
            // Emit event
            OnRandomGenerated(randomNumber, proof);
        }
        
        /// <summary>
        /// Get the stored random number
        /// </summary>
        /// <returns>Random number as a BigInteger, or 0 if not set</returns>
        [DisplayName("getRandom")]
        public static BigInteger GetRandom()
        {
            return Storage.Get(Storage.CurrentContext, RandomKey).ToBigInteger();
        }
        
        /// <summary>
        /// Execute a contract automation function
        /// </summary>
        /// <param name="functionName">Name of the function to execute</param>
        public static bool ExecuteAutomation(string functionName)
        {
            // This would be called by the Service Layer's contract automation service
            // Verify the caller has permission (either the owner or the Service Layer oracle contract)
            if (!Runtime.CheckWitness((UInt160)Storage.Get(Storage.CurrentContext, OwnerKey)))
            {
                VerifyOracle();
            }
            
            // Execute the requested function based on name
            if (functionName == "updatePrices")
            {
                UpdatePrices();
                return true;
            }
            else if (functionName == "processPayouts")
            {
                ProcessPayouts();
                return true;
            }
            
            return false;
        }
        
        /// <summary>
        /// Example automated function to update multiple prices
        /// </summary>
        private static void UpdatePrices()
        {
            // Implementation would request prices for multiple assets
            RequestPrice("NEO");
            RequestPrice("GAS");
            
            // Emit event
            OnContractAutomated("UpdatePrices");
        }
        
        /// <summary>
        /// Example automated function to process payouts
        /// </summary>
        private static void ProcessPayouts()
        {
            // Implementation would process some kind of payout logic
            // ...
            
            // Emit event
            OnContractAutomated("ProcessPayouts");
        }
        
        /// <summary>
        /// Verify that the caller is the contract owner
        /// </summary>
        private static void VerifyOwner()
        {
            UInt160 owner = (UInt160)Storage.Get(Storage.CurrentContext, OwnerKey);
            if (!Runtime.CheckWitness(owner))
                throw new Exception("Only the contract owner can perform this operation");
        }
        
        /// <summary>
        /// Verify that the caller is the Oracle native contract
        /// </summary>
        private static void VerifyOracle()
        {
            if (Runtime.CallingScriptHash != Oracle.Hash)
                throw new Exception("Only oracle callbacks are allowed");
        }
        
        /// <summary>
        /// Update the contract owner
        /// </summary>
        /// <param name="newOwner">Script hash of the new owner</param>
        public static void UpdateOwner(UInt160 newOwner)
        {
            VerifyOwner();
            Storage.Put(Storage.CurrentContext, OwnerKey, newOwner);
        }
    }
}