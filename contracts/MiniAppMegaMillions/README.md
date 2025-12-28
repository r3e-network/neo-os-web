# MiniAppMegaMillions

## Overview

MiniAppMegaMillions is a sophisticated multi-tier lottery system inspired by real-world MegaMillions. Players select 5 main numbers (1-70) and 1 Mega Ball (1-25), then compete for prizes across 9 different tiers based on matching combinations. The jackpot starts at 1000 GAS and grows with each ticket sale, with VRF randomness ensuring provably fair draws.

## How It Works

### Core Mechanism

1. **Ticket Purchase**: Players choose 5 numbers (1-70) + 1 Mega Ball (1-25)
2. **Pool Accumulation**: 50% of ticket price (0.1 GAS) goes to jackpot pool
3. **VRF Draw**: Admin triggers draw with VRF randomness generating winning numbers
4. **Prize Tiers**: 9 prize levels from jackpot down to Mega Ball only match
5. **Prize Claims**: Players claim prizes by submitting their ticket numbers
6. **Jackpot Reset**: After jackpot win, pool resets to 1000 GAS initial value

### Prize Structure

The game features 9 prize tiers:

| Tier | Match Pattern | Prize Amount                   |
| ---- | ------------- | ------------------------------ |
| 0    | 5 + Mega Ball | Jackpot Pool (starts 1000 GAS) |
| 1    | 5 + 0         | 100 GAS                        |
| 2    | 4 + Mega Ball | 50 GAS                         |
| 3    | 4 + 0         | 5 GAS                          |
| 4    | 3 + Mega Ball | 2 GAS                          |
| 5    | 3 + 0         | 0.5 GAS                        |
| 6    | 2 + Mega Ball | 0.5 GAS                        |
| 7    | 1 + Mega Ball | 0.2 GAS                        |
| 8    | 0 + Mega Ball | 0.1 GAS                        |

### Architecture

The contract follows the standard MiniApp architecture with advanced features:

- **Round-Based System**: Each lottery operates in discrete rounds
- **Gateway Integration**: Only ServiceLayerGateway can trigger draws
- **Multi-Tier Prizes**: 9 different prize levels based on match patterns
- **Jackpot Management**: Dynamic jackpot pool that grows with ticket sales
- **Prize Claiming**: Players claim prizes by proving their ticket matches
- **Event-Driven**: Emits events for purchases, draws, and prize claims

## Key Methods

### Game Logic

#### `BuyTicket(UInt160 player, byte[] mainNumbers, byte megaBall)`

Purchase a lottery ticket with chosen numbers.

**Parameters:**

- `player`: Address of the player
- `mainNumbers`: Array of 5 numbers (1-70)
- `megaBall`: Mega Ball number (1-25)

**Validation:**

- Only callable by gateway
- Player address must be valid
- Must provide exactly 5 main numbers
- Each main number must be 1-70
- Mega Ball must be 1-25

**Behavior:**

- Adds 50% of ticket price (0.1 GAS) to jackpot pool
- Emits `TicketPurchased` event

#### `Draw(ByteString randomness)`

Draws winning numbers using VRF randomness.

**Parameters:**

- `randomness`: VRF randomness (minimum 32 bytes)

**Validation:**

- Only callable by gateway
- Randomness must be at least 32 bytes

**Behavior:**

- Generates 5 main numbers from randomness bytes 0-19
- Generates 1 Mega Ball from randomness byte 20
- Increments round number
- Emits `DrawCompleted` event with winning numbers

#### `CalculateTier(byte[] ticket, byte ticketMega, byte[] winning) → int`

Calculates prize tier based on matching numbers.

**Parameters:**

- `ticket`: Player's 5 main numbers
- `ticketMega`: Player's Mega Ball
- `winning`: Winning numbers (5 main + 1 mega)

**Returns:**

- Tier number (0-8 for wins, 9 for no win)

**Behavior:**

- Counts main number matches (0-5)
- Checks Mega Ball match (true/false)
- Returns tier based on match pattern

#### `ClaimPrize(UInt160 player, byte[] ticket, byte mega, byte[] winning) → BigInteger`

Claims prize for a winning ticket.

**Parameters:**

- `player`: Player's address
- `ticket`: Player's 5 main numbers
- `mega`: Player's Mega Ball
- `winning`: Winning numbers from draw

**Validation:**

- Only callable by gateway

**Returns:**

- Prize amount (0 if no win)

**Behavior:**

- Calculates tier using `CalculateTier()`
- Returns 0 if tier is 9 (no win)
- For jackpot (tier 0): pays full jackpot pool, resets to 1000 GAS, emits `JackpotWon`
- For other tiers: pays fixed prize amount, emits `PrizeWon`

#### `GetPrizeAmount(int tier) → BigInteger`

Returns prize amount for a given tier.

**Parameters:**

- `tier`: Prize tier (0-8)

**Returns:**

- Prize amount (jackpot pool for tier 0, fixed amounts for tiers 1-8)

### Admin Methods

#### `SetAdmin(UInt160 a)`

Sets a new admin address. Only current admin can call.

#### `SetGateway(UInt160 gateway)`

