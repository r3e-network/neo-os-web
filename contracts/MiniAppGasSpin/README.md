# MiniAppGasSpin

## Overview

MiniAppGasSpin is a lucky wheel game contract that uses Verifiable Random Functions (VRF) to provide provably fair random outcomes. Players spin the wheel and can win multiplied payouts based on the tier they land on.

## What It Does

The GasSpin contract provides:

- **Lucky Wheel Game**: Players spin a wheel with 8 tiers
- **VRF-Based Randomness**: Uses cryptographic randomness for fairness
- **Tiered Payouts**: Different tiers offer different multipliers
- **Automated Rewards**: Winners receive instant payouts

This contract creates an engaging gambling experience with transparent, verifiable randomness.

## How It Works

### Architecture

The contract implements a simple spin-and-win mechanism:

- **Gateway Integration**: All spins are triggered through ServiceLayerGateway
- **VRF Randomness**: Uses off-chain VRF service for random number generation
- **Tier System**: 8 tiers with different payout multipliers
- **Event-Driven**: Emits events for tracking results

### Core Mechanism

1. **Spin Request**: Gateway calls `Spin()` with player, bet amount, and VRF randomness
2. **Tier Calculation**: First byte of randomness modulo 8 determines tier (0-7)
3. **Multiplier Logic**:
   - Tiers 6-7: 5x multiplier
   - Tiers 3-5: 2x multiplier
   - Tiers 0-2: 0x multiplier (no win)
4. **Payout Calculation**: payout = bet _ multiplier _ 90% (10% house edge)
5. **Event Emission**: Contract emits `SpinResult` with tier and payout

### Payout Table

| Tier | Probability | Multiplier | Payout (for 100 bet) |
| ---- | ----------- | ---------- | -------------------- |
| 0-2  | 37.5%       | 0x         | 0                    |
| 3-5  | 37.5%       | 2x         | 180 (90% of 200)     |
| 6-7  | 25%         | 5x         | 450 (90% of 500)     |

## Key Methods

### Public Methods

#### `Spin(UInt160 player, BigInteger bet, ByteString randomness)`

Executes a wheel spin with VRF randomness.

**Parameters:**

- `player`: Address of the player spinning
- `bet`: Bet amount in base units
- `randomness`: VRF-generated random bytes

**Access Control:** Gateway only

**Logic:**

```csharp
tier = randomness[0] % 8
multiplier = tier >= 6 ? 5 : tier >= 3 ? 2 : 0
payout = bet * multiplier * 90 / 100
```

**Events Emitted:** `SpinResult(player, tier, payout)`

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

## Events

### `SpinResult`

```csharp
event SpinResult(UInt160 player, BigInteger tier, BigInteger payout)
```

Emitted when a spin is executed.

**Parameters:**

- `player`: Player address
- `tier`: Tier landed on (0-7)
- `payout`: Payout amount (0 if no win)

## Usage Flow

### Standard Spin Flow

1. **Spin Initiation**
   - User clicks spin button in frontend
   - Frontend requests VRF randomness from Gateway
   - User's bet is collected by PaymentHub

2. **VRF Generation**
   - Off-chain VRF service generates random bytes
   - Randomness is cryptographically verifiable
   - Gateway receives VRF result

3. **Spin Execution**
   - Gateway calls `Spin()` with player, bet, and randomness
   - Contract calculates tier from randomness
   - Contract determines multiplier based on tier
   - Contract calculates payout with 10% house edge

4. **Result Emission**
   - Contract emits `SpinResult` event
   - Frontend displays wheel animation
   - Frontend shows tier and payout

5. **Payout Processing**
   - If payout > 0, PaymentHub transfers winnings
   - Frontend updates user balance

### Example Integration

```csharp
// Gateway receives VRF randomness and triggers spin
var vrfRandomness = GetVRFRandomness(); // From VRF service
var betAmount = 100_00000000; // 100 tokens

Contract.Call(
    gasSpinAddress,
    "spin",
    playerAddress,
    betAmount,
    vrfRandomness
);

// Contract calculates result
// tier = vrfRandomness[0] % 8
// If tier = 6: multiplier = 5x, payout = 100 * 5 * 0.9 = 450 tokens
// If tier = 4: multiplier = 2x, payout = 100 * 2 * 0.9 = 180 tokens
// If tier = 1: multiplier = 0x, payout = 0 tokens
```

## Randomness and Fairness

### VRF Integration

The contract uses Verifiable Random Functions (VRF) to ensure fairness:

- **Cryptographic Security**: VRF output is cryptographically secure
- **Verifiability**: Players can verify randomness was not manipulated
- **Unpredictability**: Outcome cannot be predicted before spin
- **Transparency**: All results are recorded on-chain

### Tier Distribution

With uniform random distribution:

- **37.5% chance** of losing (tiers 0-2)
- **37.5% chance** of 2x win (tiers 3-5)
- **25% chance** of 5x win (tiers 6-7)

Expected value per 100 token bet:

```
EV = (0.375 * 0) + (0.375 * 180) + (0.25 * 450)
   = 0 + 67.5 + 112.5
   = 180 tokens
```

House edge: 10% (player receives 90% of theoretical payout)

## Security Considerations

1. **Gateway-Only Access**: Only Gateway can trigger spins
2. **VRF Dependency**: Relies on trusted VRF service for randomness
3. **Deterministic Logic**: Tier calculation is transparent and verifiable
4. **Event Transparency**: All spins are recorded on-chain
5. **Admin Controls**: Emergency pause mechanism available

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
- **Business Logic**: Auto-process pending spin results

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Points

- **ServiceLayerGateway**: Triggers spins with VRF randomness
- **VRF Service**: Provides cryptographic randomness
- **PaymentHub**: Handles bet collection and payouts
- **Frontend**: User interface for spinning wheel

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure VRF service integration
6. Set up frontend with wheel animation

## Version

**Version:** 1.0.0
**Author:** R3E Network
**Description:** Gas Spin - Lucky wheel with VRF
