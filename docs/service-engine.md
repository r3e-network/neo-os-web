# Service Engine Architecture

This document describes the automated service invocation framework that connects blockchain contract events to service execution and callback handling.

## Overview

The Service Engine provides a fully automated workflow:

1. **Contract Event** → User submits request via smart contract
2. **Event Detection** → IndexerBridge polls blockchain notifications
3. **Request Parsing** → ServiceBridge parses event into ServiceRequest
4. **Service Invocation** → ServiceEngine loads service and invokes method
5. **Callback Sending** → CallbackSender sends result back to contract

```
┌─────────────────────────────────────────────────────────────────┐
│                     Neo Blockchain                               │
│  User Contract → ServiceRequest Event → Service Layer Contracts │
└────────────────────────┬────────────────────────────────────────┘
                         │ Event: ServiceRequest
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   IndexerBridge                                  │
│  (Polls neo_notifications, converts to ContractEventData)       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ServiceBridge                                  │
│  - Parses event → ServiceRequest                                │
│  - Maps event type to service/method                            │
│  - Routes to ServiceEngine                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ServiceEngine                                  │
│  - Loads InvocableServiceV2 by name                             │
│  - Validates method declaration from MethodRegistry             │
│  - Invokes method with params                                   │
│  - Sends callback based on CallbackMode                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Oracle    │  │     VRF     │  │ Automation  │
│   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CallbackSender                                 │
│  - Builds callback params                                       │
│  - Sends fulfill transaction to contract                        │
└─────────────────────────────────────────────────────────────────┘
```

## Service Method Types

Services declare methods with explicit types and callback behavior:

### Method Types

| Type | Description | Callback |
|------|-------------|----------|
| `init` | Called once at service deployment | None |
| `invoke` | Standard method called by contract events | Required/Optional |
| `view` | Read-only method, no state changes | None |
| `admin` | Administrative method requiring elevated permissions | Optional |

### Callback Modes

| Mode | Description |
|------|-------------|
| `none` | No callback sent (void method) |
| `required` | Callback MUST be sent with result |
| `optional` | Callback sent only if result is non-nil |
| `on_error` | Callback sent only on error |

## Implementing a Service

### 1. Define Method Declarations

```go
func (s *MyService) buildRegistry() *framework.ServiceMethodRegistry {
    builder := framework.NewMethodRegistryBuilder("myservice")

    // Init method - called once at deployment
    builder.WithInit(
        framework.NewMethod("init").
            AsInit().
            WithDescription("Initialize service with configuration").
            WithOptionalParam("config_key", "string", "Configuration value", "default").
            Build(),
    )

    // Invoke method - called by contract events, sends callback
    builder.WithMethod(
        framework.NewMethod("process").
            WithDescription("Process a request").
            RequiresCallback().
            WithDefaultCallbackMethod("fulfill").
            WithParam("data", "string", "Input data").
            WithOptionalParam("options", "map", "Processing options", nil).
            WithMaxExecutionTime(30000).
            WithMinFee(100000).
            Build(),
    )

    // View method - read-only, no callback
    builder.WithMethod(
        framework.NewMethod("getStatus").
            AsView().
            WithDescription("Get current status").
            Build(),
    )

    return builder.Build()
}
```

### 2. Implement InvocableServiceV2 Interface

```go
type MyService struct {
    registry    *framework.ServiceMethodRegistry
    initialized bool
    config      MyConfig
}

// ServiceName returns the unique service identifier.
func (s *MyService) ServiceName() string {
    return "myservice"
}

// MethodRegistry returns the service's method declarations.
func (s *MyService) MethodRegistry() *framework.ServiceMethodRegistry {
    return s.registry
}

// Initialize is called once when the service is deployed.
func (s *MyService) Initialize(ctx context.Context, params map[string]any) error {
    if s.initialized {
        return fmt.Errorf("service already initialized")
    }

    // Apply configuration from params
    if val, ok := params["config_key"].(string); ok {
        s.config.Key = val
    }

    s.initialized = true
    return nil
}

// Invoke calls a method with the given parameters.
func (s *MyService) Invoke(ctx context.Context, method string, params map[string]any) (any, error) {
    switch strings.ToLower(method) {
    case "process":
        return s.process(ctx, params)
    case "getstatus":
        return s.getStatus(ctx, params)
    default:
        return nil, fmt.Errorf("unknown method: %s", method)
    }
}

func (s *MyService) process(ctx context.Context, params map[string]any) (any, error) {
    data, _ := params["data"].(string)
    if data == "" {
        return nil, fmt.Errorf("data is required")
    }

    // Process the data...
    result := processData(data)

    // Return result - callback will be sent automatically
    return map[string]any{
        "result":    result,
        "timestamp": time.Now().UTC().Unix(),
    }, nil
}

func (s *MyService) getStatus(ctx context.Context, params map[string]any) (any, error) {
    // View method - no callback sent
    return map[string]any{
        "initialized": s.initialized,
        "config":      s.config,
    }, nil
}
```

