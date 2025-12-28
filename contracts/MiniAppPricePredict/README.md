# MiniAppPricePredict

## Overview

MiniAppPricePredict is a price prediction game contract that allows users to bet on whether an asset's price will go up or down within a specified timeframe. It's a binary options-style game where players can win 1.9x their bet amount if their prediction is correct.

## What It Does

The contract provides a prediction-based gaming experience:

- **Binary Price Predictions**: Users predict if price will go UP or DOWN
- **Fixed Payout Ratio**: Winners receive 190% of their bet (1.9x multiplier)
- **Gateway-Resolved**: Predictions are resolved by ServiceLayerGateway based on oracle data
- **Event-Driven**: Emits results for frontend display and user notifications

## How It Works

### Architecture

The contract follows the standard MiniApp architecture with:

1. **Admin Management**: Controls contract configuration and upgrades
2. **Gateway Integration**: Receives resolution data through ServiceLayerGateway
3. **PaymentHub Integration**: Handles bet collection and payout distribution
4. **Pause Mechanism**: Emergency stop functionality

### Payout Calculation

```csharp
BigInteger payout = won ? bet * 190 / 100 : 0;  // 1.9x for winners, 0 for losers
```

For example:

- Bet 100 tokens and WIN → Receive 190 tokens (90 profit)
- Bet 100 tokens and LOSE → Receive 0 tokens (100 loss)
- House edge: ~5.26% (1 - 1.9/2 = 0.0526)

### Game Flow

1. User places bet and selects prediction (UP or DOWN) through frontend
2. Bet amount is collected via PaymentHub
3. Prediction is recorded with timestamp and target asset
4. Oracle monitors price at prediction time and expiry time
5. ServiceLayerGateway calls `Resolve()` with outcome
6. Contract emits `PredictResult` event with payout information
7. Winner receives 1.9x payout through PaymentHub

## Key Methods

### Public Methods

#### `Resolve(UInt160 player, bool won, BigInteger bet)`

Resolves a price prediction and calculates payout.

**Parameters:**

- `player`: Address of the player who made the prediction
- `won`: Whether the prediction was correct
- `bet`: Original bet amount

**Requirements:**

- Can only be called by ServiceLayerGateway

**Emits:** `PredictResult(player, won, payout)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Callback handler for external service responses.

**Requirements:**

- Can only be called by ServiceLayerGateway

### Admin Methods

#### `SetAdmin(UInt160 a)` | `SetGateway(UInt160 g)` | `SetPaymentHub(UInt160 hub)` | `SetPaused(bool paused)` | `Update(ByteString nef, string manifest)`

Standard admin configuration methods.

### View Methods

#### `Admin()` | `Gateway()` | `PaymentHub()` | `IsPaused()`

Standard view methods for contract state.

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
- **Business Logic**: Auto-settle price predictions

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Events

### `PredictResult`

```csharp
event PredictResult(UInt160 player, bool won, BigInteger payout)
```

Emitted when a prediction is resolved.

## Usage Flow

1. User selects asset and prediction direction (UP/DOWN)
2. User places bet through frontend
3. System records prediction with timestamp
4. Oracle monitors price changes
5. Prediction resolves at expiry time
6. Winner receives 1.9x payout

## Contract Information

- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Price Predict - Binary options trading
- **Permissions**: Full contract permissions (`*`, `*`)
