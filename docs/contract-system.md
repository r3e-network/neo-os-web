# Service Layer Contract System Architecture

This document describes the smart contract architecture for the Service Layer, following an Android OS-style pattern where the engine provides core contracts and services can register their own contracts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Contracts                          │
│  (Custom business logic deployed via SDK)                   │
├─────────────────────────────────────────────────────────────┤
│                   Service Contracts                         │
│  Oracle │ VRF │ DataFeeds │ Automation │ CCIP │ DTA │ etc  │
├─────────────────────────────────────────────────────────────┤
│                   Engine Contracts                          │
│  Manager │ AccountManager │ ServiceRegistry │ GasBank       │
└─────────────────────────────────────────────────────────────┘
```

## Contract Categories

### 1. Engine Contracts (Core Infrastructure)

Managed by the Service Layer core. These contracts provide fundamental infrastructure:

| Contract | File | Purpose |
|----------|------|----------|
| Manager | `Manager.cs` | Module registry, roles, pause flags |
| AccountManager | `AccountManager.cs` | Account/workspace and wallet management |
| ServiceRegistry | `ServiceRegistry.cs` | Service registration and capabilities |
| GasBank | `GasBank.cs` | GAS deposit/withdrawal, fee collection |
| OracleHub | `OracleHub.cs` | Oracle request/response coordination |
| RandomnessHub | `RandomnessHub.cs` | VRF randomness provisioning |
| DataFeedHub | `DataFeedHub.cs` | Price feed aggregation |
| AutomationScheduler | `AutomationScheduler.cs` | Job scheduling |
| SecretsVault | `SecretsVault.cs` | Encrypted secret storage |
| JAMInbox | `JAMInbox.cs` | Cross-chain message inbox |

### 2. Service Contracts

Per-service contracts that integrate with engine contracts. Services declare contract requirements in their Manifest:

```go
func (s *Service) Manifest() *framework.Manifest {
    return &framework.Manifest{
        Name:         "oracle",
        RequiresAPIs: []engine.APISurface{engine.APISurfaceContracts},
        // Contract bindings configured separately
    }
}
```

### 3. User Contracts

Custom contracts deployed by users through the SDK:

```go
import "github.com/R3E-Network/service_layer/sdk/go/contract"

spec := contract.NewSpec("MyContract").
    WithCapabilities(contract.CapOracleRequest, contract.CapGasBankRead).
    WithMethod("processData", []contract.Param{{Name: "data", Type: "bytes"}}, nil).
    Build()
```

## Go Package Structure

```
domain/contract/           # Domain models
├── contract.go            # Contract, Invocation, Deployment types
├── template.go            # Template, NetworkConfig types
└── contract_test.go

pkg/storage/
└── interfaces.go          # ContractStore interface

packages/com.r3e.services.contracts/
├── service.go             # Main service implementation
├── templates.go           # Template management
└── service_test.go

sdk/go/contract/           # Developer SDK
├── contract.go            # Core types and interfaces
├── builder.go             # Fluent spec builder
├── base.go                # Base contract helpers
└── contract_test.go

contracts/neo-n3/          # Neo N3 contract sources (C#)
├── Manager.cs
├── AccountManager.cs
├── ServiceRegistry.cs
└── ...
```

## Domain Models

### Contract

```go
type Contract struct {
    ID           string
    AccountID    string          // Owner workspace
    ServiceID    string          // Owning service (e.g., "oracle")
    Name         string
    Type         ContractType    // engine|service|user
    Network      Network         // neo-n3|ethereum|...
    Address      string          // Deployed address
    CodeHash     string          // SHA256 of bytecode
    Version      string
    ABI          string          // Contract ABI (JSON)
    Bytecode     string          // Compiled bytecode
    Status       ContractStatus  // draft|active|paused|...
    Capabilities []string
}
```

### Template

```go
type Template struct {
    ID          string
    ServiceID   string          // Empty for engine templates
    Name        string
    Category    TemplateCategory // engine|token|oracle|...
    Networks    []Network
    ABI         string
    Bytecode    string
    Audited     bool
    Status      TemplateStatus
}
```

## Integration with Account System

All contracts automatically integrate with the Service Layer account system:

1. **Workspace Ownership**: Contracts belong to workspaces (accounts)
2. **Wallet Binding**: Contract signers must be registered workspace wallets
3. **GasBank Integration**: Gas funded from account's GasBank allocation

```go
// In AccountManager.cs
public struct Account {
    public ByteString Id;
    public UInt160 Owner;
    public ByteString MetadataHash;
}

