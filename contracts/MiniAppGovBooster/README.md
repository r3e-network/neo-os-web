# MiniAppGovBooster

## Overview

MiniAppGovBooster is a governance voting power booster contract that allows users to amplify their voting power in governance proposals. This contract integrates with the ServiceLayerGateway to provide enhanced voting capabilities within the Neo MiniApp Platform ecosystem.

## What It Does

The GovBooster contract enables users to boost their voting power on governance proposals by applying a multiplier to their votes. This creates a mechanism for incentivizing participation in governance decisions and allows for weighted voting systems where certain stakeholders can have amplified influence based on predefined criteria.

## How It Works

### Architecture

The contract follows the standard MiniApp architecture pattern:

- **Gateway Integration**: All core operations are triggered through the ServiceLayerGateway
- **Admin Control**: Administrative functions for configuration and upgrades
- **Event-Driven**: Emits events for off-chain tracking and UI updates

### Core Mechanism

1. **Vote Boosting**: The Gateway calls `BoostVote()` with voter address, proposal ID, and multiplier
2. **Event Emission**: The contract emits a `VoteBoosted` event for tracking
3. **Service Callbacks**: Supports async service callbacks from the Gateway

## Key Methods

### Public Methods

#### `BoostVote(UInt160 voter, string proposalId, BigInteger multiplier)`

Applies a voting power multiplier to a user's vote on a specific proposal.

**Parameters:**

- `voter`: Address of the voter receiving the boost
- `proposalId`: Unique identifier of the governance proposal
- `multiplier`: Voting power multiplier to apply

**Access Control:** Gateway only

**Events Emitted:** `VoteBoosted(voter, proposalId, multiplier)`

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

### `VoteBoosted`

```csharp
event VoteBoosted(UInt160 voter, string proposalId, BigInteger multiplier)
```

Emitted when a vote is boosted with a multiplier.

**Parameters:**

- `voter`: Address of the voter
- `proposalId`: Governance proposal identifier
- `multiplier`: Applied voting power multiplier

## Automation Support

MiniAppGovBooster supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Unlock Expired Stakes

The automation service automatically unlocks governance token stakes after the lock period expires.

**Trigger Conditions:**

- Stake lock period has expired
- Stake has not been unlocked yet
- User has active staked balance

**Automation Flow:**

1. Automation service monitors stake expiration times
2. When lock period expires
3. Service calls Gateway to unlock stake
4. Tokens returned to user's available balance
5. Voting power multiplier removed
6. `StakeUnlocked` event emitted (if implemented)

**Benefits:**

- Automatic stake unlocking at expiration
- No manual intervention required
- Improved user experience
- Timely return of staked tokens

**Configuration:**

- Check interval: Every 10 minutes
- Grace period: 1 hour after expiration
- Batch processing: Up to 50 stakes per batch

## Usage Flow

### Standard Voting Boost Flow

1. **Setup Phase**
   - Admin deploys the contract
   - Admin configures Gateway and PaymentHub addresses
   - Contract is registered with the platform

2. **Boost Execution**
   - User initiates a vote boost through the frontend
   - Frontend calls ServiceLayerGateway
   - Gateway validates and calls `BoostVote()`
   - Contract emits `VoteBoosted` event
   - Frontend updates UI based on event

3. **Integration with Governance**
   - Governance contract listens for `VoteBoosted` events
   - Applies multiplier to user's voting power
   - Calculates final vote weight

### Example Integration

```csharp
// Frontend/Gateway initiates boost
var multiplier = 2; // 2x voting power
Contract.Call(govBoosterAddress, "boostVote",
    userAddress,
    "proposal-123",
    multiplier);

// Listen for event
OnVoteBoosted += (voter, proposalId, mult) => {
    // Update governance vote weight
    // voter's vote on proposalId now has mult multiplier
};
```

## Security Considerations

1. **Gateway-Only Access**: Core logic methods can only be called by the configured Gateway
2. **Admin Controls**: Critical configuration changes require admin signature
3. **Pause Mechanism**: Admin can pause operations in emergency situations
4. **Upgrade Safety**: Contract upgrades require admin authorization

## Integration Points

- **ServiceLayerGateway**: Primary integration point for all operations
- **PaymentHub**: Payment processing for boost fees (if applicable)
- **Governance Contract**: Consumes VoteBoosted events to apply multipliers

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure frontend to interact through Gateway

## Version

**Version:** 1.0.0
**Author:** R3E Network
