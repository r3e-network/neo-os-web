# MiniAppSecretVote

## Overview

MiniAppSecretVote is a privacy-preserving voting contract that enables anonymous voting on proposals within the Neo MiniApp Platform. The contract provides a simple yet secure mechanism for casting votes while maintaining voter privacy through off-chain vote processing.

## What It Does

This contract facilitates anonymous voting by:

- Recording vote cast events without storing vote details on-chain
- Delegating vote validation and counting to off-chain services via the Gateway
- Ensuring only authorized voters can cast votes through witness validation
- Maintaining administrative controls for contract governance

## How It Works

### Architecture

The contract follows the standard MiniApp architecture pattern:

- **Gateway Integration**: All service interactions flow through the ServiceLayerGateway
- **Event-Driven**: Emits events that are processed by off-chain services
- **Minimal On-Chain State**: Stores only administrative configuration, not vote data
- **Privacy-First**: Vote details are processed off-chain to preserve anonymity

### Privacy Mechanism

Privacy is achieved through:

1. **Event-Only Recording**: The `CastVote` method emits an event but doesn't store vote choices on-chain
2. **Off-Chain Processing**: Vote tallying and validation occur in trusted off-chain services
3. **Witness Validation**: Only the voter can authorize their vote transaction

## Key Methods

### Public Methods

#### `CastVote(UInt160 voter, string proposalId)`

Casts a vote for a specific proposal.

**Parameters:**

- `voter`: Address of the voter (must provide witness)
- `proposalId`: Unique identifier for the proposal being voted on

**Behavior:**

- Validates that the caller has witness authority for the voter address
- Emits `VoteCast` event with voter address and proposal ID
- Vote details (choice, weight) are handled off-chain

**Events Emitted:**

- `VoteCast(UInt160 voter, string proposalId)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain services via the Gateway.

**Access Control:** Gateway only

### Administrative Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

#### `SetGateway(UInt160 g)`

Configures the ServiceLayerGateway address for service integration.

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub contract address for payment processing.

#### `SetPaused(bool paused)`

Enables or disables contract operations.

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

### `VoteCast`

```csharp
event VoteCastHandler(UInt160 voter, string proposalId)
```

Emitted when a vote is cast.

**Parameters:**

- `voter`: Address of the voter
- `proposalId`: Identifier of the proposal voted on

## Automation Support

MiniAppSecretVote supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Tally Votes After Deadline

The automation service automatically tallies votes and finalizes results when voting deadline is reached.

**Trigger Conditions:**

- Voting deadline has passed
- Proposal is in active voting state
- Votes have not been tallied yet

**Automation Flow:**

1. Automation service monitors proposal deadlines
2. When deadline passes
3. Service aggregates all votes from off-chain database
4. Service calls Gateway to finalize results
5. Final tally recorded and proposal status updated
6. `VotingFinalized` event emitted (if implemented)

**Benefits:**

- Immediate result finalization at deadline
- No manual intervention required
- Prevents vote manipulation after deadline
- Ensures timely governance decisions

**Configuration:**

- Check interval: Every 1 minute
- Grace period: 5 minutes after deadline
- Batch processing: Up to 20 proposals per batch

## Usage Flow

### Casting a Vote

1. **User Initiates Vote**: User selects their vote choice in the MiniApp frontend
2. **Transaction Creation**: Frontend creates transaction calling `CastVote(voterAddress, proposalId)`
3. **Witness Validation**: Contract verifies the voter's witness signature
4. **Event Emission**: `VoteCast` event is emitted with voter and proposal ID
5. **Off-Chain Processing**: Gateway service captures event and processes vote details
6. **Vote Recording**: Off-chain service records the vote and updates tallies

### Complete Voting Workflow

```
User → MiniApp Frontend → CastVote() → VoteCast Event → Gateway Service → Vote Database
                                                                ↓
                                                         Tally Updates
```

## Security Considerations

### Access Control

- **Voter Authorization**: Only the voter (via witness) can cast their vote
- **Gateway Restriction**: Service callbacks can only be invoked by the Gateway
- **Admin Protection**: Administrative functions require admin witness

### Privacy Features

- Vote choices are not stored on-chain
- Only voter address and proposal ID are publicly visible
- Actual vote data is processed in off-chain trusted execution environments

### Limitations

- Privacy depends on off-chain service security
- Voter addresses are visible on-chain (not fully anonymous)
- No on-chain vote verification or tallying

## Integration Requirements

### Prerequisites

1. ServiceLayerGateway contract deployed and configured
2. PaymentHub contract deployed (if payment features are used)
3. Off-chain voting service configured to process `VoteCast` events

### Configuration Steps

1. Deploy MiniAppSecretVote contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment features
4. Configure off-chain service to monitor and process voting events

## Contract Metadata

- **Name**: MiniAppSecretVote
- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Secret Vote - Privacy-preserving voting
