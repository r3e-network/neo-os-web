# MiniAppFogChess

## Overview

MiniAppFogChess is a fog of war chess game smart contract that enables strategic chess gameplay with hidden moves on the Neo blockchain. This contract serves as the on-chain component for fog chess mechanics, recording move revelations and integrating with external game services through the ServiceLayerGateway.

## What It Does

The contract provides a secure, gateway-controlled interface for fog chess operations. It:

- Records move revelations on-chain
- Tracks game state through events
- Emits events for move tracking and game analytics
- Integrates with external game logic services via callbacks
- Enforces access control through the ServiceLayerGateway
- Supports pause/unpause functionality for emergency stops

Fog of war chess is a variant where players cannot see their opponent's pieces or moves until they are revealed, adding an element of uncertainty and strategic depth to traditional chess.

## Architecture

### Access Control Model

The contract implements a three-tier access control system:

1. **Admin**: Contract owner with full configuration rights
2. **Gateway**: ServiceLayerGateway contract that validates and routes requests
3. **PaymentHub**: Payment processing contract for fee handling

All game operations must be invoked through the Gateway, ensuring proper validation and authorization.

## Key Methods

### Administrative Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

- **Access**: Admin only
- **Parameters**: `a` - New admin address
- **Validation**: Requires valid address and admin witness

#### `SetGateway(UInt160 g)`

Configures the ServiceLayerGateway address.

- **Access**: Admin only
- **Parameters**: `g` - Gateway contract address
- **Purpose**: Establishes the trusted gateway for game operations

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub contract address.

- **Access**: Admin only
- **Parameters**: `hub` - PaymentHub contract address

#### `SetPaused(bool paused)`

Enables or disables contract operations.

- **Access**: Admin only
- **Parameters**: `paused` - true to pause, false to resume

#### `Update(ByteString nef, string manifest)`

Upgrades the contract code.

- **Access**: Admin only
- **Parameters**:
  - `nef` - New executable format bytecode
  - `manifest` - Contract manifest

### Core Game Methods

#### `RevealMove(ByteString gameId, UInt160 player, string move)`

Records a move revelation on-chain.

- **Access**: Gateway only
- **Parameters**:
  - `gameId` - Unique identifier of the game
  - `player` - Address of the player making the move
  - `move` - Move notation (e.g., "e2e4", "Nf3")
- **Emits**: `MoveRevealed` event

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Handles callbacks from external game services.

- **Access**: Gateway only
- **Parameters**:
  - `r` - Request ID
  - `a` - Action identifier
  - `s` - Service name
  - `ok` - Success status
  - `res` - Response data
  - `e` - Error message (if any)

### Query Methods

#### `Admin() → UInt160`

Returns the current admin address.

#### `Gateway() → UInt160`

Returns the ServiceLayerGateway address.

#### `PaymentHub() → UInt160`

Returns the PaymentHub address.

#### `IsPaused() → bool`

Returns the contract pause status.

## Events

### `MoveRevealed`

Emitted when a player's move is revealed.

**Signature**: `MoveRevealed(ByteString gameId, UInt160 player, string move)`

**Parameters**:

- `gameId` - Unique identifier of the game
- `player` - Address of the player who made the move
- `move` - Move notation

## Automation Support

MiniAppFogChess supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Timeout Inactive Games

The automation service automatically times out fog chess games where players have been inactive beyond the allowed time limit.

**Trigger Conditions:**

- Player has not made a move within timeout period (default 10 minutes)
- Game is in active state waiting for player move
- Game has not already been timed out or completed

**Automation Flow:**

1. Automation service monitors player move timestamps
2. When timeout period exceeded
3. Service calls Gateway to timeout inactive player
4. Inactive player automatically forfeits
5. Opponent declared winner
6. `GameTimedOut` event emitted (if implemented)

**Benefits:**

- Prevents games from stalling indefinitely
- Maintains game flow and player experience
- Automatic cleanup of abandoned games
- Fair enforcement of time limits

**Configuration:**

- Move timeout: 10 minutes per player turn
- Check interval: Every 1 minute
- Grace period: 1 minute warning before timeout
- Batch processing: Up to 30 games per batch

## Usage Flow

### Initial Setup

1. Deploy the contract (admin is set to deployer)
2. Admin calls `SetGateway()` to configure the ServiceLayerGateway
3. Admin calls `SetPaymentHub()` to configure payment processing
4. Gateway registers this contract as a valid MiniApp

### Fog Chess Game Flow

1. Two players initiate a fog chess game via frontend
2. Game service generates unique gameId
3. Players submit moves to off-chain game service
4. Moves are encrypted/hidden from opponent
5. When conditions trigger revelation (piece capture, check, etc.):
   - Game service sends revelation request to Gateway
   - Gateway calls `RevealMove()` with move details
   - Contract emits `MoveRevealed` event
6. Frontend updates visible board state for both players
7. Game continues until checkmate or draw
8. Final game state recorded via callbacks

### Fog of War Mechanics

In fog chess, players have limited visibility:

- **Visible**: Own pieces and their possible moves
- **Hidden**: Opponent's pieces until they enter visible range
- **Revealed**: Pieces that capture, give check, or enter visible squares

This creates strategic uncertainty and rewards careful planning.

### Emergency Procedures

If issues are detected:

1. Admin calls `SetPaused(true)` to halt operations
2. Investigate and resolve issues
3. Admin calls `SetPaused(false)` to resume

## Security Considerations

### Access Control

- Only Gateway can reveal moves, preventing unauthorized access
- Admin functions require witness verification
- All addresses are validated before storage

### Validation

- Gateway address must be set before game operations
- Admin address must be valid for administrative operations
- Contract enforces caller validation on all sensitive methods

### Game Integrity

- Move validation handled by off-chain game engine
- On-chain events provide immutable move history
- Prevents cheating through transparent revelation mechanism

### Upgrade Safety

- Contract supports upgrades via `Update()` method
- Only admin can trigger upgrades
- Upgrade preserves storage state

## Integration Points

### ServiceLayerGateway

The Gateway acts as the primary entry point, handling:

- Request validation
- Player authentication
- Move verification
- Fee collection
- Service routing

### PaymentHub

Manages payment processing for:

- Game entry fees
- Tournament prizes
- Platform fees

### External Game Services

Game services integrate via:

- REST API calls to Gateway
- Chess engine for move validation
- Fog of war logic computation
- Callback mechanism for game results
- Event monitoring for move confirmations

## Development Notes

- Contract follows the standard MiniApp pattern
- Uses storage prefixes for organized data management
- Implements defensive programming with assertions
- Events enable off-chain monitoring and analytics
- Game logic (chess rules, fog mechanics) handled off-chain
- Contract serves as immutable record of revealed moves
- Designed for tournament and casual play modes

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