### 3. Register with ServiceEngine

```go
engine := NewServiceEngine(ServiceEngineConfig{
    CallbackSender: neoCallbackSender,
})

myService := NewMyService()
engine.RegisterService(myService)
```

## Contract Event Format

### New Format (ServiceRequest)

The recommended event format explicitly specifies service and method:

```json
{
  "id": "request-123",
  "service": "oracle",
  "method": "fetch",
  "params": {
    "url": "https://api.example.com/data",
    "method": "GET"
  },
  "callback_contract": "0x1234...",
  "callback_method": "fulfill",
  "account_id": "account-456",
  "fee": 1000000
}
```

### Legacy Format

Legacy events (OracleRequested, RandomnessRequested, etc.) are automatically mapped:

| Event | Service | Method |
|-------|---------|--------|
| `OracleRequested` | oracle | fetch |
| `RandomnessRequested` | vrf | generate |
| `JobDue` | automation | execute |

## Built-in Services

### Oracle Service

| Method | Type | Callback | Description |
|--------|------|----------|-------------|
| `init` | init | none | Initialize with timeout, max response size |
| `fetch` | invoke | required | Fetch data from HTTP endpoint |
| `fetchJSON` | invoke | required | Fetch JSON and extract field |
| `aggregate` | invoke | required | Aggregate from multiple sources |
| `getConfig` | view | none | Get current configuration |

### VRF Service

| Method | Type | Callback | Description |
|--------|------|----------|-------------|
| `init` | init | none | Initialize with key configuration |
| `generate` | invoke | required | Generate verifiable random output |
| `verify` | invoke | required | Verify a VRF proof |
| `getPublicKey` | view | none | Get VRF public key |

### Automation Service

| Method | Type | Callback | Description |
|--------|------|----------|-------------|
| `init` | init | none | Initialize service |
| `execute` | invoke | required | Execute scheduled job |
| `checkUpkeep` | invoke | required | Check if upkeep needed |
| `getJobStatus` | view | none | Get job status |

## Callback Handling

When a method returns a result and has `CallbackMode != none`, the ServiceEngine automatically sends a callback transaction:

```go
// Method returns result
return map[string]any{
    "value": 42,
    "timestamp": time.Now().Unix(),
}, nil

// ServiceEngine sends callback to contract:
// Contract: req.CallbackContract
// Method: req.CallbackMethod (default: "fulfill")
// Args: [request_id, result_hash, status]
```

### Callback Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `request_id` | ByteString | Original request ID |
| `result_hash` | ByteString | SHA256 hash of result |
| `status` | Integer | 1=success, 2=failed |

## Error Handling

Errors are automatically handled and can trigger error callbacks:

```go
// Method returns error
return nil, fmt.Errorf("processing failed: %v", err)

// If CallbackMode is required or on_error:
// Callback sent with status=2 and error message
```

## File Structure

```
system/engine/
├── invocable.go       # ServiceEngine, ServiceRequest, MethodResult, CallbackSender
├── callback.go        # CallbackSender implementations (Neo, Mock)
├── bridge.go          # ServiceBridge - connects contract events to engine
├── service_v2.go      # OracleServiceV2, VRFServiceV2, AutomationServiceV2
└── engine_test.go     # Test suite

system/framework/
├── method.go          # InvocableServiceV2, MethodDeclaration, MethodType, CallbackMode
├── manifest.go        # Service manifest
└── base.go            # ServiceBase with state management
```

## Testing

```bash
# Run engine tests
go test -v ./system/engine/...

# Run framework tests
go test -v ./system/framework/...
```

## See Also

- [Contract System](contract-system.md) - Smart contract architecture
- [Framework Guide](framework-guide.md) - ServiceBase and Manifest
- [Developer Guide](developer-guide.md) - Building services
