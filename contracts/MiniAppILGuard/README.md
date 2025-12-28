# MiniAppILGuard

## Overview

MiniAppILGuard is an impermanent loss (IL) protection contract that compensates liquidity providers when they experience losses due to price divergence in automated market maker (AMM) pools. It helps mitigate one of the primary risks of providing liquidity in DeFi.

## What It Does

The contract provides impermanent loss protection for liquidity providers:

- **IL Compensation**: Automatically compensates providers for impermanent losses
- **Gateway-Managed**: Compensation calculations handled by ServiceLayerGateway
- **Event-Driven**: Emits compensation events for tracking and transparency
- **Risk Mitigation**: Reduces the financial risk of providing liquidity

## How It Works

### Architecture

The contract follows the standard MiniApp architecture with:

1. **Admin Management**: Controls contract configuration and upgrades
2. **Gateway Integration**: Receives IL calculations through ServiceLayerGateway
3. **PaymentHub Integration**: Handles compensation payouts
4. **Pause Mechanism**: Emergency stop functionality

### Impermanent Loss Explained

Impermanent loss occurs when the price ratio of tokens in a liquidity pool changes compared to when they were deposited. The loss is "impermanent" because it only becomes permanent when liquidity is withdrawn.

**Example:**

- Provider deposits 1 ETH + 2000 USDT (ETH = $2000)
- ETH price rises to $4000
- Pool rebalances to 0.707 ETH + 2828 USDT
- Value if held: $8000
- Value in pool: $5656
- Impermanent Loss: ~29.3%

This contract compensates providers for such losses.

### Protection Flow

1. Liquidity provider deposits tokens into AMM pool
2. Provider enrolls in IL Guard protection program
3. System monitors pool positions and price changes
4. Oracle calculates impermanent loss periodically
5. ServiceLayerGateway calls `Compensate()` when IL exceeds threshold
6. Contract emits `ILCompensated` event
7. Provider receives compensation through PaymentHub

## Key Methods

### Public Methods

#### `Compensate(UInt160 provider, BigInteger compensation)`

Compensates a liquidity provider for impermanent loss.

**Parameters:**

- `provider`: Address of the liquidity provider
- `compensation`: Amount to compensate for IL

**Requirements:**

- Can only be called by ServiceLayerGateway

**Emits:** `ILCompensated(provider, compensation)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Callback handler for external service responses.

**Requirements:**

- Can only be called by ServiceLayerGateway

### Admin Methods

Standard admin methods: `SetAdmin()`, `SetGateway()`, `SetPaymentHub()`, `SetPaused()`, `Update()`

### View Methods

Standard view methods: `Admin()`, `Gateway()`, `PaymentHub()`, `IsPaused()`

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
- **Business Logic**: Auto-check impermanent loss and trigger protection

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Events

### `ILCompensated`

```csharp
event ILCompensated(UInt160 provider, BigInteger compensation)
```

Emitted when a liquidity provider receives IL compensation.

## Usage Flow

### For Liquidity Providers

1. Deposit liquidity into AMM pool
2. Enroll in IL Guard protection
3. System monitors position automatically
4. Receive compensation when IL occurs
5. Continue providing liquidity with reduced risk

### For Developers

```javascript
// Example: IL calculation and compensation
const initialValue = calculateInitialValue(position);
const currentValue = calculateCurrentValue(position);
const holdValue = calculateHoldValue(position);

const impermanentLoss = holdValue - currentValue;

if (impermanentLoss > threshold) {
  // Gateway calls Compensate()
  await contract.compensate(providerAddress, impermanentLoss);
}
```

## Integration Requirements

Before using this contract:

1. Admin must call `SetGateway()` to configure ServiceLayerGateway
2. Admin must call `SetPaymentHub()` to configure PaymentHub
3. Oracle system must be configured to monitor pool positions
4. IL calculation logic must be implemented off-chain
5. Compensation fund must be adequately capitalized

## Security Considerations

1. **Gateway Control**: Only ServiceLayerGateway can trigger compensations
2. **Oracle Accuracy**: IL calculations depend on accurate price feeds
3. **Fund Solvency**: Contract requires sufficient funds for payouts
4. **Pause Mechanism**: Admin can pause in emergency situations

## Contract Information

- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: IL Guard - Impermanent loss protection
- **Permissions**: Full contract permissions (`*`, `*`)
