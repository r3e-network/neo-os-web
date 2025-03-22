# Neo N3 Service Layer Integration Example

This document provides an example of how to integrate a Neo N3 smart contract with the Neo N3 Service Layer.

## Prerequisites

- [Neo Blockchain Toolkit](https://github.com/neo-project/neo-blockchain-toolkit)
- [Visual Studio Code](https://code.visualstudio.com/) with the Neo Blockchain Toolkit extension
- Access to the Neo N3 Service Layer API

## Sample Smart Contract

The `OracleConsumer.cs` contract in the `contracts` directory demonstrates how to integrate with the Neo N3 Service Layer. This contract includes examples of using:

1. **Price Feed Service** - Retrieves token prices from the service layer
2. **Random Number Generation** - Gets verifiable random numbers
3. **Contract Automation** - Allows functions to be triggered by the service layer

## Price Feed Integration

The contract can request and receive asset prices from the Service Layer:

```csharp
// Request a price update
public static void RequestPrice(string assetSymbol)
{
    // Only contract owner can request price updates
    VerifyOwner();
    
    // Construct the oracle request URL with the asset symbol
    string url = $"{PriceFeedURL}/{assetSymbol}";
    
    // Make the oracle request and store the request ID
    Oracle.Request(url, "getPrice", "callback", null, Oracle.MinimumResponseFee);
}
```

The callback function processes the response:

```csharp
public static void Callback(string url, byte[] userData, int code, byte[] result)
{
    // Ensure callback is from the Oracle native contract
    VerifyOracle();
    
    // Parse the asset symbol from the URL
    string[] urlParts = url.Split('/');
    string assetSymbol = urlParts[urlParts.Length - 1];
    
    // Parse the price result
    BigInteger price = BigInteger.Parse(result.ToByteString());
    
    // Store the price
    Storage.Put(Storage.CurrentContext, PriceKey + assetSymbol, price);
    
    // Emit event
    OnPriceUpdated(assetSymbol, price);
}
```

## Random Number Integration

Requesting random numbers:

```csharp
public static void RequestRandom(BigInteger min, BigInteger max)
{
    // Only contract owner can request random numbers
    VerifyOwner();
    
    // Construct the oracle request URL with parameters
    string url = $"{RandomGeneratorURL}?min={min}&max={max}";
    
    // Make the oracle request
    Oracle.Request(url, "getRandom", "randomCallback", null, Oracle.MinimumResponseFee);
}
```

## Contract Automation Integration

The contract exposes a function that can be called by the Service Layer's automation system:

```csharp
public static bool ExecuteAutomation(string functionName)
{
    // Verify the caller has permission
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
```

## Deployment Instructions

1. Open the contract in Visual Studio Code with the Neo Blockchain Toolkit
2. Compile the contract using the Neo Compiler
3. Deploy the contract to the Neo N3 blockchain
4. Get the contract hash and register it with the Service Layer
5. Set up automation triggers in the Service Layer dashboard

## Setting Up Automation Triggers

In the Service Layer dashboard:

1. Navigate to "Contract Automation"
2. Click "Add Trigger"
3. Select the trigger type:
   - Time-based: Use cron syntax to specify schedule
   - Price-based: Set price thresholds
   - Event-based: React to blockchain events
4. Configure the contract hash and method to call
5. Set any parameters required by the method
6. Save the trigger

## Example API Requests

### Register Contract for Automation

```http
POST /v1/triggers
Content-Type: application/json
Authorization: Bearer {your_token}

{
  "name": "Daily Price Update",
  "description": "Updates token prices every day at midnight",
  "trigger_type": "cron",
  "trigger_config": {
    "schedule": "0 0 * * *",
    "timezone": "UTC"
  },
  "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
  "method": "executeAutomation",
  "parameters": [
    {
      "type": "String",
      "value": "updatePrices"
    }
  ]
}
```

### Set Up Price Feed

```http
POST /v1/pricefeeds
Content-Type: application/json
Authorization: Bearer {your_token}

{
  "asset_pair": "NEO/USD",
  "frequency": 300,
  "sources": [
    "binance",
    "huobi",
    "gate"
  ],
  "aggregation": "median",
  "deviation": 0.5
}
```

## Verifying Integration

1. Monitor the contract events using Neo Tracker or a similar tool
2. Check the Service Layer logs for trigger executions
3. Verify data is being correctly updated on the blockchain

## Security Considerations

1. Always verify the caller in contract functions that can be triggered externally
2. Use proper validation for oracle callbacks
3. Implement access control for sensitive operations
4. Consider implementing a delay mechanism for critical financial operations