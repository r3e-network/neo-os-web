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

## MiniApp Contracts (60 Deployed)

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

## Deployed Contract Addresses (Neo N3 Testnet)

| Contract            | Address                              | Status    |
| ------------------- | ------------------------------------ | --------- |
| PaymentHub          | `NLyxAiXdbc7pvckLw8aHpEiYb7P7NYHpQq` | ✅ Active |
| Governance          | `NeEWK3vcVRWJDebyBCyLx6HSzJZSeYhXAt` | ✅ Active |
| PriceFeed           | `Ndx6Lia3FsF7K1t73F138HXHaKwLYca2yM` | ✅ Active |
| RandomnessLog       | `NWkXBKnpvQTVy3exMD2dWNDzdtc399eLaD` | ✅ Active |
| AppRegistry         | `NX25pqQJSjpeyKBvcdReRtzuXMeEyJkyiy` | ✅ Active |
| AutomationAnchor    | `NNWqgxGnXGtfK7VHvEqbdSu3jq8Pu8xkvM` | ✅ Active |
| ServiceLayerGateway | `NPXyVuEVfp47Abcwq6oTKmtwbJM6Yh965c` | ✅ Active |

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
| MiniAppSecretVote       | `0x7763ce957515f6acef6d093376977ac6c1cbc47d` | ✅ Active |
| MiniAppSecretPoker      | `0xa27348cc0a79c776699a028244250b4f3d6bbe0c` | ✅ Active |
| MiniAppRedEnvelope      | `0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e` | ✅ Active |
| MiniAppGasCircle        | `0x7736c8d1ff918f94d26adc688dac4d4bc084bd39` | ✅ Active |
| MiniAppCanvas           | `0x53f9c7b86fa2f8336839ef5073d964d644cbb46c` | ✅ Active |

**Phase 3 - Advanced:**

| Contract              | Hash                                         | Status    |
| --------------------- | -------------------------------------------- | --------- |
| MiniAppFogChess       | `0x23a44ca6643c104fbaa97daab65d5e53b3662b4a` | ✅ Active |
| MiniAppGovBooster     | `0xebabd9712f985afc0e5a4e24ed2fc4acb874796f` | ✅ Active |
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
| MiniAppNoLossLottery | `0x18cecd52efb529ac4e2827e9c9956c1bc450f154` | ✅ Active |
| MiniAppDoomsdayClock | `0xe4f386057d6308b83a5fd2e84bc3eb9149adc719` | ✅ Active |
| MiniAppPayToView     | `0xfa920907126e63b5360a68fbf607294a82ef6266` | ✅ Active |

**Phase 6 - TEE-Powered Creative Apps:**

| Contract              | Hash                                         | Status    |
| --------------------- | -------------------------------------------- | --------- |
| MiniAppSchrodingerNFT | `0x43165f491aa0584d402f4b360d667f3e0e3293e7` | ✅ Active |
| MiniAppAlgoBattle     | `0xdeb2117b8db028e68e6acf2e9c67c26517d00a3e` | ✅ Active |
| MiniAppTimeCapsule    | `0x119763e1402d7190728191d83c95c5b8e995abcd` | ✅ Active |
| MiniAppGardenOfNeo    | `0xdb52b284d97973b01fed431dd6d143a4d04d9fa7` | ✅ Active |
| MiniAppDevTipping     | `0x38ec54ce12e9cbf041cc7e31534eccae0eaa38dc` | ✅ Active |

**Phase 7 - Advanced DeFi & Social:**

| Contract               | Hash                                         | Status    |
| ---------------------- | -------------------------------------------- | --------- |
| MiniAppAISoulmate      | `0x5df263b8d65fa5cc755b46acf8a7866f5dc05b92` | ✅ Active |
| MiniAppDeadSwitch      | `0x87dbc02162b5681dd4788061c1f411c7abce0e66` | ✅ Active |
| MiniAppHeritageTrust   | `0xd59eea851cd8e5dd57efe80646ff53fa274600f8` | ✅ Active |
| MiniAppDarkRadio       | `0x2652053354c3d2c574a0bc74e21a92a5dd94a42d` | ✅ Active |
| MiniAppZKBadge         | `0x70915211c56fe3323b22043d3073765a7b633d3f` | ✅ Active |
| MiniAppGraveyard       | `0xe88938b2c2032483cf5edcdab7e4bde981e5fb24` | ✅ Active |
| MiniAppCompoundCapsule | `0xba302bebace6c2bd0f610228b56bd3d3de07dbd7` | ✅ Active |
| MiniAppSelfLoan        | `0x5ed7d8c85f24f4aa16b328aca776e09be5241296` | ✅ Active |
| MiniAppDarkPool        | `0xf25a43e726c58ae5ec9468ff42caeaeeadd78128` | ✅ Active |
| MiniAppBurnLeague      | `0xf1aa73e2fb00664e8ef100dac083fc42be6aaf85` | ✅ Active |
| MiniAppGovMerc         | `0x05d4ed2e60141043d6d20f5cde274704bd42c0dc` | ✅ Active |

