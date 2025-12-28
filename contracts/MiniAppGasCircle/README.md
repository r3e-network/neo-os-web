# MiniAppGasCircle

## Overview

MiniAppGasCircle is a daily savings circle (ROSCA - Rotating Savings and Credit Association) contract that enables groups to pool GAS tokens for collective savings and lending. The contract implements a traditional savings circle mechanism on the blockchain, providing transparency and automation for community-based financial cooperation.

## What It Does

This contract provides a savings circle platform by:

- Enabling members to make regular deposits to a shared pool
- Managing rotating payout schedules for circle members
- Providing transparent tracking of deposits and distributions
- Automating circle operations through smart contract logic
- Ensuring fair participation through on-chain enforcement

## How It Works

### Architecture

The contract implements a savings circle mechanism:

- **Member Deposits**: Members make regular deposits to the circle
- **Pool Accumulation**: Deposits accumulate in the shared pool
- **Rotating Payouts**: Members receive payouts on a rotating schedule
- **Gateway Integration**: All operations flow through ServiceLayerGateway
- **Event-Driven**: Emits events for deposit tracking and analytics

### Savings Circle Mechanics

Traditional savings circles work as follows:

1. **Formation**: Group of N members agree to contribute X amount per period
2. **Deposits**: Each member deposits X amount regularly (daily/weekly/monthly)
3. **Rotation**: Each period, one member receives the full pool (N \* X)
4. **Completion**: After N periods, all members have received a payout
5. **Benefits**: Provides access to lump sums without interest

### Blockchain Advantages

Using blockchain for savings circles provides:

- **Transparency**: All deposits and payouts are publicly verifiable
- **Automation**: Smart contract enforces rules without intermediaries
- **Trust**: No need for central coordinator or treasurer
- **Immutability**: Records cannot be altered or disputed
- **Accessibility**: Global participation without geographic restrictions

## Key Methods

### Public Methods

#### `MakeDeposit(UInt160 member, BigInteger amount)`

Records a member's deposit to the savings circle.

**Parameters:**

- `member`: Address of the member making the deposit
- `amount`: Amount of GAS being deposited

**Access Control:** Requires witness from member address

**Behavior:**

- Validates that caller has witness authority for the member address
- Emits `Deposit` event with member address and amount
- Deposit tracking and payout logic handled by off-chain service

**Events Emitted:**

- `Deposit(UInt160 member, BigInteger amount)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain services via the Gateway.

**Access Control:** Gateway only

**Purpose:** Handles asynchronous responses from circle management service

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

### `Deposit`

```csharp
event DepositHandler(UInt160 member, BigInteger amount)
```

Emitted when a member makes a deposit to the savings circle.

**Parameters:**

- `member`: Address of the member making the deposit
- `amount`: Amount of GAS deposited

**Use Cases:**

- Track member contribution history
- Calculate total pool size
- Verify member participation
- Analytics and reporting

## Automation Support

MiniAppGasCircle supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Process Circle Payments

The automation service automatically processes savings circle deposits and payouts according to the rotation schedule.

**Trigger Conditions:**

- Deposit period has started
- Payout period has arrived for next recipient
- All members have made required deposits
- Circle is active and not paused

**Automation Flow:**

1. Automation service monitors circle schedules
2. At deposit period start, sends reminders to members
3. At payout period, calculates total pool
4. Service determines next recipient based on rotation
5. Service calls Gateway to process payout
6. PaymentHub transfers pool to recipient
7. `CirclePayout` event emitted (if implemented)

**Benefits:**

- Automatic payout processing on schedule
- No manual coordination required
- Consistent rotation enforcement
- Timely deposit reminders

**Configuration:**

- Check interval: Every 1 hour
- Deposit reminder: 2 hours before deadline
- Payout processing: At scheduled time
- Batch processing: Up to 20 circles per batch

## Usage Flow

### Circle Formation

```
1. Group Formation
   Members → Agree on Terms (amount, period, rotation order)

2. Circle Creation
   Organizer → MiniApp Frontend → Off-Chain Service → Circle Setup

3. Member Registration
   Members → Join Circle → Commit to Deposit Schedule
```

### Deposit Cycle

```
1. Deposit Period Begins
   Service → Notify Members → Deposit Reminder

2. Member Deposits
   Member → MiniApp Frontend → MakeDeposit() → Deposit Event

3. Deposit Tracking
   Deposit Event → Off-Chain Service → Update Member Records
```

### Payout Cycle

```
1. Payout Determination
   Service → Check Rotation Schedule → Determine Recipient

2. Pool Calculation
   Service → Sum All Deposits → Calculate Payout Amount

3. Payout Execution
   Service → Gateway → PaymentHub → Transfer to Recipient

4. Notification
   Payout Complete → Notify Members → Update Circle Status
