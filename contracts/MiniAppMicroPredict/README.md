# MiniAppMicroPredict

## Overview

MiniAppMicroPredict is a fast-paced micro prediction market contract that enables 60-second binary prediction games on the Neo blockchain. Players make quick predictions on outcomes and receive instant payouts based on results, creating an engaging and rapid gaming experience.

## What It Does

This contract provides a micro prediction gaming platform by:

- Enabling rapid 60-second prediction rounds
- Processing binary win/loss outcomes with instant settlement
- Providing 1.9x payout multiplier for winning predictions
- Managing player bets and payouts through the Gateway service

## How It Works

### Architecture

The contract implements a streamlined prediction market:

- **Binary Outcomes**: Each prediction has two possible outcomes (win or loss)
- **Fixed Payout**: Winners receive 1.9x their bet amount (90% profit)
- **Off-Chain Oracle**: Outcome determination handled by off-chain services
- **On-Chain Settlement**: Results and payouts recorded on-chain via Gateway

### Game Mechanics

1. **Prediction Placement**: Player makes a prediction with a bet amount
2. **60-Second Window**: Prediction round runs for 60 seconds
3. **Outcome Determination**: Off-chain oracle determines the result
4. **Settlement**: Gateway calls `Resolve()` with win/loss and bet amount
5. **Payout**: Winners receive 1.9x bet, losers receive 0

### Payout Calculation

```
If player wins:  payout = bet * 1.9 (90% profit)
If player loses: payout = 0
```

The 1.9x multiplier provides:

- 90% return on investment for winners
- 10% house edge for platform sustainability
- Simple, transparent payout structure

## Key Methods

### Public Methods

#### `Resolve(UInt160 player, bool won, BigInteger bet)`

Resolves a prediction round and calculates payout.

**Parameters:**

- `player`: Address of the player who made the prediction
- `won`: Whether the player's prediction was correct
- `bet`: Original bet amount placed by the player

**Access Control:** Gateway only

**Behavior:**

- Validates that caller is the authorized Gateway
- Calculates payout: `won ? bet * 190 / 100 : 0`
- Emits `MicroResult` event with player, win status, and payout
- Triggers payment processing through PaymentHub

**Payout Logic:**

```csharp
payout = won ? bet * 190 / 100 : 0
```

**Events Emitted:**

- `MicroResult(UInt160 player, bool won, BigInteger payout)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain oracle services via the Gateway.

**Access Control:** Gateway only

**Purpose:** Handles asynchronous responses from prediction oracle service

### Administrative Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

#### `SetGateway(UInt160 g)`

Configures the ServiceLayerGateway address for service integration.

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub contract address for payment processing.

#### `SetPaused(bool paused)`

Enables or disables contract operations (emergency stop).

### Query Methods

#### `Admin() → UInt160`

Returns the current administrator address.

#### `Gateway() → UInt160`

Returns the configured Gateway address.

#### `PaymentHub() → UInt160`

Returns the PaymentHub contract address.

#### `IsPaused() → bool`

Returns whether the contract is currently paused.

## Events

### `MicroResult`

```csharp
event MicroResultHandler(UInt160 player, bool won, BigInteger payout)
```

Emitted when a prediction round is resolved.

**Parameters:**

- `player`: Address of the player who made the prediction
- `won`: Whether the player won (true) or lost (false)
- `payout`: Amount paid to the player (0 if lost, bet \* 1.9 if won)

**Use Cases:**

- Frontend updates player balance and game history
- Analytics tracking for win/loss statistics
- Audit trail for game outcomes

## Automation Support

MiniAppMicroPredict supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Settle Micro Predictions

The automation service automatically settles prediction rounds and processes payouts after the 60-second window.

**Trigger Conditions:**

- 60-second prediction window has elapsed
- Prediction outcome has been determined by oracle
- Prediction has not been settled yet

**Automation Flow:**

1. Automation service monitors active prediction rounds
2. After 60 seconds, oracle determines outcome
3. Service calls Gateway with result (win/loss)
4. Gateway invokes `Resolve()` with payout calculation
5. `MicroResult` event emitted
6. PaymentHub processes payout to winner

**Benefits:**

- Instant settlement after prediction window
- No manual settlement required
- Consistent 60-second round timing
- Reliable payout processing

**Configuration:**

- Settlement delay: 60 seconds (fixed)
- Check interval: Every 5 seconds
- Batch processing: Up to 100 predictions per batch
- Oracle timeout: 10 seconds

## Usage Flow

### Complete Prediction Workflow

```
1. Player Makes Prediction
   User → MiniApp Frontend → Off-Chain Service (via Gateway)

