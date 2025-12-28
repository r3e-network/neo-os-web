# MiniAppGuardianPolicy

## Overview

MiniAppGuardianPolicy is a decentralized insurance policy contract that enables users to purchase and claim insurance policies on the Neo MiniApp Platform. It provides a framework for managing insurance claims and payouts in a trustless, blockchain-based environment.

## What It Does

The GuardianPolicy contract manages decentralized insurance policies where users can:

- Purchase insurance coverage for various risks
- Submit claims against their policies
- Receive automated payouts when claims are validated
- Track policy status and claim history

This contract acts as a bridge between traditional insurance concepts and blockchain-based automated execution, enabling transparent and trustless insurance operations.

## How It Works

### Architecture

The contract follows the standard MiniApp architecture:

- **Gateway Integration**: All policy operations are routed through ServiceLayerGateway
- **Event-Driven Claims**: Claims are processed and recorded via blockchain events
- **Admin Oversight**: Administrative controls for configuration and emergency management

### Core Mechanism

1. **Policy Management**: Policies are identified by unique `policyId` strings
2. **Claim Processing**: The Gateway validates claims and triggers `ClaimPolicy()`
3. **Payout Execution**: Contract emits `PolicyClaimed` event with payout details
4. **Service Integration**: Supports async callbacks for external validation services

## Key Methods

### Public Methods

#### `ClaimPolicy(UInt160 holder, ByteString policyId, BigInteger payout)`

Processes an insurance claim and records the payout.

**Parameters:**

- `holder`: Address of the policy holder making the claim
- `policyId`: Unique identifier of the insurance policy
- `payout`: Amount to be paid out to the holder

**Access Control:** Gateway only

**Events Emitted:** `PolicyClaimed(holder, policyId, payout)`

**Usage:** Called by Gateway after validating claim conditions (e.g., oracle data, proof of loss)

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Receives asynchronous callbacks from ServiceLayerGateway services.

**Access Control:** Gateway only

**Usage:** Can be used for oracle-based claim validation or external data verification

### Administrative Methods

#### `SetAdmin(UInt160 newAdmin)`

Transfers admin privileges to a new address.

#### `SetGateway(UInt160 gateway)`

Configures the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address for handling payments.

#### `SetPaused(bool paused)`

Pauses or unpauses contract operations for emergency situations.

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

### `PolicyClaimed`

```csharp
event PolicyClaimed(UInt160 holder, ByteString policyId, BigInteger payout)
```

Emitted when a policy claim is successfully processed.

**Parameters:**

- `holder`: Address of the policy holder
- `policyId`: Unique policy identifier
- `payout`: Payout amount in base units

## Automation Support

MiniAppGuardianPolicy supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Execute Policy Rules

The automation service automatically processes insurance claims when policy conditions are met.

**Trigger Conditions:**

- Policy condition triggered (e.g., oracle reports qualifying event)
- Policy is active and not expired
- Claim has not been processed yet
- Sufficient funds available for payout

**Automation Flow:**

1. Oracle service monitors insured events
2. When qualifying event detected
3. Service validates policy conditions and coverage
4. Service calculates payout amount
5. Service calls Gateway with claim details
6. Gateway invokes `ClaimPolicy()` with payout
7. `PolicyClaimed` event emitted
8. PaymentHub transfers funds to policy holder

**Benefits:**

- Instant claim processing when conditions met
- No manual claim submission required
- Transparent and fair policy execution
- Reduced claim processing time

**Configuration:**

- Oracle check interval: Every 1 minute
- Claim validation timeout: 5 minutes
- Max payout per claim: Configurable per policy
- Batch processing: Up to 30 claims per batch

## Usage Flow

### Standard Insurance Claim Flow

1. **Policy Purchase Phase**
   - User purchases insurance through frontend
   - Policy details stored off-chain or in separate contract
   - Policy ID assigned and linked to user address

2. **Claim Submission**
   - User submits claim through frontend with evidence
   - Frontend calls ServiceLayerGateway
   - Gateway validates claim conditions (may use oracles)

3. **Claim Processing**
   - Gateway calls `ClaimPolicy()` with validated payout amount
   - Contract emits `PolicyClaimed` event
   - PaymentHub processes the actual token transfer

4. **Payout Execution**
   - Off-chain services listen for `PolicyClaimed` event
   - PaymentHub transfers funds to policy holder
   - Frontend updates UI to show claim status

### Example Integration

```csharp
// Gateway validates claim and triggers payout
var policyId = "POLICY-2024-001";
var payoutAmount = 1000_00000000; // 1000 tokens

Contract.Call(guardianPolicyAddress, "claimPolicy",
    holderAddress,
    policyId,
    payoutAmount);

// Listen for claim event
OnPolicyClaimed += (holder, policyId, payout) => {
    // Trigger PaymentHub transfer
    // Update policy status to "claimed"
    // Notify user of successful claim
};
```

### Integration with Oracles

```csharp
// Request oracle data for claim validation
var requestId = Gateway.RequestService(
    "guardian-policy",
    "oracle",
    claimData
);

// OnServiceCallback receives oracle response
OnServiceCallback(requestId, appId, "oracle", true, oracleResult, "") => {
    // Parse oracle result
    // If valid, call ClaimPolicy()
};
```

## Security Considerations

1. **Gateway-Only Access**: Only the configured Gateway can process claims
2. **Admin Controls**: Critical configuration requires admin signature
3. **Pause Mechanism**: Admin can halt operations in emergencies
4. **Event Transparency**: All claims are publicly recorded on-chain
5. **Payout Validation**: Gateway must validate claims before calling contract

## Integration Points

- **ServiceLayerGateway**: Primary entry point for all operations
- **PaymentHub**: Handles actual token transfers for payouts
- **Oracle Services**: External data validation for claim verification
- **Frontend**: User interface for policy management and claims

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure oracle services for claim validation
6. Set up frontend for policy management

## Version

**Version:** 1.0.0
**Author:** R3E Network
**Description:** Guardian Policy - Decentralized insurance policies