```

### Complete Workflow

1. **Formation Phase**
   - Members agree on circle parameters (deposit amount, frequency, duration)
   - Organizer creates circle in MiniApp
   - Members join and commit to participation
   - Rotation order is established (random or predetermined)

2. **Deposit Phase (Repeating)**
   - Deposit period begins (e.g., daily at midnight)
   - Members receive deposit reminders
   - Members call `MakeDeposit()` with agreed amount
   - Contract emits `Deposit` events
   - Off-chain service tracks deposits and member status

3. **Payout Phase (Rotating)**
   - Service determines next recipient based on rotation schedule
   - Service calculates total pool from deposits
   - PaymentHub transfers pool amount to recipient
   - Recipient receives lump sum payout
   - Circle advances to next rotation

4. **Completion Phase**
   - All members have received their payout
   - Circle completes successfully
   - Members can form new circle or exit

## Security Considerations

### Access Control

- **Member Authorization**: Only member (via witness) can make deposits
- **Gateway Restriction**: Service callbacks can only be invoked by Gateway
- **Admin Protection**: Administrative functions require admin witness

### Circle Integrity

- **Deposit Tracking**: All deposits recorded on-chain via events
- **Transparent Records**: Public verification of all contributions
- **Immutable History**: Cannot alter or delete deposit records
- **Fair Rotation**: Rotation schedule enforced by off-chain service

### Trust Model

- **Service Trust**: Off-chain service manages rotation and payouts
- **Gateway Trust**: Gateway must relay accurate deposit information
- **Member Trust**: Members must trust each other to make regular deposits
- **Organizer Trust**: Circle organizer sets initial parameters

### Risk Factors

- **Default Risk**: Members may fail to make deposits
- **Timing Risk**: Early recipients benefit more than late recipients
- **Coordination Risk**: Requires active participation from all members
- **Service Risk**: Depends on off-chain service availability

### Limitations

- No on-chain enforcement of deposit schedules
- No automatic penalties for missed deposits
- Rotation logic handled off-chain
- No dispute resolution mechanism on-chain

## Integration Requirements

### Prerequisites

1. **ServiceLayerGateway**: Deployed and configured
2. **PaymentHub**: Deployed for handling deposits and payouts
3. **Circle Management Service**: Off-chain service for tracking and coordination
4. **Notification Service**: For reminding members of deposit schedules

### Configuration Steps

1. Deploy MiniAppGasCircle contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment processing
4. Configure circle management service with contract address
5. Set up notification system for deposit reminders

### Circle Management Service Requirements

- Must track member deposits and participation
- Must enforce rotation schedule fairly
- Must calculate and execute payouts
- Should handle missed deposits and defaults
- Should provide member notifications and reminders

## Example Circle Scenarios

### Daily Savings Circle

```
Members: 10 people
Deposit: 1 GAS per day
Duration: 10 days
Payout: 10 GAS per day (rotating)

Day 1: All deposit 1 GAS → Member A receives 10 GAS
Day 2: All deposit 1 GAS → Member B receives 10 GAS
...
Day 10: All deposit 1 GAS → Member J receives 10 GAS
```

### Weekly Savings Circle

```
Members: 5 people
Deposit: 10 GAS per week
Duration: 5 weeks
Payout: 50 GAS per week (rotating)

Week 1: All deposit 10 GAS → Member A receives 50 GAS
Week 2: All deposit 10 GAS → Member B receives 50 GAS
...
Week 5: All deposit 10 GAS → Member E receives 50 GAS
```

### Benefits Analysis

**For Early Recipients:**

- Receive lump sum early
- Can invest or use funds immediately
- Effectively receive interest-free loan

**For Late Recipients:**

- Forced savings mechanism
- Guaranteed payout at end
- Build financial discipline

## Use Cases

### Community Savings

- Neighborhood savings groups
- Family financial cooperation
- Friend circles for major purchases
- Community development funds

### Business Applications

- Employee savings programs
- Supplier payment circles
- Business cooperative funding
- Startup capital formation

### Social Finance

- Microfinance alternatives
- Financial inclusion for unbanked
- Peer-to-peer lending circles
- Community investment pools

## Best Practices

### For Circle Organizers

- Screen members for reliability and commitment
- Set realistic deposit amounts members can afford
- Establish clear rotation order upfront
- Communicate rules and expectations clearly
- Monitor participation and address issues promptly

### For Circle Members

- Only join circles you can commit to fully
- Make deposits on time every period
- Understand your position in rotation order
- Communicate if you face deposit difficulties
- Honor commitments to fellow members

### For Platform Operators

- Implement reputation systems for members
- Provide deposit reminders and notifications
- Handle disputes fairly and transparently
- Consider insurance or guarantee mechanisms
- Monitor circle health and intervene if needed

## Contract Metadata

- **Name**: MiniAppGasCircle
- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: GAS Circle - Daily savings circle