2. 60-Second Round
   Timer Countdown → Outcome Determination → Oracle Service

3. Result Settlement
   Oracle → Gateway → Resolve() → MicroResult Event → PaymentHub

4. Frontend Update
   MicroResult Event → MiniApp Frontend → Balance Update
```

### Detailed Resolution Flow

1. **Prediction Placement**: Player submits prediction through frontend
2. **Bet Recording**: Off-chain service records bet and prediction choice
3. **60-Second Timer**: Round countdown begins
4. **Outcome Determination**: Oracle service determines the result
5. **Gateway Invocation**: Oracle calls Gateway with player, won status, and bet amount
6. **Contract Execution**: Gateway invokes `Resolve(player, won, bet)`
7. **Payout Calculation**: Contract calculates payout (bet \* 1.9 if won, 0 if lost)
8. **Event Emission**: `MicroResult` event is emitted
9. **Payment Processing**: PaymentHub transfers payout to player (if won)

## Security Considerations

### Access Control

- **Gateway Restriction**: Only Gateway can call `Resolve()`
- **Admin Protection**: Administrative functions require admin witness
- **Pause Mechanism**: Emergency stop capability for security incidents

### Oracle Trust

- **Centralized Oracle**: Outcome determination relies on off-chain oracle
- **No On-Chain Verification**: Results cannot be verified on-chain
- **Trust Requirement**: Players must trust the oracle service

### Economic Security

- **Fixed Payout**: 1.9x multiplier prevents manipulation
- **House Edge**: 10% edge ensures platform sustainability
- **No Arbitrage**: Binary outcomes with fixed odds prevent arbitrage

### Limitations

- Requires trusted oracle for outcome determination
- Gateway is a centralized trust point
- No on-chain randomness or verification
- Players cannot dispute outcomes on-chain

## Integration Requirements

### Prerequisites

1. **Oracle Service**: Prediction outcome oracle service
2. **ServiceLayerGateway**: Deployed and configured
3. **PaymentHub**: Deployed for handling payouts
4. **Data Feed**: Real-time data source for predictions

### Configuration Steps

1. Deploy MiniAppMicroPredict contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment processing
4. Configure oracle service with contract address and Gateway endpoint
5. Set up data feeds for prediction outcomes

### Oracle Service Requirements

- Must determine outcomes within 60 seconds
- Must provide reliable, tamper-proof results
- Must communicate results through Gateway
- Should implement dispute resolution mechanism

## Example Prediction Types

### Supported Prediction Markets

- **Price Movements**: Will BTC price go up or down in 60 seconds?
- **Random Events**: Will the next block hash end in odd or even?
- **Sports Events**: Will the next point be scored by team A or B?
- **Market Indicators**: Will trading volume increase or decrease?

### Prediction Parameters

- **Duration**: Fixed 60-second rounds
- **Bet Range**: Configurable minimum and maximum bet amounts
- **Payout**: Fixed 1.9x multiplier for winners
- **Frequency**: Unlimited rounds, back-to-back gameplay

## Contract Metadata

- **Name**: MiniAppMicroPredict
- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Micro Predict - 60-second predictions
