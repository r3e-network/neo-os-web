# MiniAppAITrader

## Overview

MiniAppAITrader is an AI-powered trading bot smart contract that enables automated trading execution on the Neo blockchain. This contract serves as the on-chain component for AI-driven trading strategies, recording trade executions and integrating with external AI services through the ServiceLayerGateway.

## What It Does

The contract provides a secure, gateway-controlled interface for executing trades based on AI-generated signals. It:

- Records AI-driven trade executions on-chain
- Emits events for trade tracking and analytics
- Integrates with external AI services via callbacks
- Enforces access control through the ServiceLayerGateway
- Supports pause/unpause functionality for emergency stops

## Architecture

### Access Control Model

The contract implements a three-tier access control system:

1. **Admin**: Contract owner with full configuration rights
2. **Gateway**: ServiceLayerGateway contract that validates and routes requests
3. **PaymentHub**: Payment processing contract for fee handling

All trading operations must be invoked through the Gateway, ensuring proper validation and authorization.

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
- **Purpose**: Establishes the trusted gateway for trade execution

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

### Core Trading Methods

#### `ExecuteTrade(UInt160 trader, string pair, bool isBuy, BigInteger amount, BigInteger price)`

Records an AI-executed trade on-chain.

- **Access**: Gateway only
- **Parameters**:
  - `trader` - User address executing the trade
  - `pair` - Trading pair (e.g., "NEO/GAS")
  - `isBuy` - true for buy orders, false for sell orders
  - `amount` - Trade amount
  - `price` - Execution price
- **Emits**: `TradeExecuted` event

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Handles callbacks from external AI services.

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

### `TradeExecuted`

Emitted when an AI trade is executed.

**Signature**: `TradeExecuted(UInt160 trader, string pair, bool isBuy, BigInteger amount, BigInteger price)`

**Parameters**:

- `trader` - Address of the trader
- `pair` - Trading pair
- `isBuy` - Order direction (buy/sell)
- `amount` - Trade amount
- `price` - Execution price

## Automation Support

MiniAppAITrader supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Execute AI Trading Signals

The automation service automatically executes trades when AI models generate trading signals.

**Trigger Conditions:**

- AI model generates a trading signal with confidence above threshold
- Market conditions meet execution criteria
- User has sufficient balance for trade
- Trade has not been executed yet

**Automation Flow:**

1. AI service analyzes market data and generates trading signals
2. When signal confidence exceeds threshold
3. Service validates market conditions and user balance
4. Service calls Gateway with trade parameters
5. Gateway invokes `ExecuteTrade()` with trade details
6. `TradeExecuted` event emitted
7. Off-chain systems execute actual trade on DEX

**Benefits:**

- Instant execution of AI-generated signals
- No manual intervention required
- 24/7 automated trading capability
- Consistent execution without emotional bias

**Configuration:**

- Signal confidence threshold: 75% (configurable)
- Check interval: Every 10 seconds
- Max trades per hour: 20 (rate limiting)
- Batch processing: Up to 30 trades per batch

## Usage Flow

### Initial Setup

1. Deploy the contract (admin is set to deployer)
2. Admin calls `SetGateway()` to configure the ServiceLayerGateway
3. Admin calls `SetPaymentHub()` to configure payment processing
4. Gateway registers this contract as a valid MiniApp

### Trade Execution Flow

1. User submits trade request to AI service via frontend
2. AI service analyzes market conditions and generates trading signal
3. AI service sends execution request to ServiceLayerGateway
4. Gateway validates request and calls `ExecuteTrade()`
5. Contract emits `TradeExecuted` event
6. Off-chain systems monitor events and execute actual trades on DEX
7. Results are sent back via `OnServiceCallback()`

### Emergency Procedures

If issues are detected:

1. Admin calls `SetPaused(true)` to halt operations
2. Investigate and resolve issues
3. Admin calls `SetPaused(false)` to resume

## Security Considerations

### Access Control

- Only Gateway can execute trades, preventing unauthorized access
- Admin functions require witness verification
- All addresses are validated before storage

### Validation

- Gateway address must be set before trade execution
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
- Fee collection
- Service routing

### PaymentHub

Manages payment processing for:

- Trading fees
- AI service fees
- Platform fees

### External AI Services

AI services integrate via:

- REST API calls to Gateway
- Callback mechanism for async results
- Event monitoring for trade confirmations

## Development Notes

- Contract follows the standard MiniApp pattern
- Uses storage prefixes for organized data management
- Implements defensive programming with assertions
- Events enable off-chain monitoring and analytics
- Designed for integration with off-chain trading infrastructure

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
