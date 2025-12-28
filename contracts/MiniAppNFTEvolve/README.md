# MiniAppNFTEvolve

## Overview

MiniAppNFTEvolve is an NFT evolution and breeding smart contract that enables dynamic NFT upgrades on the Neo blockchain. This contract serves as the on-chain component for NFT evolution mechanics, recording evolution events and integrating with external services through the ServiceLayerGateway.

## What It Does

The contract provides a secure, gateway-controlled interface for NFT evolution operations. It:

- Records NFT evolution events on-chain
- Tracks NFT level progression
- Emits events for evolution tracking and analytics
- Integrates with external services for evolution logic via callbacks
- Enforces access control through the ServiceLayerGateway
- Supports pause/unpause functionality for emergency stops

NFT evolution allows digital collectibles to "level up" or transform based on user actions, time, or other conditions, creating dynamic and engaging NFT experiences.

## Architecture

### Access Control Model

The contract implements a three-tier access control system:

1. **Admin**: Contract owner with full configuration rights
2. **Gateway**: ServiceLayerGateway contract that validates and routes requests
3. **PaymentHub**: Payment processing contract for fee handling

All evolution operations must be invoked through the Gateway, ensuring proper validation and authorization.

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
- **Purpose**: Establishes the trusted gateway for evolution operations

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

### Core Evolution Methods

#### `Evolve(UInt160 owner, ByteString tokenId, BigInteger newLevel)`

Records an NFT evolution on-chain.

- **Access**: Gateway only
- **Parameters**:
  - `owner` - NFT owner address
  - `tokenId` - Unique identifier of the NFT being evolved
  - `newLevel` - New level after evolution
- **Emits**: `NFTEvolved` event

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Handles callbacks from external evolution services.

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

### `NFTEvolved`

Emitted when an NFT evolves to a new level.

**Signature**: `NFTEvolved(UInt160 owner, ByteString tokenId, BigInteger newLevel)`

**Parameters**:

- `owner` - Address of the NFT owner
- `tokenId` - Unique identifier of the evolved NFT
- `newLevel` - New level after evolution

## Automation Support

MiniAppNFTEvolve supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Trigger Evolution Conditions

The automation service automatically triggers NFT evolution when predefined conditions are met.

**Trigger Conditions:**

- Time-based: NFT has been held for required duration
- Activity-based: User has completed required actions/achievements
- Level-based: NFT has reached experience threshold
- Event-based: Special event or milestone reached

**Automation Flow:**

1. Automation service monitors NFT evolution conditions
2. When conditions met for an NFT
3. Service validates eligibility and requirements
4. Service calls Gateway with evolution parameters
5. Gateway invokes `Evolve()` with new level
6. `NFTEvolved` event emitted
7. Off-chain service updates NFT metadata

**Benefits:**

- Automatic evolution without manual triggering
- Timely evolution when conditions met
- Enhanced user experience
- Consistent evolution mechanics

**Configuration:**

- Check interval: Every 5 minutes
- Batch processing: Up to 40 NFTs per batch
- Evolution cooldown: Configurable per NFT type
- Max level: Configurable per collection

## Usage Flow

### Initial Setup

1. Deploy the contract (admin is set to deployer)
2. Admin calls `SetGateway()` to configure the ServiceLayerGateway
3. Admin calls `SetPaymentHub()` to configure payment processing
4. Gateway registers this contract as a valid MiniApp

### NFT Evolution Flow

1. User owns an NFT and wants to evolve it
2. User submits evolution request via frontend (provides tokenId)
3. Frontend sends request to ServiceLayerGateway
4. Gateway validates ownership and evolution requirements
5. Gateway calls `Evolve()` with new level
6. Contract emits `NFTEvolved` event
7. Off-chain services monitor event and update NFT metadata
8. Results are sent back via `OnServiceCallback()`
9. Frontend displays evolved NFT with new attributes

### Example Evolution Scenarios

**Time-Based Evolution**:

- NFT starts at Level 1
- After 30 days of ownership, eligible for Level 2
- After 90 days, eligible for Level 3

**Activity-Based Evolution**:

- Complete 10 platform actions → Level 2
- Complete 50 platform actions → Level 3
- Unlock special achievements → Level 4

**Breeding/Fusion**:

- Combine two Level 2 NFTs → Create one Level 3 NFT
- Requires both NFTs to be owned by same user

### Emergency Procedures

If issues are detected:

1. Admin calls `SetPaused(true)` to halt operations
2. Investigate and resolve issues
3. Admin calls `SetPaused(false)` to resume

## Security Considerations

### Access Control

- Only Gateway can trigger evolution, preventing unauthorized access
- Admin functions require witness verification
- All addresses are validated before storage

### Validation

- Gateway address must be set before evolution operations
- Admin address must be valid for administrative operations
- Contract enforces caller validation on all sensitive methods

### Upgrade Safety

- Contract supports upgrades via `Update()` method
- Only admin can trigger upgrades
- Upgrade preserves storage state

## Integration Points

### ServiceLayerGateway

The Gateway acts as the primary entry point, handling:

- Request validation
- User authentication
- Ownership verification
- Fee collection
- Service routing

### PaymentHub

Manages payment processing for:

- Evolution fees
- Breeding/fusion costs
- Platform fees

### External Services

Evolution services integrate via:

- REST API calls to Gateway
- Evolution logic computation
- Callback mechanism for async results
- Event monitoring for evolution confirmations

### NFT Contract Integration

The evolution contract works alongside NFT contracts:

- NFT ownership is verified off-chain before evolution
- Evolution events trigger metadata updates
- New attributes/visuals are stored in NFT metadata
- Token URI may be updated to reflect new level

## Development Notes

- Contract follows the standard MiniApp pattern
- Uses storage prefixes for organized data management
- Implements defensive programming with assertions
- Events enable off-chain monitoring and analytics
- Evolution logic (requirements, costs) is handled off-chain
- Contract serves as immutable record of evolution events
- Designed for flexibility in evolution mechanics

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
