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

## MiniApp Contracts (67 Deployed)

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
| MiniAppCanvas           | `0x285e2dc88e15fee4684588f34985155ac95d8d98` | ✅ Active |

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

**Phase 5 - New Gaming/DeFi/Social:**

| Contract             | Hash                                         | Status    |
| -------------------- | -------------------------------------------- | --------- |
| MiniAppNeoCrash      | `0x2e594e12b2896c135c3c8c80dbf2317fa56ceead` | ✅ Active |
| MiniAppCandleWars    | `0x9dddba9357b93e75c29aaeaf37e7851aaaed6dbe` | ✅ Active |
| MiniAppDutchAuction  | `0xb4394ee9eee040a9cce5450fceaaeabe83946410` | ✅ Active |
| MiniAppParasite      | `0xe1726fbc4b6a5862eb2336ff32494be9f117563b` | ✅ Active |
| MiniAppThroneOfGas   | `0xa89c3f6d82ad2803e1e576a2b441660c93316678` | ✅ Active |
| MiniAppNoLossLottery | `0x18cecd52efb529ac4e2827e9c9956c1bc450f154` | ✅ Active |
| MiniAppDoomsdayClock | `0xe4f386057d6308b83a5fd2e84bc3eb9149adc719` | ✅ Active |
| MiniAppPayToView     | `0xfa920907126e63b5360a68fbf607294a82ef6266` | ✅ Active |

**Phase 6 - TEE-Powered Creative Apps:**

| Contract              | Hash                                         | Status    |
| --------------------- | -------------------------------------------- | --------- |
| MiniAppSchrodingerNFT | `0x06fcf2d556322637e1b97ec1e0137c77c6a7b27e` | ✅ Active |
| MiniAppAlgoBattle     | `0xb75677584c3f3b168129767534c1478d42144913` | ✅ Active |
| MiniAppTimeCapsule    | `0x0108b2d8d020f921d9bdc82ffda5e55f9b749823` | ✅ Active |
| MiniAppGardenOfNeo    | `0x192e2a0a1e050440b97d449b7905f37516042faa` | ✅ Active |
| MiniAppDevTipping     | `0x93d2406a73e060d43cbe28fb26d863e5ac4744a2` | ✅ Active |

**Phase 7 - Advanced DeFi & Social:**

| Contract               | Hash                                         | Status    |
| ---------------------- | -------------------------------------------- | --------- |
| MiniAppAISoulmate      | `0x941d3f3662b5e4a744a06356ca4e91362d5c4556` | ✅ Active |
| MiniAppDeadSwitch      | `0xb77119b93b305e75e5becb8c23a2962c4940e6e5` | ✅ Active |
| MiniAppHeritageTrust   | `0x6d910186e2eee3fc38fd027e5e77d50d6f8c429b` | ✅ Active |
| MiniAppDarkRadio       | `0xf4e6fc1a86281df7527eec74b809403822e973d8` | ✅ Active |
| MiniAppZKBadge         | `0x34a71f8c85830789d82a6a6e966aef74a4f9292c` | ✅ Active |
| MiniAppGraveyard       | `0x8cf45cdc1d879710c2b88fd8705696fe6f5aacb5` | ✅ Active |
| MiniAppCompoundCapsule | `0x20397862ba24b84103a745ec2ed1f581126674dc` | ✅ Active |
| MiniAppSelfLoan        | `0xb7522afccd80ad5b3cbc112033c22b3d8f2d120c` | ✅ Active |
| MiniAppDarkPool        | `0x7c49a0c0184e2da82130de1e2c5fef283bd0a1a0` | ✅ Active |
| MiniAppBurnLeague      | `0x8db1b8c67b52e02592d2ee7ceb47dea908ab0e46` | ✅ Active |
| MiniAppGovMerc         | `0x69a013c8fde3e835d642717ef1af71f7e02ade00` | ✅ Active |

**Phase 8 - Creative & Social:**

| Contract                | Hash                                         | Status    |
| ----------------------- | -------------------------------------------- | --------- |
| MiniAppQuantumSwap      | `0x21f0b8f1fd5c65e239bda0bc8a04a367b821b79c` | ✅ Active |
| MiniAppOnChainTarot     | `0xfff9616dd3d9e863bc72bf26ff0a0da2d698e767` | ✅ Active |
| MiniAppExFiles          | `0x6057934459f1ddc6c63a63bc816afed971514b43` | ✅ Active |
| MiniAppScreamToEarn     | `0xd726b3d241bef1ee299fa469f7cfbd03b7123e0f` | ✅ Active |
| MiniAppBreakupContract  | `0x20ebda5a9ed93e3ae29489e2ad329a29cdd5ba6f` | ✅ Active |
| MiniAppGeoSpotlight     | `0x2f74728dd5f3d143d2a2d2dbb99aa2f8feeb8353` | ✅ Active |
| MiniAppPuzzleMining     | `0xefda59e287f0bf46d6c3ec5db565a339cb2c0e89` | ✅ Active |
| MiniAppNFTChimera       | `0x3d75708a45c2e3850608b65d4588dc683672004a` | ✅ Active |
| MiniAppWorldPiano       | `0x0920ef4ca5eca4836e2514af0c080d3741ba7c73` | ✅ Active |
| MiniAppBountyHunter     | `0xa2a83c007d091ee65cda36c1b4c120c3c09304f9` | ✅ Active |
| MiniAppMasqueradeDAO    | `0x07ff6bac7e2824d1cec0e71a1383d131cdf86c65` | ✅ Active |
| MiniAppMeltingAsset     | `0x31662a42f65e394c2e038030e410b75251eb0705` | ✅ Active |
| MiniAppUnbreakableVault | `0xcf4c6eb16baad22292fb3ced6e570c31fadddd4e` | ✅ Active |
| MiniAppWhisperChain     | `0x28d346d23fe5cad44e12dafdbda4422764fa544a` | ✅ Active |
| MiniAppMillionPieceMap  | `0xf4ab0fa6f245427482cb5c693a5f40baf6d58c71` | ✅ Active |
| MiniAppFogPuzzle        | `0x1eafd1f7fc27607bd51ef4524c650c39ba2a7d55` | ✅ Active |
| MiniAppCryptoRiddle     | `0x088b4974a83cd6afa4c52c041d75637317b54ad3` | ✅ Active |

