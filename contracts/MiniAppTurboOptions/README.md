# MiniAppTurboOptions

## Overview

MiniAppTurboOptions is a fast-paced binary options trading contract that enables users to trade on short-term price movements. It offers quick settlement times and competitive payouts for successful trades.

## What It Does

The contract provides high-speed binary options trading:

- **Fast Binary Options**: Quick trades on price direction (UP/DOWN)
- **Fixed Payout Ratio**: Winners receive 185% of their stake (1.85x multiplier)
- **Gateway-Resolved**: Trades are settled by ServiceLayerGateway based on oracle data
- **Event-Driven**: Emits results for real-time updates

## How It Works

### Architecture

The contract follows the standard MiniApp architecture with:

1. **Admin Management**: Controls contract configuration and upgrades
2. **Gateway Integration**: Receives settlement data through ServiceLayerGateway
3. **PaymentHub Integration**: Handles stake collection and payout distribution
4. **Pause Mechanism**: Emergency stop functionality

### Payout Calculation

```csharp
BigInteger payout = won ? stake * 185 / 100 : 0;  // 1.85x for winners, 0 for losers
```

For example:

- Stake 100 tokens and WIN → Receive 185 tokens (85 profit)
- Stake 100 tokens and LOSE → Receive 0 tokens (100 loss)
- House edge: ~7.5% (1 - 1.85/2 = 0.075)

### Trading Flow

1. Trader selects asset and direction (CALL/PUT)
2. Trader stakes tokens through frontend
3. Trade is recorded with entry price and expiry time
4. Oracle monitors price at expiry
5. ServiceLayerGateway calls `Resolve()` with outcome
6. Contract emits `TurboResult` event
7. Winner receives 1.85x payout through PaymentHub

## Key Methods

### Public Methods

#### `Resolve(UInt160 trader, bool won, BigInteger stake)`

Resolves a turbo option trade and calculates payout.

**Parameters:**

- `trader`: Address of the trader
- `won`: Whether the trade was successful
- `stake`: Original stake amount

**Requirements:**

- Can only be called by ServiceLayerGateway

**Emits:** `TurboResult(trader, won, payout)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Callback handler for external service responses.

**Requirements:**

- Can only be called by ServiceLayerGateway

### Admin Methods

Standard admin methods: `SetAdmin()`, `SetGateway()`, `SetPaymentHub()`, `SetPaused()`, `Update()`

### View Methods

Standard view methods: `Admin()`, `Gateway()`, `PaymentHub()`, `IsPaused()`

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
- **Business Logic**: Auto-settle expired options

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Events

### `TurboResult`

```csharp
event TurboResult(UInt160 trader, bool won, BigInteger payout)
```

Emitted when a turbo option trade is resolved.

## Usage Flow

1. Trader selects asset and direction
2. Trader stakes tokens
3. Trade executes at current price
4. Oracle monitors price at expiry
5. Trade resolves automatically
6. Winner receives 1.85x payout

## Contract Information

- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Turbo Options - Fast binary options trading
- **Permissions**: Full contract permissions (`*`, `*`)
