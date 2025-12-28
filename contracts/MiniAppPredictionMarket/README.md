# MiniAppPredictionMarket

## Overview

MiniAppPredictionMarket is a decentralized prediction market contract that allows users to bet on price movements of various assets. Users can place predictions on whether an asset's price will go up or down, and receive payouts based on the accuracy of their predictions.

## What It Does

The PredictionMarket contract enables:

- **Price Predictions**: Users bet on asset price direction (up/down)
- **Market Resolution**: Gateway resolves predictions based on oracle data
- **Automated Payouts**: Winners receive 1.9x their bet amount (90% house edge)
- **Multi-Asset Support**: Supports predictions on any symbol (NEO, GAS, BTC, etc.)

This contract creates a simple yet engaging prediction market where users can speculate on short-term price movements.

## How It Works

### Architecture

The contract follows a two-phase prediction model:

- **Placement Phase**: Users place predictions with direction and amount
- **Resolution Phase**: Gateway resolves predictions and triggers payouts
- **Event-Driven**: All actions emit events for tracking and UI updates

### Core Mechanism

1. **Prediction Placement**: User calls `PlacePrediction()` with symbol, direction (true=up, false=down), and bet amount
2. **Event Emission**: Contract emits `PredictionPlaced` event
3. **Oracle Integration**: Off-chain service monitors price movements
4. **Resolution**: Gateway calls `Resolve()` with win/loss status
5. **Payout Calculation**: Winners receive 190% of bet (1.9x multiplier)

## Key Methods

### Public Methods

#### `PlacePrediction(UInt160 player, string symbol, bool direction, BigInteger amount)`

Places a prediction on asset price movement.

**Parameters:**

- `player`: Address of the player placing the prediction
- `symbol`: Asset symbol (e.g., "NEO", "GAS", "BTC")
- `direction`: true = price will go up, false = price will go down
- `amount`: Bet amount in base units

**Access Control:** Requires player's witness (signature)

**Events Emitted:** `PredictionPlaced(player, symbol, direction, amount)`

#### `Resolve(UInt160 player, bool won, BigInteger amount)`

Resolves a prediction and calculates payout.

**Parameters:**

- `player`: Address of the player whose prediction is being resolved
- `won`: true if prediction was correct, false if incorrect
- `amount`: Original bet amount

**Access Control:** Gateway only

**Payout Logic:**

- If won: payout = amount \* 190 / 100 (1.9x multiplier)
- If lost: payout = 0

**Events Emitted:** `PredictionResolved(player, won, payout)`

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Receives asynchronous callbacks from ServiceLayerGateway services.

**Access Control:** Gateway only

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

## Automation Support

This contract supports periodic automation via AutomationAnchor integration.

### Automation Methods

| Method              | Parameters                              | Description                            |
| ------------------- | --------------------------------------- | -------------------------------------- |
| AutomationAnchor    | -                                       | Get automation anchor contract address |
| SetAutomationAnchor | anchor: UInt160                         | Set automation anchor (admin only)     |
| RegisterAutomation  | triggerType: string, schedule: string   | Register periodic task                 |
| CancelAutomation    | -                                       | Cancel periodic task                   |
| OnPeriodicExecution | taskId: BigInteger, payload: ByteString | Callback from AutomationAnchor         |

### Automation Logic

- **Trigger Type**: `interval` or `cron`
- **Schedule**: e.g., `hourly`, `daily`, or cron expression
- **Business Logic**: Auto-resolve expired markets

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Events

### `PredictionPlaced`

```csharp
event PredictionPlaced(UInt160 player, string symbol, bool direction, BigInteger amount)
```

Emitted when a player places a prediction.

**Parameters:**

- `player`: Player address
- `symbol`: Asset symbol
- `direction`: true = up, false = down
- `amount`: Bet amount

### `PredictionResolved`

```csharp
event PredictionResolved(UInt160 player, bool won, BigInteger payout)
```

Emitted when a prediction is resolved.

**Parameters:**

- `player`: Player address
- `won`: Whether the prediction was correct
- `payout`: Payout amount (0 if lost)

## Usage Flow

### Standard Prediction Flow

1. **Prediction Placement**
   - User selects asset symbol (e.g., "NEO")
   - User chooses direction (up or down)
   - User specifies bet amount
   - Frontend calls `PlacePrediction()` with user's signature
   - Contract emits `PredictionPlaced` event

2. **Monitoring Phase**
   - Off-chain oracle monitors price movements
   - Prediction has a time window (e.g., 5 minutes)
   - Oracle compares start price vs end price

3. **Resolution**
   - Oracle determines if prediction was correct
   - Gateway calls `Resolve()` with result
   - Contract calculates payout (1.9x if won, 0 if lost)
   - Contract emits `PredictionResolved` event

4. **Payout**
   - PaymentHub transfers winnings to player
   - Frontend updates UI with result

### Example Integration

```csharp
// User places prediction: NEO will go UP, bet 100 tokens
Contract.Call(
    predictionMarketAddress,
    "placePrediction",
    userAddress,
    "NEO",
    true,  // direction: up
    100_00000000  // 100 tokens
);

// Later, Gateway resolves the prediction
// If user was correct:
Contract.Call(
    predictionMarketAddress,
    "resolve",
    userAddress,
    true,  // won
    100_00000000  // original bet
);
// Payout = 100 * 1.9 = 190 tokens
```

## Security Considerations

1. **Witness Validation**: PlacePrediction requires player's signature
2. **Gateway-Only Resolution**: Only Gateway can resolve predictions
3. **Payout Calculation**: Fixed 1.9x multiplier prevents manipulation
4. **Oracle Dependency**: Relies on trusted oracle for price data

## Integration Points

- **ServiceLayerGateway**: Handles resolution and callbacks
- **PaymentHub**: Processes bet collection and payouts
- **Price Oracles**: Provides asset price data
- **Frontend**: User interface for placing predictions

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure oracle services for price monitoring
6. Set up frontend for prediction placement

## Version

**Version:** 1.0.0
**Author:** R3E Network
**Description:** Prediction Market - Bet on price movements