**Phase 8 - Creative & Social:**

| Contract                | Hash                                         | Status    |
| ----------------------- | -------------------------------------------- | --------- |
| MiniAppQuantumSwap      | `0x99fd1213d1d73181b84270ec3458bb46b9c4aab3` | ✅ Active |
| MiniAppOnChainTarot     | `0xc2bb26d21f357f125a0e49cbca7718b6aa5c3b1e` | ✅ Active |
| MiniAppExFiles          | `0xb45cd9f5869f75f3a7ac9e71587909262cbb96a5` | ✅ Active |
| MiniAppScreamToEarn     | `0xe94d5f6815b0574c7c685f1a460f3d05273b5e63` | ✅ Active |
| MiniAppBreakupContract  | `0x84a3864028b7b71e9f420056e1eae2e3e3113a0c` | ✅ Active |
| MiniAppGeoSpotlight     | `0x925959dc2360bd2fed7dd52ac3d29b76ff24c5dd` | ✅ Active |
| MiniAppPuzzleMining     | `0x25409ffab1eb192b2313f86142aaa90f9fcfcbea` | ✅ Active |
| MiniAppNFTChimera       | `0x200996e599a2e3dba781438826a4f3622560dddd` | ✅ Active |
| MiniAppWorldPiano       | `0x946d0afa22c7661734288002fd7cb0dc6e765663` | ✅ Active |
| MiniAppBountyHunter     | `0x7b3929e7d7881c5929d29953d194c833178a0887` | ✅ Active |
| MiniAppMasqueradeDAO    | `0x36873ae952147150e065ad2ba8d23731ffd00d5a` | ✅ Active |
| MiniAppMeltingAsset     | `0x964994b4ce9d77c7af303c6c762192d4184313ee` | ✅ Active |
| MiniAppUnbreakableVault | `0xb60bf51f7fc9b7e0beeabfde0765d8ec9b895dd4` | ✅ Active |
| MiniAppWhisperChain     | `0xbd51b0aee399ed00645c4a698c18806d2797fe64` | ✅ Active |
| MiniAppMillionPieceMap  | `0xdf787aaf8a70dd2612521de69f12c7bf5a8d0d6d` | ✅ Active |
| MiniAppFogPuzzle        | `0xde0615f83fb3f0f80ef7b4e40b06e64b0d5ffa2a` | ✅ Active |
| MiniAppCryptoRiddle     | `0x35718d58fff23aed609df196d7954cbeb8ac3d7c` | ✅ Active |

## MiniApp Automation Support

All 60 MiniApp contracts support periodic automation via AutomationAnchor integration. This enables scheduled task execution for time-sensitive operations.

### Automation Feature Matrix

| MiniApp                 | Category | Automation Logic                | Trigger Type |
| ----------------------- | -------- | ------------------------------- | ------------ |
| MiniAppCoinFlip         | Gaming   | Auto-settle expired bets        | interval     |
| MiniAppDiceGame         | Gaming   | Auto-settle expired games       | interval     |
| MiniAppScratchCard      | Gaming   | Auto-manage prize pool          | interval     |
| MiniAppLottery          | Gaming   | Auto-trigger lottery draws      | cron         |
| MiniAppFlashLoan        | DeFi     | Auto-liquidate defaulted loans  | interval     |
| MiniAppPredictionMarket | DeFi     | Auto-resolve expired markets    | interval     |
| MiniAppPriceTicker      | DeFi     | Auto-update price feeds         | interval     |
| MiniAppILGuard          | DeFi     | Auto-check IL protection        | interval     |
| MiniAppRedEnvelope      | Social   | Auto-refund expired envelopes   | interval     |
| MiniAppSecretVote       | Social   | Auto-tally votes after deadline | cron         |
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