Sets the ServiceLayerGateway address. Only admin can call.

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub address for payment processing. Only admin can call.

#### `SetPaused(bool paused)`

Pauses or unpauses the contract. Only admin can call.

#### `Update(ByteString nef, string manifest)`

Updates the contract code. Only admin can call.

### Query Methods

#### `Admin() → UInt160`

Returns the admin address.

#### `Gateway() → UInt160`

Returns the gateway address.

#### `PaymentHub() → UInt160`

Returns the payment hub address.

#### `IsPaused() → bool`

Returns whether the contract is paused.

#### `CurrentRound() → BigInteger`

Returns the current round number.

#### `JackpotPool() → BigInteger`

Returns the current jackpot pool amount.

## Events

### `TicketPurchased(UInt160 player, BigInteger roundId, byte[] mainNumbers, byte megaBall)`

Emitted when a player purchases a ticket.

**Parameters:**

- `player`: Player's address
- `roundId`: Current round number
- `mainNumbers`: Player's 5 chosen numbers
- `megaBall`: Player's chosen Mega Ball

### `DrawCompleted(BigInteger roundId, byte[] winningNumbers, BigInteger jackpotPool)`

Emitted when winning numbers are drawn.

**Parameters:**

- `roundId`: Round number for this draw
- `winningNumbers`: 6 bytes (5 main + 1 mega)
- `jackpotPool`: Current jackpot amount

### `PrizeWon(UInt160 player, BigInteger roundId, int tier, BigInteger amount)`

Emitted when a player wins a non-jackpot prize.

**Parameters:**

- `player`: Winner's address
- `roundId`: Round number
- `tier`: Prize tier (1-8)
- `amount`: Prize amount

### `JackpotWon(UInt160 player, BigInteger roundId, BigInteger amount)`

Emitted when a player wins the jackpot.

**Parameters:**

- `player`: Winner's address
- `roundId`: Round number
- `amount`: Jackpot amount

## Usage Flow

### Standard Game Flow

```
1. Player selects 5 numbers (1-70) + 1 Mega Ball (1-25)
   ↓
2. Frontend calls BuyTicket() through gateway
   ↓
3. Contract adds 50% of ticket price to jackpot
   ↓
4. Contract emits TicketPurchased event
   ↓
5. Admin triggers draw through gateway
   ↓
6. Gateway requests VRF randomness
   ↓
7. Gateway calls Draw() with randomness
   ↓
8. Contract generates winning numbers
   ↓
9. Contract emits DrawCompleted event
   ↓
10. Players claim prizes via ClaimPrize()
   ↓
11. Contract calculates tier and pays prize
   ↓
12. Contract emits PrizeWon or JackpotWon event
```

### Deployment Flow

```
1. Deploy contract (initializes round 1, jackpot 1000 GAS)
   ↓
2. Admin calls SetGateway() with gateway address
   ↓
3. Admin calls SetPaymentHub() with payment hub address
   ↓
4. Register with AppRegistry
   ↓
5. Contract ready for ticket sales
```

## Game Economics

- **Ticket Price**: 0.2 GAS (20000000)
- **Jackpot Contribution**: 50% of ticket price (0.1 GAS)
- **Initial Jackpot**: 1000 GAS
- **Prize Tiers**: 9 levels (jackpot + 8 fixed prizes)
- **Number Ranges**: Main 1-70, Mega Ball 1-25

## Security Features

1. **Gateway-Only Access**: Only gateway can trigger draws and prize claims
2. **Admin Controls**: Separate admin functions with witness validation
3. **Pausable**: Emergency pause mechanism
4. **VRF Randomness**: Uses provably fair randomness for number generation
5. **Input Validation**: Strict validation of number ranges and ticket format
6. **Jackpot Protection**: Jackpot resets to safe minimum after win

## Constants

- **Ticket Price**: 0.2 GAS (20000000)
- **Initial Jackpot**: 1000 GAS (100000000000)
- **Main Numbers Count**: 5
- **Main Numbers Range**: 1-70
- **Mega Ball Range**: 1-25
- **Jackpot Contribution**: 50% of ticket price

## Prize Amounts (Fixed Tiers)

```
Tier 1 (5+0):     100 GAS (10000000000)
Tier 2 (4+M):      50 GAS (5000000000)
Tier 3 (4+0):       5 GAS (500000000)
Tier 4 (3+M):       2 GAS (200000000)
Tier 5 (3+0):     0.5 GAS (50000000)
Tier 6 (2+M):     0.5 GAS (50000000)
Tier 7 (1+M):     0.2 GAS (20000000)
Tier 8 (0+M):     0.1 GAS (10000000)
```

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
- **Business Logic**: Auto-draw lottery when conditions met

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Notes

- Contract must be registered with AppRegistry
- Gateway must be configured before gameplay
- PaymentHub must be set for automatic prize distribution
- Frontend should listen to all four event types for complete game tracking
- Players must store their ticket numbers to claim prizes
- Randomness must be at least 32 bytes for proper number generation
- Round tracking allows for historical lottery data and prize claims
- Multi-tier system provides multiple ways to win
