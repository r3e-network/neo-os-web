# Neo N3 Smart Contracts

This directory contains the Neo N3 smart contracts used by the Service Layer.

The current contract set is designed around a single entry-point contract (`ServiceLayerGateway`) that:

- routes user requests to service contracts,
- validates TEE signatures for fulfillments/failures,
- manages fees and replay protection.

## Contracts (Current)

| Contract | Display Name | Source | Notes |
|---|---|---|---|
| Gateway | `ServiceLayerGateway` | `contracts/gateway/ServiceLayerGateway.cs` | Main entry point for service requests + callbacks |
| Data Feeds | `DataFeedsService` | `services/datafeed/contract/NeoFeedsService*.cs` | Push/auto-update pattern |
| Automation | `NeoFlowService` | `services/automation/contract/NeoFlowService*.cs` | Trigger registration + execution |
| Conf Compute | `ConfidentialService` | `services/confcompute/contract/NeoComputeService*.cs` | Request/response pattern |
| Conf Oracle | `OracleService` | `services/conforacle/contract/NeoOracleService*.cs` | Request/response pattern |

## Platform Contracts (MiniApp)

These contracts support the MiniApp platform model (payments in GAS only, governance in NEO only):

| Contract | Display Name | Source | Notes |
|---|---|---|---|
| Payments | `PaymentHub` | `contracts/PaymentHub/PaymentHub.cs` | GAS-only payments + settlement |
| Governance | `Governance` | `contracts/Governance/Governance.cs` | NEO-only staking + voting skeleton |
| Price Feeds | `PriceFeed` | `contracts/PriceFeed/PriceFeed.cs` | Stores price rounds + attestation hash |
| Randomness | `RandomnessLog` | `contracts/RandomnessLog/RandomnessLog.cs` | Stores randomness + attestation hash |
| App Registry | `AppRegistry` | `contracts/AppRegistry/AppRegistry.cs` | App manifest hash + status |
| Automation | `AutomationAnchor` | `contracts/AutomationAnchor/AutomationAnchor.cs` | Task registry + anti-replay |

Example consumer contracts:

- `contracts/examples/ExampleConsumer.cs`
- `contracts/examples/DeFiPriceConsumer.cs`

## Patterns

 - **Request/Response** (Oracle, Confidential): user contract calls `ServiceLayerGateway.RequestService(...)` → service contract emits event → enclave processes → `ServiceLayerGateway.FulfillRequest(...)` → user callback.
- **Push / Auto-Update** (DataFeeds): enclave periodically updates on-chain feed state.
- **Triggers** (NeoFlow): user registers triggers → enclave evaluates conditions → executes callbacks.

## Build

Prereq: install the Neo C# compiler:

```bash
dotnet tool install -g Neo.Compiler.CSharp
```

Build all contracts:

```bash
cd contracts
./build.sh
```

Build outputs:

- `contracts/build/*.nef`
- `contracts/build/*.manifest.json`

## Deploy & Initialize

Local (Neo Express) deployment helpers live under `deploy/`:

```bash
make -C deploy setup
make -C deploy run-neoexpress
make -C deploy deploy
make -C deploy init
```

For details and testnet notes, see `deploy/README.md`.
