# Neo N3 Smart Contracts

This directory contains the Neo N3 MiniApp Platform contracts. Miniapp
contracts and contract frameworks are maintained in the miniapps repo and are
not built from this codebase.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                       User / Frontend                          │
│            (Invoke platform + SDK entrypoints)                 │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                  ServiceLayerGateway Contract                  │
│   (Route requests to TEE, deliver callbacks)                   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    TEE Service Layer (EGo)                     │
│   rng / pricefeed / bridge-oracle / compute (attested TLS)     │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Platform Contracts (C#)                     │
│   AppRegistry · AutomationAnchor · PauseRegistry               │
│   PaymentHub · PriceFeed · RandomnessLog                       │
│   ServiceLayerGateway                                         │
└────────────────────────────────────────────────────────────────┘
```

## Platform Contracts

| Contract                | Source                                       | Description                                        |
| ----------------------- | -------------------------------------------- | -------------------------------------------------- |
| **AppRegistry**         | `AppRegistry/AppRegistry.cs`                 | Miniapp manifest and status registry               |
| **AutomationAnchor**    | `AutomationAnchor/AutomationAnchor.cs`       | Task scheduling with nonce-based anti-replay       |
| **PauseRegistry**       | `PauseRegistry/PauseRegistry.cs`             | Global pause control for platform contracts        |
| **PaymentHub**          | `PaymentHub/PaymentHub.cs`                   | GAS-only payments with configurable revenue splits |
| **PriceFeed**           | `PriceFeed/PriceFeed.cs`                     | Oracle price data with TEE attestation             |
| **RandomnessLog**       | `RandomnessLog/RandomnessLog.cs`             | Verifiable randomness with TEE attestation         |
| **ServiceLayerGateway** | `ServiceLayerGateway/ServiceLayerGateway.cs` | On-chain service request routing + callbacks       |

## Build

### Prerequisites

Install the Neo C# compiler:

```bash
dotnet tool install -g Neo.Compiler.CSharp
```

### Build All Platform Contracts

```bash
cd contracts
./build.sh
```

### Build Outputs

- `contracts/build/*.nef` - Contract bytecode
- `contracts/build/*.manifest.json` - Contract manifest

## Deploy & Initialize

### Local Development (Neo Express)

```bash
make -C deploy setup
make -C deploy run-neoexpress
make -C deploy deploy
make -C deploy init
```

### Testnet Deployment (Simulation + CLI)

```bash
# Requires: export NEO_TESTNET_WIF=...
go run ./cmd/deploy-testnet/main.go --check
go run ./cmd/deploy-testnet/main.go --estimate
```

The deployer writes simulated results to `deploy/config/testnet_contracts.json`.
For actual deployment, use `neo-go contract deploy` with the compiled `.nef` and
`.manifest.json` files, then call:

- `PriceFeed.SetUpdater(teeSigner)`
- `RandomnessLog.SetUpdater(teeSigner)`
- `AutomationAnchor.SetUpdater(teeSigner)`

### Updating Existing Contracts (Preferred Over Redeploy)

If a contract address is already in use (and referenced by clients), **do not
redeploy**. Use the on-chain `Update(nef, manifest)` method instead:

```bash
# Example (testnet): update an existing contract address
neo-go contract update -i contracts/build/PaymentHub.nef \
  -m contracts/build/PaymentHub.manifest.json \
  -r https://testnet1.neo.coz.io:443 \
  -w wallet.json \
  --hash <existing_contract_address>
```

For Neo Express local dev, `deploy/scripts/deploy_all.sh` automatically updates
contracts if they already exist in `deploy/config/deployed_contracts.json`.

## Deployed Contract Addresses (Neo N3 Testnet)

The canonical addresses are tracked in `deploy/config/testnet_contracts.json`.

| Contract            | Address                              | Status    |
| ------------------- | ------------------------------------ | --------- |
| PaymentHub          | `NLyxAiXdbc7pvckLw8aHpEiYb7P7NYHpQq` | ✅ Active |
| PriceFeed           | `Ndx6Lia3FsF7K1t73F138HXHaKwLYca2yM` | ✅ Active |
| RandomnessLog       | `NWkXBKnpvQTVy3exMD2dWNDzdtc399eLaD` | ✅ Active |
| AppRegistry         | `NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy` | ✅ Active |
| AutomationAnchor    | `NNWqgxGnXGtfK7VHvEqbdSu3jq8Pu8xkvM` | ✅ Active |
| ServiceLayerGateway | `NPXyVuEVfp47Abcwq6oTKmtwbJM6Yh965c` | ✅ Active |