**Sample Contract:**

| Contract               | Hash                                         | Status    |
| ---------------------- | -------------------------------------------- | --------- |
| MiniAppServiceConsumer | `0x8894b8d122cbc49c19439f680a4b5dbb2093b426` | ✅ Active |

## MiniApp Automation Support

All 67 MiniApp contracts support periodic automation via AutomationAnchor integration. This enables scheduled task execution for time-sensitive operations.

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
| MiniAppNeoCrash         | Gaming   | Auto-settle crash rounds        | interval     |
| MiniAppCandleWars       | Gaming   | Auto-resolve candle battles     | interval     |
| MiniAppNoLossLottery    | Gaming   | Auto-distribute yield prizes    | cron         |
| MiniAppDutchAuction     | DeFi     | Auto-settle expired auctions    | interval     |
| MiniAppDoomsdayClock    | DeFi     | Auto-trigger doomsday events    | cron         |
| MiniAppThroneOfGas      | Gaming   | Auto-crown new kings            | interval     |
| MiniAppParasite         | Gaming   | Auto-spread parasite effects    | interval     |
| MiniAppPayToView        | Social   | Auto-unlock expired content     | interval     |
| MiniAppSchrodingerNFT   | Creative | Auto-collapse quantum states    | interval     |
| MiniAppAlgoBattle       | Gaming   | Auto-run algorithm battles      | cron         |
| MiniAppTimeCapsule      | Social   | Auto-unlock time capsules       | cron         |
| MiniAppGardenOfNeo      | Creative | Auto-grow garden plants         | interval     |
| MiniAppDevTipping       | Social   | Auto-distribute tips            | interval     |
| MiniAppAISoulmate       | Social   | Auto-match soulmates            | cron         |
| MiniAppDeadSwitch       | DeFi     | Auto-trigger dead switches      | interval     |
| MiniAppHeritageTrust    | DeFi     | Auto-execute inheritance        | cron         |
| MiniAppDarkRadio        | Social   | Auto-broadcast messages         | interval     |
| MiniAppZKBadge          | Social   | Auto-verify badge proofs        | interval     |
| MiniAppGraveyard        | Creative | Auto-process NFT burials        | interval     |
| MiniAppCompoundCapsule  | DeFi     | Auto-compound yields            | interval     |
| MiniAppSelfLoan         | DeFi     | Auto-liquidate self-loans       | interval     |
| MiniAppDarkPool         | DeFi     | Auto-match dark pool orders     | interval     |
| MiniAppBurnLeague       | Gaming   | Auto-settle burn competitions   | cron         |
| MiniAppGovMerc          | Social   | Auto-execute governance votes   | cron         |
| MiniAppQuantumSwap      | Gaming   | Auto-reveal quantum boxes       | interval     |
| MiniAppOnChainTarot     | Creative | Auto-draw daily cards           | cron         |
| MiniAppExFiles          | Social   | Auto-expire secret files        | interval     |
| MiniAppScreamToEarn     | Gaming   | Auto-verify scream submissions  | interval     |
| MiniAppBreakupContract  | Social   | Auto-execute breakup terms      | interval     |
| MiniAppGeoSpotlight     | Social   | Auto-rotate geo spotlights      | cron         |
| MiniAppPuzzleMining     | Gaming   | Auto-generate new puzzles       | cron         |
| MiniAppNFTChimera       | Creative | Auto-merge NFT chimeras         | interval     |
| MiniAppWorldPiano       | Creative | Auto-compose daily melodies     | cron         |
| MiniAppBountyHunter     | Social   | Auto-expire bounties            | interval     |
| MiniAppMasqueradeDAO    | Social   | Auto-reveal masked votes        | cron         |
| MiniAppMeltingAsset     | DeFi     | Auto-melt depreciating assets   | interval     |
| MiniAppUnbreakableVault | DeFi     | Auto-check vault conditions     | interval     |
| MiniAppWhisperChain     | Social   | Auto-propagate whispers         | interval     |
| MiniAppMillionPieceMap  | Creative | Auto-auction map pieces         | cron         |
| MiniAppFogPuzzle        | Gaming   | Auto-reveal fog tiles           | interval     |
| MiniAppCryptoRiddle     | Gaming   | Auto-expire unsolved riddles    | interval     |

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
