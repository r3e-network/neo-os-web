# MiniAppServiceConsumer

## Overview

MiniAppServiceConsumer is a reference implementation contract that demonstrates how to integrate with the ServiceLayerGateway to consume off-chain services. It serves as a template and example for developers building MiniApps that require external data or computation.

## What It Does

The ServiceConsumer contract provides:

- **Service Request Interface**: Methods to request various off-chain services (RNG, oracles, APIs)
- **Callback Handling**: Receives and stores results from asynchronous service calls
- **Request Tracking**: Maintains records of service requests and their outcomes
- **Developer Reference**: Shows best practices for Gateway integration

This contract is designed as both a functional utility and an educational resource for MiniApp developers.

## How It Works

### Architecture

The contract implements the standard MiniApp service consumption pattern:

- **Request-Response Model**: Initiates service requests and receives callbacks
- **State Management**: Stores the most recent callback for querying
- **Gateway Integration**: All service requests route through ServiceLayerGateway

### Core Mechanism

1. **Service Request**: Admin calls `RequestService()` with service parameters
2. **Gateway Processing**: Gateway forwards request to off-chain service layer
3. **Async Callback**: Service layer calls back with `OnServiceCallback()`
4. **State Update**: Contract stores callback data and emits event
5. **Query Interface**: Frontend can query `GetLastCallback()` for results

## Key Methods

### Public Methods

#### `RequestService(string appId, string serviceType, ByteString payload) → BigInteger`

Requests an off-chain service through the ServiceLayerGateway.

**Parameters:**

- `appId`: Application identifier for the requesting MiniApp
- `serviceType`: Type of service to request (e.g., "rng", "oracle", "api")
- `payload`: Optional data payload for the service request

**Returns:** Request ID for tracking the async operation

**Access Control:** Admin only

**Usage:** Primary method for initiating service requests

#### `RequestRng(string appId) → BigInteger`

Convenience method for requesting random number generation.

**Parameters:**

- `appId`: Application identifier

**Returns:** Request ID

**Access Control:** Admin only

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Receives asynchronous callbacks from ServiceLayerGateway services.

**Parameters:**

- `requestId`: ID of the original service request
- `appId`: Application identifier
- `serviceType`: Type of service that responded
- `success`: Whether the service call succeeded
- `result`: Service response data
- `error`: Error message if failed

**Access Control:** Gateway only

**Events Emitted:** `ServiceCallback(requestId, appId, serviceType, success)`

#### `GetLastCallback() → CallbackRecord`

Retrieves the most recent service callback data.

**Returns:** CallbackRecord struct containing:

- `RequestId`: Request identifier
- `AppId`: Application ID
- `ServiceType`: Service type
- `Success`: Success status
- `Result`: Response data
- `Error`: Error message
- `Timestamp`: Callback timestamp

**Access Control:** Public (read-only)

### Administrative Methods

#### `SetAdmin(UInt160 newAdmin)`

Transfers admin privileges to a new address.

#### `SetGateway(UInt160 gateway)`

Configures the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address.

#### `SetPaused(bool paused)`

Pauses or unpauses contract operations.

#### `Update(ByteString nef, string manifest)`

Upgrades the contract to a new version.

### Query Methods

#### `Admin() → UInt160`

Returns the current admin address.

#### `Gateway() → UInt160`

Returns the ServiceLayerGateway address.

#### `PaymentHub() → UInt160`

Returns the PaymentHub address.

#### `IsPaused() → bool`

Returns whether the contract is paused.

## Events

### `ServiceCallback`

```csharp
event ServiceCallback(BigInteger requestId, string appId, string serviceType, bool success)
```

Emitted when a service callback is received.

**Parameters:**

- `requestId`: Original request identifier
- `appId`: Application ID
- `serviceType`: Type of service
- `success`: Whether the service call succeeded

## Usage Flow

### Standard Service Request Flow

1. **Initialization**
   - Admin deploys contract
   - Admin configures Gateway address
   - Contract is registered with platform

2. **Service Request**
   - Admin calls `RequestService()` with parameters
   - Contract calls Gateway's `requestService()` method
   - Gateway returns request ID
   - Request is forwarded to off-chain service layer

3. **Async Processing**
   - Off-chain service processes request
   - Service layer prepares response
   - Gateway calls back to contract's `OnServiceCallback()`

4. **Callback Handling**
   - Contract validates caller is Gateway
   - Stores callback data in storage
   - Emits `ServiceCallback` event
   - Frontend can query `GetLastCallback()`

### Example: RNG Service Request

```csharp
// Request random number
var requestId = Contract.Call(
    serviceConsumerAddress,
    "requestRng",
    "my-miniapp"
);

// Wait for callback (async)
// OnServiceCallback will be triggered by Gateway

// Query result
var callback = Contract.Call(
    serviceConsumerAddress,
    "getLastCallback"
);

if (callback.Success) {
    var randomNumber = callback.Result;
    // Use random number in game logic
}
```

### Example: Custom Service Request

```csharp
// Request price oracle data
var payload = StdLib.Serialize(new {
    symbol = "NEO/USD",
    timestamp = Runtime.Time
});

var requestId = Contract.Call(
    serviceConsumerAddress,
    "requestService",
    "my-miniapp",
    "oracle",
    payload
);

// Callback will contain price data
```

## Data Structures

### CallbackRecord

```csharp
struct CallbackRecord {
    BigInteger RequestId;
    string AppId;
    string ServiceType;
    bool Success;
    ByteString Result;
    string Error;
    BigInteger Timestamp;
}
```

## Security Considerations

1. **Gateway-Only Callbacks**: Only Gateway can call `OnServiceCallback()`
2. **Admin-Only Requests**: Only admin can initiate service requests
3. **Request Validation**: Gateway validates all service requests
4. **State Integrity**: Callback data is serialized and stored securely

## Integration Points

- **ServiceLayerGateway**: Primary integration for all service requests
- **Off-Chain Services**: RNG, oracles, APIs, computation
- **Frontend**: Queries callback results for UI updates

## Developer Notes

This contract serves as a reference implementation. Developers should:

- Study the request-callback pattern
- Implement similar patterns in their MiniApps
- Extend with custom service types
- Add business logic in callback handling

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` if payment integration needed
4. Register with AppRegistry
5. Test service requests and callbacks

## Version

**Version:** 1.0.0
**Author:** R3E Network
**Email:** dev@r3e.network
**Description:** Sample MiniApp contract using ServiceLayerGateway callbacks