public struct Wallet {
    public ByteString AccountId;
    public UInt160 Address;
    public byte Status;  // 0=active, 1=revoked
}
```

## Service Contract Binding

Services bind to contracts through `ServiceContractBinding`:

```go
type ServiceContractBinding struct {
    ServiceID  string  // e.g., "oracle"
    AccountID  string  // Workspace
    ContractID string  // Deployed contract
    Network    Network
    Role       string  // consumer|provider|admin
    Enabled    bool
}
```

## Contract SDK Usage

### Basic Contract Specification

```go
package main

import "github.com/R3E-Network/service_layer/sdk/go/contract"

func main() {
    // Build contract specification
    spec := contract.NewSpec("PriceOracle").
        WithSymbol("ORACLE").
        WithDescription("Custom price oracle contract").
        WithNetworks(contract.NetworkNeoN3).
        WithCapabilities(
            contract.CapOracleRequest,
            contract.CapFeedRead,
            contract.CapGasBankRead,
        ).
        WithMethod("requestPrice",
            []contract.Param{{Name: "pair", Type: "string"}},
            []contract.Param{{Name: "requestId", Type: "uint256"}},
        ).
        WithViewMethod("getLatestPrice",
            []contract.Param{{Name: "pair", Type: "string"}},
            []contract.Param{{Name: "price", Type: "uint256"}, {Name: "timestamp", Type: "uint256"}},
        ).
        WithEvent("PriceRequested", []contract.Param{
            {Name: "requestId", Type: "uint256", Indexed: true},
            {Name: "pair", Type: "string"},
        }).
        Build()

    // Register with Service Layer
    // client.Contracts.Register(ctx, spec)
}
```

### Implementing Contract Handler

```go
type MyContract struct {
    *contract.BaseContract
}

func NewMyContract(spec contract.Spec) *MyContract {
    return &MyContract{
        BaseContract: contract.NewBaseContract(spec),
    }
}

func (c *MyContract) HandleInvoke(ctx context.Context, method string, args map[string]any) (any, error) {
    // Verify account ownership
    cc, _ := contract.FromContext(ctx)
    if err := c.RequireAccount(ctx, cc.AccountID); err != nil {
        return nil, err
    }

    switch method {
    case "requestPrice":
        return c.handleRequestPrice(ctx, args)
    case "getLatestPrice":
        return c.handleGetLatestPrice(ctx, args)
    default:
        return nil, contract.NewError(contract.ErrInvalidInput, "unknown method")
    }
}
```

## Neo N3 Contract Alignment

The Go domain models align with Neo N3 contract structures:

| Go Type | Neo N3 Contract | Field Mapping |
|---------|-----------------|---------------|
| `contract.Contract` | `ServiceRegistry.Service` | ID→Id, AccountID→Owner, etc. |
| `gasbank.Account` | `AccountManager.Wallet` | WalletAddress→Address, Status maps |
| `contract.NetworkConfig` | Manager module registry | Network→module hash mappings |

### Role Mapping

Manager.cs roles map to contract capabilities:

```csharp
// Manager.cs
public const byte RoleAdmin = 0x01;
public const byte RoleScheduler = 0x02;
public const byte RoleOracleRunner = 0x04;
public const byte RoleRandomnessRunner = 0x08;
public const byte RoleJamRunner = 0x10;
public const byte RoleDataFeedSigner = 0x20;
```

```go
// sdk/go/contract/contract.go
const (
    CapOracleProvide = "oracle:provide"   // → RoleOracleRunner
    CapVRFProvide    = "vrf:provide"      // → RoleRandomnessRunner
    CapFeedWrite     = "feed:write"       // → RoleDataFeedSigner
    CapAutomation    = "automation"       // → RoleScheduler
)
```

## Deployment Flow

1. **Register Contract**: Store contract metadata in Service Layer DB
2. **Deploy**: Submit bytecode to blockchain via Deployer
3. **Bind Service**: Create ServiceContractBinding for service integration
4. **Invoke**: Call contract methods via Invoker

```
User/Service → Contracts Service → Deployer/Invoker → Blockchain
                     ↓
               ContractStore (Postgres)
