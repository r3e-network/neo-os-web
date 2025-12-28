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
│                       User / Frontend                          │
│            (Invoke MiniApp contract methods)                   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    MiniApp Contracts (C#)                      │
│   CoinFlip · DiceGame · Lottery · PredictionMarket · etc.      │
│   (Store state, request services, handle callbacks)            │
└────────────────────────────────────────────────────────────────┘
                             │ requestService()
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                  ServiceLayerGateway Contract                  │
│   (Route requests to TEE, deliver callbacks to MiniApps)       │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    TEE Service Layer (EGo)                     │
│   rng / pricefeed / bridge-oracle / compute (attested TLS)     │
└────────────────────────────────────────────────────────────────┘
                             │ onServiceCallback()
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Platform Contracts (C#)                     │
│   PaymentHub · Governance · PriceFeed · RandomnessLog          │
│   AppRegistry · AutomationAnchor                               │
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

## MiniApp Contracts (27 Deployed)

Each MiniApp has its own smart contract that handles app-specific logic using the **Chainlink-style oracle pattern**. Contracts actively request services from ServiceLayerGateway and receive callbacks with results. All MiniApp contracts use the shared `MiniAppContract` partial class pattern for common functionality.

### Contract Pattern

All MiniApp contracts use the `MiniAppContract` partial class pattern with service request capability:

```csharp
// Base configuration (from MiniAppBase)
private static readonly byte[] PREFIX_ADMIN = new byte[] { 0x01 };
private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };

// App-specific storage prefixes (start from 0x10)
private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x10 };
private static readonly byte[] PREFIX_BETS = new byte[] { 0x11 };
private static readonly byte[] PREFIX_REQUEST_TO_BET = new byte[] { 0x12 };

// Request service from Gateway
private static BigInteger RequestRng(BigInteger betId)
{
    return Contract.Call(Gateway(), "requestService", CallFlags.All,
        APP_ID, "rng", payload, Runtime.ExecutingScriptHash, "onServiceCallback");
}

// Receive callback from Gateway
public static void OnServiceCallback(BigInteger requestId, string appId,
    string serviceType, bool success, ByteString result, string error)
{
    ValidateGateway();
    // Resolve business logic using result
}
```

### MiniApp Service Request Workflow (Chainlink-style)

MiniApp contracts follow a **Chainlink-style oracle pattern** where contracts actively request services and receive callbacks:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER ACTION: Invoke MiniApp Contract                        │
│     User calls MiniApp method (e.g., PlaceBet, CreateGrid)      │
│     → Contract stores bet/position data                         │
│     → Contract calls Gateway.requestService(appId, serviceType) │
├─────────────────────────────────────────────────────────────────┤
│  2. GATEWAY ACTION: Route to TEE Service                        │
│     ServiceLayerGateway routes request to off-chain service     │
│     → TEE executes service (RNG, PriceFeed, etc.)               │
│     → Returns result via callback                               │
├─────────────────────────────────────────────────────────────────┤
│  3. GATEWAY ACTION: Fulfill Callback                            │
│     Gateway calls MiniApp.OnServiceCallback(requestId, result)  │
│     → Contract resolves bet/position using service result       │
│     → Emits result event                                        │
├─────────────────────────────────────────────────────────────────┤
│  4. SETTLEMENT: Process payouts                                 │
│     Platform processes payout based on emitted events           │
│     → Winners receive GAS via PaymentHub                        │
└─────────────────────────────────────────────────────────────────┘
```

**Service Types:**

- `rng` - Random number generation (gaming, NFT evolution)
- `pricefeed` - Price oracle data (prediction markets, trading)
- `bridge-oracle` - Cross-chain verification (bridges)

### MiniApp Contract Responsibilities

MiniApp contracts handle **complete business logic with async service requests**:

| Contract Category         | Service Used    | Business Logic                                |
| ------------------------- | --------------- | --------------------------------------------- |
| Gaming (CoinFlip, Dice)   | `rng`           | PlaceBet → RequestRng → OnCallback → Settle   |
| Lottery (Mega, Scratch)   | `rng`           | BuyTicket → InitiateDraw → OnCallback         |
| Trading (AI, Grid)        | `pricefeed`     | CreateStrategy → RequestPrice → OnCallback    |
| Prediction (Turbo, Micro) | `pricefeed`     | PlacePrediction → RequestResolve → OnCallback |
| NFT (Evolve)              | `rng`           | InitiateEvolution → RequestRng → OnCallback   |
| Bridge (Guardian)         | `bridge-oracle` | InitiateBridge → RequestVerify → OnCallback   |
| Price (Ticker)            | `pricefeed`     | RequestUpdate → OnCallback → StorePrice       |

**Key Pattern:**

```csharp
// Step 1: User initiates action, contract stores state
public static BigInteger PlaceBet(UInt160 player, BigInteger amount, bool choice)
{
    BetData bet = new BetData { Player = player, Amount = amount, Choice = choice };
    StoreBet(betId, bet);

    // Request service via Gateway
    BigInteger requestId = Contract.Call(gateway, "requestService", ...);
    Storage.Put(PREFIX_REQUEST_TO_BET + requestId, betId);
    return betId;
}

// Step 2: Gateway calls back with result
public static void OnServiceCallback(BigInteger requestId, bool success, ByteString result)
{
    ValidateGateway();
    BigInteger betId = Storage.Get(PREFIX_REQUEST_TO_BET + requestId);
    BetData bet = GetBet(betId);

    // Process result and emit settlement event
    BigInteger randomValue = StdLib.Deserialize(result);
    bool won = (randomValue % 2 == 0) == bet.Choice;
    OnBetResult(bet.Player, won, payout, betId);
}
```

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
| MiniAppCanvas           | `TBD`                                        | 🆕 New    |

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

## MiniApp Automation Support

All 25 MiniApp contracts support periodic automation via AutomationAnchor integration. This enables scheduled task execution for time-sensitive operations.

### Automation Feature Matrix

| MiniApp                 | Category | Automation Logic                | Trigger Type |
| ----------------------- | -------- | ------------------------------- | ------------ |
| MiniAppCoinFlip         | Gaming   | Auto-settle expired bets        | interval     |
| MiniAppDiceGame         | Gaming   | Auto-settle expired games       | interval     |
| MiniAppGasSpin          | Gaming   | Auto-process spin results       | interval     |
| MiniAppScratchCard      | Gaming   | Auto-manage prize pool          | interval     |
| MiniAppMegaMillions     | Gaming   | Auto-draw when conditions met   | cron         |
| MiniAppLottery          | Gaming   | Auto-trigger lottery draws      | cron         |
| MiniAppFlashLoan        | DeFi     | Auto-liquidate defaulted loans  | interval     |
| MiniAppPredictionMarket | DeFi     | Auto-resolve expired markets    | interval     |
| MiniAppPricePredict     | DeFi     | Auto-settle predictions         | interval     |
| MiniAppPriceTicker      | DeFi     | Auto-update price feeds         | interval     |
| MiniAppTurboOptions     | DeFi     | Auto-settle expired options     | interval     |
| MiniAppILGuard          | DeFi     | Auto-check IL protection        | interval     |
| MiniAppRedEnvelope      | Social   | Auto-refund expired envelopes   | interval     |
| MiniAppSecretVote       | Social   | Auto-tally votes after deadline | cron         |
| MiniAppMicroPredict     | Social   | Auto-settle micro predictions   | interval     |
| MiniAppSecretPoker      | Social   | Auto-timeout inactive games     | interval     |
| MiniAppAITrader         | Advanced | Auto-execute trading signals    | interval     |
| MiniAppGridBot          | Advanced | Auto-execute grid orders        | interval     |
| MiniAppBridgeGuardian   | Advanced | Auto-verify cross-chain txs     | interval     |
| MiniAppGuardianPolicy   | Advanced | Auto-execute policy rules       | interval     |
| MiniAppFogChess         | Other    | Auto-timeout inactive games     | interval     |
| MiniAppNFTEvolve        | Other    | Auto-trigger evolution          | interval     |
| MiniAppGovBooster       | Other    | Auto-unlock expired stakes      | interval     |
| MiniAppGasCircle        | Other    | Auto-process circle payments    | cron         |
| MiniAppCanvas           | Other    | Auto-create daily NFT           | cron         |

### Standard Automation Interface

All MiniApp contracts implement these automation methods:

```csharp
// Query automation anchor address
public static UInt160 AutomationAnchor()

// Set automation anchor (admin only)
public static void SetAutomationAnchor(UInt160 anchor)

// Register periodic task with AutomationAnchor
public static void RegisterAutomation(string triggerType, string schedule)

// Cancel periodic task
public static void CancelAutomation()

// Callback from AutomationAnchor (anchor only)
public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
```

### Automation Events

- `AutomationRegistered(taskId, triggerType, schedule)` - Task registered
- `AutomationCancelled(taskId)` - Task cancelled
- `PeriodicExecutionTriggered(taskId)` - Periodic execution triggered

### Storage Prefixes

Automation uses dedicated storage prefixes to avoid conflicts:

- `PREFIX_AUTOMATION_TASK (0x20)` - Stores registered task ID
- `PREFIX_AUTOMATION_ANCHOR (0x21)` - Stores anchor contract address

## Security Considerations

1. **Admin Keys**: Store admin private keys securely, preferably in TEE.
2. **Signer Setup**: Always set TEE/Automation signers before going live.
3. **Upgradability**: Use `Update()` carefully; it requires admin witness.
4. **Randomness**: Never derive randomness from chain data; always use TEE output.
5. **Price Feeds**: Validate source freshness and enforce monotonic round IDs.
