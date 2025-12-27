# Neo N3 Smart Contracts

This directory contains the **Neo N3 MiniApp Platform** contracts. The platform
contracts enforce the blueprint constraints:

- **Payments/settlement:** GAS only
- **Governance:** NEO only

All sensitive invocations are expected to flow through the SDK intent + Edge
gateway + TEE services, with final enforcement at the contract layer.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                       Gateway + SDK                            │
│         (Supabase Edge + Host SDK intent flow)                  │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    TEE Service Layer (EGo)                     │
│   datafeed / compute / automation / tx-proxy (attested TLS)     │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Platform Contracts (C#)                     │
│   PaymentHub · Governance · PriceFeed · RandomnessLog          │
│   AppRegistry · AutomationAnchor · ServiceLayerGateway         │
└────────────────────────────────────────────────────────────────┘
```

## Platform Contracts

| Contract                | Source                                       | Description                                        |
| ----------------------- | -------------------------------------------- | -------------------------------------------------- |
| **PaymentHub**          | `PaymentHub/PaymentHub.cs`                   | GAS-only payments with configurable revenue splits |
| **Governance**          | `Governance/Governance.cs`                   | NEO staking and proposal voting                    |
| **PriceFeed**           | `PriceFeed/PriceFeed.cs`                     | Oracle price data with TEE attestation             |
| **RandomnessLog**       | `RandomnessLog/RandomnessLog.cs`             | Verifiable randomness with TEE attestation         |
| **AppRegistry**         | `AppRegistry/AppRegistry.cs`                 | MiniApp manifest and status registry               |
| **AutomationAnchor**    | `AutomationAnchor/AutomationAnchor.cs`       | Task scheduling with nonce-based anti-replay       |
| **ServiceLayerGateway** | `ServiceLayerGateway/ServiceLayerGateway.cs` | On-chain service request routing + callbacks       |

## MiniApp Contracts (23 Deployed)

Each MiniApp has its own smart contract that handles app-specific logic and communicates with platform service contracts for service requests.

### Contract Pattern

All MiniApp contracts follow a common pattern:

```csharp
// Admin and Gateway management
private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

public static void SetAdmin(UInt160 a) { ... }
public static void SetGateway(UInt160 g) { ... }

// Service callback handler
public static void OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e) { }

// Contract upgrade
public static void Update(ByteString nef, string m) { ... }
```

### MiniApp Payment Workflow

**Important**: Users never directly invoke MiniApp contracts. The correct workflow is:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER ACTION: Pay via SDK                                    │
│     User calls SDK.payGAS(appId, amount, memo)                  │
│     → GAS transferred to PaymentHub                             │
├─────────────────────────────────────────────────────────────────┤
│  2. PLATFORM ACTION: Process game logic                         │
│     Platform invokes MiniApp contract methods:                  │
│     - MiniAppLottery.recordTickets(round, user, count)          │
│     - MiniAppCoinFlip.recordBet(user, choice, amount)           │
│     - MiniAppDiceGame.recordBet(user, target, amount)           │
├─────────────────────────────────────────────────────────────────┤
│  3. PLATFORM ACTION: Determine outcome                          │
│     Platform uses VRF for randomness, oracle for prices         │
├─────────────────────────────────────────────────────────────────┤
│  4. PLATFORM ACTION: Send payouts                               │
│     Platform sends GAS to winners via PayoutToUser              │
└─────────────────────────────────────────────────────────────────┘
```

### MiniApp Contract Responsibilities

MiniApp contracts store **app-specific state only**:

| Contract Type                      | State Stored                         |
| ---------------------------------- | ------------------------------------ |
| Gaming (Lottery, CoinFlip, Dice)   | Bets, tickets, rounds, winners       |
| DeFi (PredictionMarket, FlashLoan) | Positions, predictions, loan records |
| Social (RedEnvelope, GasCircle)    | Envelopes, circles, participants     |
| Governance (SecretVote)            | Proposals, encrypted votes           |

Payment logic is handled by **PaymentHub**, not MiniApp contracts.

### Batch Deployment

Deploy all MiniApp contracts to testnet:

```bash
# Requires: export NEO_TESTNET_WIF=...
go run scripts/deploy_miniapp_contracts.go
```

### MiniApp Contract: MiniAppServiceConsumer

This repo includes a **sample** on-chain MiniApp contract that demonstrates the
ServiceLayerGateway request/callback workflow:

| Contract                   | Source                                             | Description                                      |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| **MiniAppServiceConsumer** | `MiniAppServiceConsumer/MiniAppServiceConsumer.cs` | Sample callback receiver for ServiceLayerGateway |

**Features:**

- Receives callbacks from ServiceLayerGateway after TEE service execution
- Stores callback records (requestId, appId, serviceType, success, result, error)
- Emits `ServiceCallback` event for off-chain indexing
- Admin-controlled gateway address configuration

**Key Methods:**

```
SetGateway(gateway)      - Set the ServiceLayerGateway contract address
OnServiceCallback(...)   - Callback entry point (called by gateway)
GetLastCallback()        - Query the most recent callback record
```

**Deployment (Optional):**

```bash
# Build the contract
./build.sh

# Deploy to testnet (requires NEO_TESTNET_WIF)
go run scripts/deploy_miniapp_consumer.go
```

It is **not** deployed by default; deploy it as needed for testnet workflows.

## Common Contract Features

All platform contracts include:

| Feature          | Method                      | Description                   |
| ---------------- | --------------------------- | ----------------------------- |
| Admin Transfer   | `SetAdmin(newAdmin)`        | Transfer admin to new address |
| Contract Upgrade | `Update(nefFile, manifest)` | Upgrade contract code         |
| Admin Validation | `ValidateAdmin()`           | Internal admin check          |

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

If a contract hash is already in use (and referenced by clients), **do not
redeploy**. Use the on-chain `Update(nef, manifest)` method instead:

```bash
# Example (testnet): update an existing contract hash
neo-go contract update -i contracts/build/PaymentHub.nef \
  -m contracts/build/PaymentHub.manifest.json \
  -r https://testnet1.neo.coz.io:443 \
  -w wallet.json \
  --hash <existing_contract_hash>
```

For Neo Express local dev, `deploy/scripts/deploy_all.sh` automatically updates
contracts if they already exist in `deploy/config/deployed_contracts.json`.

## Deployed Contract Hashes (Neo N3 Testnet)

| Contract            | Hash                                         | Status    |
| ------------------- | -------------------------------------------- | --------- |
| PaymentHub          | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` | ✅ Active |
| Governance          | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` | ✅ Active |
| PriceFeed           | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` | ✅ Active |
| RandomnessLog       | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` | ✅ Active |
| AppRegistry         | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` | ✅ Active |
| AutomationAnchor    | `0x1c888d699ce76b0824028af310d90c3c18adeab5` | ✅ Active |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` | ✅ Active |

### MiniApp Contracts (Testnet)

**Phase 1 - Gaming:**

| Contract           | Hash                                         | Status    |
| ------------------ | -------------------------------------------- | --------- |
| MiniAppLottery     | `0x3e330b4c396b40aa08d49912c0179319831b3a6e` | ✅ Active |
| MiniAppCoinFlip    | `0xbd4c9203495048900e34cd9c4618c05994e86cc0` | ✅ Active |
| MiniAppDiceGame    | `0xfacff9abd201dca86e6a63acfb5d60da278da8ea` | ✅ Active |
| MiniAppScratchCard | `0x2674ef3b4d8c006201d1e7e473316592f6cde5f2` | ✅ Active |

**Phase 2 - DeFi & Social:**

| Contract                | Hash                                         | Status    |
| ----------------------- | -------------------------------------------- | --------- |
| MiniAppPredictionMarket | `0x64118096bd004a2bcb010f4371aba45121eca790` | ✅ Active |
| MiniAppFlashLoan        | `0xee51e5b399f7727267b7d296ff34ec6bb9283131` | ✅ Active |
| MiniAppPriceTicker      | `0x838bd5dd3d257a844fadddb5af2b9dac45e1d320` | ✅ Active |
| MiniAppGasSpin          | `0x19bcb0a50ddf5bf7cefbb47044cdb3ce4cb9e4cd` | ✅ Active |
| MiniAppPricePredict     | `0x6317f97029b39f9211193085fe20dcf6500ec59d` | ✅ Active |
| MiniAppSecretVote       | `0x7763ce957515f6acef6d093376977ac6c1cbc47d` | ✅ Active |
| MiniAppSecretPoker      | `0xa27348cc0a79c776699a028244250b4f3d6bbe0c` | ✅ Active |
| MiniAppMicroPredict     | `0x73264e59d8215e28485420bb33ba841ff6fb45f8` | ✅ Active |
| MiniAppRedEnvelope      | `0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e` | ✅ Active |
| MiniAppGasCircle        | `0x7736c8d1ff918f94d26adc688dac4d4bc084bd39` | ✅ Active |

**Phase 3 - Advanced:**

| Contract              | Hash                                         | Status    |
| --------------------- | -------------------------------------------- | --------- |
| MiniAppFogChess       | `0x23a44ca6643c104fbaa97daab65d5e53b3662b4a` | ✅ Active |
| MiniAppGovBooster     | `0xebabd9712f985afc0e5a4e24ed2fc4acb874796f` | ✅ Active |
| MiniAppTurboOptions   | `0xbbe5a4d4272618b23b983c40e22d4b072e20f4bc` | ✅ Active |
| MiniAppILGuard        | `0xd3557ccbb2ced2254f5862fbc784cd97cf746872` | ✅ Active |
| MiniAppGuardianPolicy | `0x893a774957244b83a0efed1d42771fe1e424cfec` | ✅ Active |

**Phase 4 - Long-Running:**

| Contract              | Hash                                         | Status    |
| --------------------- | -------------------------------------------- | --------- |
| MiniAppAITrader       | `0xc3356f394897e36b3903ea81d87717da8db98809` | ✅ Active |
| MiniAppGridBot        | `0x0d9cfc40ac2ab58de449950725af9637e0884b28` | ✅ Active |
| MiniAppNFTEvolve      | `0xadd18a719d14d59c064244833cd2c812c79d6015` | ✅ Active |
| MiniAppBridgeGuardian | `0x2d03f3e4ff10e14ea94081e0c21e79e79c33f9e3` | ✅ Active |

**Sample Contract:**

| Contract               | Hash                                         | Status    |
| ---------------------- | -------------------------------------------- | --------- |
| MiniAppServiceConsumer | `0x8894b8d122cbc49c19439f680a4b5dbb2093b426` | ✅ Active |

## Security Considerations

1. **Admin Keys**: Store admin private keys securely, preferably in TEE.
2. **Signer Setup**: Always set TEE/Automation signers before going live.
3. **Upgradability**: Use `Update()` carefully; it requires admin witness.
4. **Randomness**: Never derive randomness from chain data; always use TEE output.
5. **Price Feeds**: Validate source freshness and enforce monotonic round IDs.
