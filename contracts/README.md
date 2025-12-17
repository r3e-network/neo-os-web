# Neo N3 Smart Contracts

This directory contains the **Neo MiniApp Platform** smart contracts.

The repository used to include an older “on-chain gateway + per-service contracts” stack.
That legacy contract set has been removed to keep the codebase aligned with the current
architecture:

- **Gateway**: Supabase Edge (thin gateway)
- **TEE**: MarbleRun + EGo services (tx signing, compute, oracle, automation, datafeed)
- **Chain**: platform contracts below (public state + audit trail)

## Platform Contracts

| Contract | Display Name | Source | Notes |
|---|---|---|---|
| Payments | `PaymentHub` | `contracts/PaymentHub/PaymentHub.cs` | GAS-only payments + settlement |
| Governance | `Governance` | `contracts/Governance/Governance.cs` | NEO-only staking + voting skeleton |
| Price Feeds | `PriceFeed` | `contracts/PriceFeed/PriceFeed.cs` | Stores price rounds + attestation hash (Updater-only write) |
| Randomness | `RandomnessLog` | `contracts/RandomnessLog/RandomnessLog.cs` | Stores randomness + attestation hash (Updater-only write) |
| App Registry | `AppRegistry` | `contracts/AppRegistry/AppRegistry.cs` | App manifest hash + status |
| Automation | `AutomationAnchor` | `contracts/AutomationAnchor/AutomationAnchor.cs` | Task registry + nonce-based anti-replay (Updater marks executions) |

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

Build outputs (**not tracked**):

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
