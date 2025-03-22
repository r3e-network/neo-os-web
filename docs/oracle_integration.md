# Oracle Service Integration Guide

This guide explains how to use the Oracle service to bring external data to your Neo N3 smart contracts.

## Overview

The Oracle service allows your smart contracts to access external data from various sources, including:

- HTTP REST APIs
- WebSockets
- Blockchain data from other networks
- Databases and other data sources

The service handles data fetching, validation, transformation, and on-chain delivery, allowing your contracts to make decisions based on real-world information.

## How It Works

The Oracle service follows this workflow:

1. You create a data source in the Oracle service that defines how to fetch external data
2. You deploy a smart contract that implements the Oracle consumer interface
3. Your contract calls the Oracle service to request data
4. The Oracle service fetches the data from the external source
5. The Oracle service processes and validates the data
6. The Oracle service delivers the data to your contract's callback function

## Setting Up the Oracle Service

### 1. Create a Data Source

Log in to the Service Layer dashboard and navigate to the Oracle service. Create a new data source with:

- **Name**: A descriptive name for the data source
- **Description**: What kind of data this source provides
- **Source Type**: The type of source (HTTP, WebSocket, etc.)
- **URL**: The endpoint URL to fetch data from
- **Method**: The HTTP method (for HTTP sources)
- **Headers**: Any required HTTP headers
- **Authentication**: Authentication parameters if needed
- **JSON Path**: The path to extract specific data from the response
- **Transform**: Optional JavaScript function to transform the data

### 2. Test the Data Source

Before using the data source in production, test it to ensure it returns the expected data. The dashboard provides a testing interface that shows:

- Raw response from the external source
- Extracted data based on the JSON path
- Transformed data after applying your transform function
- Any errors that occurred during the process

### 3. Implement the Oracle Consumer Contract

Your Neo N3 smart contract needs to implement the Oracle consumer interface:

```csharp
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;
using System;
using System.ComponentModel;

public class OracleConsumer : SmartContract
{
    // Define the Oracle service address
    [InitialValue("NYjzimcfDdjzRhzDrpKnnLGSrWNMdH85aH", ContractParameterType.Hash160)]
    static readonly UInt160 OracleContract = default;
    
    // Event to notify when oracle data is received
    [DisplayName("OracleDataReceived")]
    public static event Action<string, string> OnOracleDataReceived;
    
    // Request data from the oracle
    public static bool RequestOracleData(string dataSourceName)
    {
        // Only allow the contract owner to request data
        if (!Runtime.CheckWitness(Owner))
            return false;
            
        // Call the Oracle service to request data
        // The Oracle service will call back to OracleCallback with the result
        byte[] result = Contract.Call(OracleContract, "requestData", 
            CallFlags.All, new object[] { dataSourceName, Runtime.ExecutingScriptHash });
            
        return (bool)result;
    }
    
    // Callback function that the Oracle service will call
    public static void OracleCallback(string requestId, string data, byte[] proof)
    {
        // Verify the caller is the Oracle service
        if (Runtime.CallingScriptHash != OracleContract)
            throw new Exception("Unauthorized oracle response");
            
        // Process the received data
        ProcessOracleData(requestId, data);
        
        // Emit event
        OnOracleDataReceived(requestId, data);
    }
    
    // Process the oracle data (implement your specific logic here)
    private static void ProcessOracleData(string requestId, string data)
    {
        // Implement your business logic here
        // For example, update a price, trigger an action, etc.
        Storage.Put(Storage.CurrentContext, requestId, data);
    }
}
```

### 4. Request Oracle Data

To request data from your smart contract:

```csharp
// Request data from a specific data source
bool success = OracleConsumer.RequestOracleData("BTC_PRICE");

// The result will be delivered to the OracleCallback function
```

## Oracle Request Types

The service supports different types of oracle requests:

### One-time Request

A single request for data, useful for:
- Contract initialization
- User-triggered actions
- One-time decision making

### Scheduled Request

Regular updates of data at specified intervals, useful for:
- Price feeds
- Weather data
- Regular contract updates

### Event-triggered Request

Data requests triggered by blockchain events, useful for:
- Responding to transfers
- Contract state changes
- Conditional updates

## Data Transformation

The Oracle service allows you to transform data before it's delivered to your contract:

```javascript
// Example transform function
function transform(data) {
  // Parse the JSON if needed
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  
  // Extract and format the price
  const price = parsed.price;
  
  // Convert to an integer (remove decimal places)
  // For example, convert $45,123.45 to 4512345
  return Math.round(price * 100);
}
```

## Security Considerations

When using the Oracle service, keep these security considerations in mind:

1. **Data Validation**: Always validate the received data in your contract
2. **Single Source of Truth**: Be careful about relying on a single data source
3. **Data Staleness**: Consider how often the data needs to be updated
4. **Caller Verification**: Always verify that the callback is from the Oracle service
5. **Error Handling**: Implement proper error handling for oracle failures

## Advanced Features

### Multiple Data Sources

For critical applications, use multiple data sources for the same data to increase reliability:

```csharp
// Request data from multiple sources
OracleConsumer.RequestOracleData("BTC_PRICE_SOURCE_1");
OracleConsumer.RequestOracleData("BTC_PRICE_SOURCE_2");
OracleConsumer.RequestOracleData("BTC_PRICE_SOURCE_3");

// Implement a data aggregation strategy in your contract
```

### Custom Data Processing

Implement custom data processing logic in your contract:

```csharp
// Process oracle data with custom logic
private static void ProcessOracleData(string requestId, string data)
{
    // Parse the data (e.g., from JSON string)
    int price = (int)StdLib.JsonDeserialize(data)["price"];
    
    // Get previously stored price
    byte[] storedData = Storage.Get(Storage.CurrentContext, "LastPrice");
    int lastPrice = storedData.Length > 0 ? (int)StdLib.JsonDeserialize(storedData)["price"] : 0;
    
    // Calculate price change percentage
    int changePercent = lastPrice > 0 ? ((price - lastPrice) * 100 / lastPrice) : 0;
    
    // Store the current price
    Storage.Put(Storage.CurrentContext, "LastPrice", data);
    
    // Take action based on price change
    if (Math.Abs(changePercent) > 5)
    {
        // Significant price change, trigger an action
        TriggerPriceAlert(price, changePercent);
    }
}
```

## Troubleshooting

### Common Issues

1. **Request Timeout**: The external source didn't respond in time
   - Check the data source URL and connectivity
   - Increase the timeout parameter if needed

2. **Data Format Error**: The response wasn't in the expected format
   - Check the JSON path expression
   - Verify the external API hasn't changed its response format

3. **Transform Error**: The transform function failed
   - Check your transformation logic for errors
   - Ensure the input data matches what your function expects

4. **Callback Failure**: The callback to your contract failed
   - Verify your contract implements the correct callback method
   - Check for errors in your callback logic

### Support

For additional support with the Oracle service:

1. Check the detailed logs in the dashboard
2. Review the Oracle documentation
3. Contact the Service Layer support team

## Example Use Cases

### Price Feed Contract

```csharp
public class PriceFeedContract : SmartContract
{
    // ... oracle implementation ...
    
    // Process price data
    private static void ProcessOracleData(string requestId, string data)
    {
        // Parse price data
        int price = (int)StdLib.JsonDeserialize(data)["price"];
        
        // Store the current price
        Storage.Put(Storage.CurrentContext, "CurrentPrice", price.ToString());
        
        // Check if price triggers any conditions
        CheckPriceConditions(price);
    }
    
    // Return the current price to callers
    public static int GetCurrentPrice()
    {
        byte[] data = Storage.Get(Storage.CurrentContext, "CurrentPrice");
        return data.Length > 0 ? int.Parse(data) : 0;
    }
}
```

### Weather-Dependent Contract

```csharp
public class WeatherContract : SmartContract
{
    // ... oracle implementation ...
    
    // Process weather data
    private static void ProcessOracleData(string requestId, string data)
    {
        // Parse weather data
        Map<string, object> weatherData = (Map<string, object>)StdLib.JsonDeserialize(data);
        int temperature = (int)weatherData["temperature"];
        string conditions = (string)weatherData["conditions"];
        
        // Store weather data
        Storage.Put(Storage.CurrentContext, "Temperature", temperature.ToString());
        Storage.Put(Storage.CurrentContext, "Conditions", conditions);
        
        // Take action based on weather
        if (temperature > 30 && conditions == "sunny")
        {
            TriggerHeatAlert();
        }
    }
}
```

## Conclusion

The Oracle service provides a powerful way to connect your Neo N3 smart contracts with external data. By following this guide, you can integrate Oracle functionality into your contracts and build more dynamic and responsive blockchain applications. 