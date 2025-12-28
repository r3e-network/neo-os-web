# MiniAppSecretPoker

## Overview

MiniAppSecretPoker is a Trusted Execution Environment (TEE) based Texas Hold'em poker game contract that enables secure, fair poker gameplay on the Neo blockchain. The contract leverages off-chain TEE services to ensure card dealing fairness while maintaining game integrity through on-chain settlement.

## What It Does

This contract provides a secure poker gaming platform by:

- Enabling fair Texas Hold'em poker games with TEE-based card dealing
- Processing hand results and payouts through the Gateway service
- Ensuring game integrity through cryptographic verification
- Managing player settlements on-chain while keeping card data private

## How It Works

### Architecture

The contract implements a hybrid on-chain/off-chain architecture:

- **TEE Card Dealing**: Card shuffling and dealing occur in a Trusted Execution Environment
- **Off-Chain Game Logic**: Hand evaluation and game progression handled by TEE services
- **On-Chain Settlement**: Final hand results and payouts are recorded on-chain
- **Gateway Integration**: All service interactions flow through ServiceLayerGateway

### Game Flow

1. **Game Initialization**: Players join a poker table via the MiniApp frontend
2. **TEE Processing**: Off-chain TEE service handles card dealing and game progression
3. **Hand Resolution**: When a hand completes, TEE service calculates winners and payouts
4. **On-Chain Settlement**: Gateway calls `ResolveHand()` to record results and trigger payouts
5. **Event Emission**: `HandResult` event is emitted for frontend updates

### Security Through TEE

The Trusted Execution Environment ensures:

- **Fair Dealing**: Cards are shuffled using cryptographically secure randomness
- **Privacy**: Player cards remain hidden until showdown
- **Tamper-Proof**: Game logic executes in isolated, verified environment
- **Verifiable**: Hand results can be cryptographically verified

## Key Methods

### Public Methods

#### `ResolveHand(UInt160 player, BigInteger payout)`

Records the result of a completed poker hand and triggers payout.

**Parameters:**

- `player`: Address of the player receiving the payout
- `payout`: Amount to be paid to the player (in smallest unit)

**Access Control:** Gateway only

**Behavior:**

- Validates that caller is the authorized Gateway
- Emits `HandResult` event with player address and payout amount
- Triggers payment processing through PaymentHub

**Events Emitted:**

- `HandResult(UInt160 player, BigInteger payout)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain TEE services via the Gateway.

**Access Control:** Gateway only

**Purpose:** Handles asynchronous responses from TEE poker service

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

### `HandResult`

```csharp
event HandResultHandler(UInt160 player, BigInteger payout)
```

Emitted when a poker hand is resolved and payout is determined.

**Parameters:**

- `player`: Address of the player receiving the payout
- `payout`: Amount paid to the player

**Use Cases:**

- Frontend updates player balance display
- Analytics tracking for game statistics
- Audit trail for game outcomes

## Automation Support

MiniAppSecretPoker supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Timeout Inactive Games

The automation service automatically times out poker games where players have been inactive beyond the allowed time limit.

**Trigger Conditions:**

- Player has not acted within timeout period (default 5 minutes)
- Game is in active state waiting for player action
- Game has not already been timed out

**Automation Flow:**

1. Automation service monitors player action timestamps
2. When timeout period exceeded
3. Service calls Gateway to timeout inactive player
4. Inactive player automatically folds
5. Game continues with remaining active players
6. `PlayerTimedOut` event emitted (if implemented)

**Benefits:**

- Prevents games from stalling indefinitely
- Maintains game flow and player experience
- Automatic cleanup of abandoned games
- Fair enforcement of time limits

**Configuration:**

- Action timeout: 5 minutes per player turn
- Check interval: Every 30 seconds
- Grace period: 30 seconds warning before timeout
- Batch processing: Up to 50 games per batch

## Usage Flow

### Complete Game Workflow

```
1. Player Joins Table
   User → MiniApp Frontend → TEE Service (via Gateway)

2. Game Progression
   TEE Service → Card Dealing → Hand Evaluation → Winner Determination

3. Hand Settlement
   TEE Service → Gateway → ResolveHand() → HandResult Event → PaymentHub

4. Frontend Update
   HandResult Event → MiniApp Frontend → UI Update
```

### Detailed Hand Resolution

1. **Hand Completion**: All betting rounds complete or players fold
2. **Winner Calculation**: TEE service evaluates hands and determines winner(s)
3. **Payout Calculation**: Service calculates payout amounts based on pot size
4. **Gateway Invocation**: TEE service calls Gateway with settlement data
5. **Contract Execution**: Gateway invokes `ResolveHand(winner, payout)`
6. **Event Emission**: `HandResult` event is emitted
7. **Payment Processing**: PaymentHub transfers funds to winner

## Security Considerations

### TEE Security

- **Isolated Execution**: Game logic runs in hardware-protected environment
- **Attestation**: TEE provides cryptographic proof of correct execution
- **Sealed Data**: Card state is encrypted and sealed within TEE
- **No Manipulation**: Neither players nor operators can manipulate card dealing

### Access Control

- **Gateway Restriction**: Only Gateway can call `ResolveHand()`
- **Admin Protection**: Administrative functions require admin witness
- **Pause Mechanism**: Emergency stop capability for security incidents

### Trust Model

- **TEE Trust**: Players must trust the TEE hardware and attestation
- **Gateway Trust**: Gateway must be trusted to relay TEE results accurately
- **Operator Trust**: Contract admin has emergency pause capability

### Limitations

- Requires functional TEE infrastructure
- Gateway is a centralized trust point
- No on-chain verification of hand outcomes (relies on TEE attestation)

## Integration Requirements

### Prerequisites

1. **TEE Service**: Poker game service running in TEE environment
2. **ServiceLayerGateway**: Deployed and configured to communicate with TEE
3. **PaymentHub**: Deployed for handling player payouts
4. **Attestation Service**: For verifying TEE integrity

### Configuration Steps

1. Deploy MiniAppSecretPoker contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment processing
4. Configure TEE service with contract address and Gateway endpoint
5. Verify TEE attestation and register with Gateway

### TEE Service Requirements

- Must implement Texas Hold'em game logic
- Must generate cryptographically secure random numbers
- Must provide attestation proof of execution
- Must communicate results through Gateway

## Game Rules

### Texas Hold'em Basics

- Each player receives 2 hole cards (private)
- 5 community cards dealt in stages (flop, turn, river)
- Players make best 5-card hand from 7 available cards
- Standard poker hand rankings apply

### Payout Structure

- Winner takes the pot (sum of all bets)
- In case of tie, pot is split equally
- Rake/fees may be deducted by platform

## Contract Metadata

- **Name**: MiniAppSecretPoker
- **Author**: R3E Network
- **Version**: 2.0.0
- **Description**: Secret Poker - TEE Texas Hold'em