```

## Network Support

Supported networks (defined in `domain/contract/contract.go`):

- `neo-n3` - Neo N3 mainnet/testnet
- `neo-x` - Neo X EVM sidechain
- `ethereum` - Ethereum mainnet
- `polygon`, `arbitrum`, `optimism`, `base` - L2s
- `avalanche`, `bsc` - Alt L1s
- `testnet`, `local-priv` - Development

## Backend Event System

The Service Layer backend monitors contract events and processes service requests through the **Service Engine V2** automated workflow.

```
┌─────────────────────────────────────────────────────────────┐
│                   Neo Blockchain                             │
│  (Contract events emitted via Runtime.Notify)               │
└────────────────────────┬────────────────────────────────────┘
                         │ Event: ServiceRequest / OracleRequested / etc.
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   neo-indexer                                │
│  (Monitors blocks, stores notifications in PostgreSQL)      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   IndexerBridge                              │
│  (Polls neo_notifications, converts to ContractEventData)   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ServiceBridge                              │
│  - Parses event → ServiceRequest                            │
│  - Maps event type to service/method                        │
│  - Routes to ServiceEngine                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ServiceEngine                              │
│  - Loads InvocableServiceV2 by name                         │
│  - Validates method declaration                             │
│  - Invokes method with params                               │
│  - Handles MethodResult based on CallbackMode               │
│  - Sends callback via CallbackSender                        │
└────────────────────────┬────────────────────────────────────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Oracle    │  │     VRF     │  │ Automation  │
│  ServiceV2  │  │  ServiceV2  │  │  ServiceV2  │
└─────────────┘  └─────────────┘  └─────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   CallbackSender                             │
│  - Builds callback params (request_id, result_hash, status) │
│  - Sends fulfill transaction to callback contract           │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `IndexerBridge` | `system/events/indexer_bridge.go` | Polls neo_notifications, dispatches events |
| `ServiceBridge` | `system/engine/bridge.go` | Parses events, routes to ServiceEngine |
| `ServiceEngine` | `system/engine/invocable.go` | Automatic service invocation and callback |
| `CallbackSender` | `system/engine/callback.go` | Sends results back to contracts |
| `InvocableServiceV2` | `system/framework/method.go` | Service interface with method declarations |

### Event Flow (Service Engine V2)

1. **Contract emits event** (e.g., `ServiceRequest`, `OracleRequested`)
2. **neo-indexer** captures and stores in `neo_notifications`
3. **IndexerBridge** polls and converts to `ContractEventData`
4. **ServiceBridge** parses event into `ServiceRequest` with service/method/params
5. **ServiceEngine** loads `InvocableServiceV2` and invokes method
6. **Service** processes request and returns result
7. **ServiceEngine** checks `CallbackMode` and sends callback if required
8. **CallbackSender** submits fulfill transaction to blockchain

### Service Method Types

Services declare methods with explicit types and callback behavior:

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

For complete Service Engine documentation, see [Service Engine Guide](service-engine.md).

## User API

Direct user interactions (non-blockchain) are handled by the User API:

| Endpoint | Manager | Purpose |
|----------|---------|---------|
| `/api/v1/accounts` | `AccountManager` | Account CRUD, wallet linking |
| `/api/v1/secrets` | `SecretsManager` | Encrypted secret storage |
| `/api/v1/contracts` | `ContractManager` | Contract registration |
| `/api/v1/functions` | `AutomationManager` | Function deployment, triggers |
| `/api/v1/balance` | `GasBankManager` | Balance queries, fee estimation |
| `/api/v1/requests` | `RequestRouter` | Service request submission |

See `system/api/` for implementations and `system/bootstrap/wiring.go` for component wiring.

## Future Extensions

1. **Multi-sig Deployment**: Require multiple approvals for deployment
2. **Upgrade Patterns**: Proxy contract support
3. **Cross-chain Messaging**: CCIP integration for cross-chain contracts
4. **Contract Verification**: On-chain source verification
5. **Gas Estimation**: Pre-deployment gas estimation
