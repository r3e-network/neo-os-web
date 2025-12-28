# MiniAppFlashLoan

## Overview

MiniAppFlashLoan is a flash loan service contract that enables users to borrow assets instantly without collateral, provided they repay the loan plus a fee within the same transaction. This is a fundamental DeFi primitive used for arbitrage, liquidations, and other advanced trading strategies.

## What It Does

The contract provides uncollateralized instant loans with the following characteristics:

- **Instant Borrowing**: Users can borrow any available amount without upfront collateral
- **Same-Transaction Repayment**: Loans must be repaid within the same transaction execution
- **Fee-Based Model**: Charges a 0.09% fee (9 basis points) on borrowed amounts
- **Gateway-Controlled**: All loan executions are managed through the ServiceLayerGateway

## How It Works

### Architecture

The contract follows the standard MiniApp architecture with:

1. **Admin Management**: Controls contract configuration and upgrades
2. **Gateway Integration**: All operations route through ServiceLayerGateway
3. **PaymentHub Integration**: Handles token transfers and fee collection
4. **Pause Mechanism**: Emergency stop functionality

### Fee Calculation

```csharp
BigInteger fee = amount * 9 / 10000;  // 0.09% fee
```

For example:

- Borrow 10,000 tokens → Fee = 9 tokens
- Borrow 100,000 tokens → Fee = 90 tokens

### Execution Flow

1. User initiates flash loan request through frontend
2. Request routes through ServiceLayerGateway
3. Contract validates user authorization
4. `ExecuteLoan()` method calculates fee and emits event
5. External systems (off-chain or other contracts) handle actual token transfer
6. Loan must be repaid with fee in same transaction
7. `LoanExecuted` event notifies listeners of loan details

## Key Methods

### Public Methods

#### `ExecuteLoan(UInt160 borrower, BigInteger amount)`

Executes a flash loan for the specified borrower.

**Parameters:**

- `borrower`: Address of the user requesting the loan
- `amount`: Amount to borrow

**Requirements:**

- Caller must have valid witness (signature)
- Contract must not be paused

**Emits:** `LoanExecuted(borrower, amount, fee)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Callback handler for external service responses.

**Requirements:**

- Can only be called by ServiceLayerGateway

### Admin Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

#### `SetGateway(UInt160 g)`

Sets the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address for token operations.

#### `SetPaused(bool paused)`

Enables or disables contract operations (emergency stop).

#### `Update(ByteString nef, string manifest)`

Upgrades the contract to a new version.

### View Methods

#### `Admin() → UInt160`

Returns the current administrator address.

#### `Gateway() → UInt160`

Returns the ServiceLayerGateway contract address.

#### `PaymentHub() → UInt160`

Returns the PaymentHub contract address.

#### `IsPaused() → bool`

Returns whether the contract is currently paused.

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
- **Business Logic**: Auto-liquidate defaulted loans

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Events

### `LoanExecuted`

```csharp
event LoanExecuted(UInt160 borrower, BigInteger amount, BigInteger fee)
```

Emitted when a flash loan is executed.

**Parameters:**

- `borrower`: Address that received the loan
- `amount`: Loan amount
- `fee`: Fee charged (0.09% of amount)

## Usage Flow

### For Users

1. **Prepare Transaction**: Construct a transaction that:
   - Borrows tokens via `ExecuteLoan()`
   - Uses borrowed tokens for intended purpose (arbitrage, liquidation, etc.)
   - Repays loan amount + fee

2. **Execute Through Gateway**: Submit transaction through ServiceLayerGateway

3. **Monitor Events**: Listen for `LoanExecuted` event to confirm execution

### For Developers

```javascript
// Example: Flash loan for arbitrage
const borrowAmount = 100000;
const expectedFee = (borrowAmount * 9) / 10000; // 90 tokens

// 1. Call ExecuteLoan
await contract.executeLoan(userAddress, borrowAmount);

// 2. Use borrowed funds for arbitrage
// ... perform trades ...

// 3. Repay loan + fee (must happen in same transaction)
await repayLoan(borrowAmount + expectedFee);
```

## Security Considerations

1. **Authorization**: Only authorized users with valid signatures can execute loans
2. **Gateway Control**: All operations must go through the trusted ServiceLayerGateway
3. **Pause Mechanism**: Admin can pause contract in emergency situations
4. **Atomic Execution**: Loans must be repaid in the same transaction (enforced by blockchain)

## Integration Requirements

Before using this contract:

1. Admin must call `SetGateway()` to configure ServiceLayerGateway
2. Admin must call `SetPaymentHub()` to configure PaymentHub
3. Contract must have sufficient liquidity for loans
4. Users must interact through ServiceLayerGateway, not directly

## Contract Information

- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Flash Loan - Instant borrow and repay
- **Permissions**: Full contract permissions (`*`, `*`)
