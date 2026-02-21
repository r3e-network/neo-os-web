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

---

## 中文说明

### 概述

MiniAppAITrader 是一个 AI 驱动的交易机器人智能合约,在 Neo 区块链上实现自动化交易执行。该合约作为 AI 驱动交易策略的链上组件,记录交易执行并通过 ServiceLayerGateway 与外部 AI 服务集成。

### 核心功能

该合约提供了一个安全的、由网关控制的接口,用于执行基于 AI 生成信号的交易。它可以:

- 在链上记录 AI 驱动的交易执行
- 发出事件用于交易跟踪和分析
- 通过回调与外部 AI 服务集成
- 通过 ServiceLayerGateway 强制执行访问控制
- 支持暂停/恢复功能以应对紧急情况

### 使用方法

#### 创建交易策略

交易者通过 `CreateStrategy()` 方法创建 AI 交易策略:

```csharp
CreateStrategy(trader, pair, stake)
```

- 指定交易对(如 "NEO/GAS")
- 设置质押金额(最低 0.1 GAS)
- 策略创建后自动激活

#### 请求价格检查

策略激活后,可以通过 `RequestPriceCheck()` 触发 AI 信号评估:

1. 合约向预言机请求当前价格
2. Gateway 调用价格服务获取数据
3. 价格数据返回后,合约评估 AI 信号
4. 简单动量策略:价格上涨则买入,价格下跌则卖出
5. 发出 `TradeExecuted` 事件
6. 链下系统监听事件并在 DEX 上执行实际交易

#### 停用策略

交易者可以随时通过 `DeactivateStrategy()` 停用策略。

### 参数说明

#### 合约常量

- **APP_ID**: `"miniapp-aitrader"`
- **MIN_STAKE**: `10000000` (0.1 GAS) - 最低质押金额

#### CreateStrategy 参数

- `trader`: 交易者地址
- `pair`: 交易对(如 "NEO/GAS", "GAS/USDT")
- `stake`: 质押金额(最低 0.1 GAS)

#### AI 信号逻辑

合约实现简单的动量策略:

```
如果 lastPrice == 0 或 currentPrice > lastPrice:
    信号 = 买入
否则:
    信号 = 卖出
```

实际的 AI 模型和复杂策略在链下执行,合约仅记录交易信号。

### 事件

- **StrategyCreated**: 创建策略时触发
- **PriceRequested**: 请求价格检查时触发
- **TradeExecuted**: 执行交易时触发(包含交易方向、金额和价格)

### 自动化配置

- 信号置信度阈值: 75%(可配置)
- 检查间隔: 每 10 秒
- 每小时最大交易数: 20(速率限制)
- 批处理: 每批最多 30 笔交易

### 安全考虑

1. **Gateway 专属访问**: 只有 Gateway 可以执行交易
2. **管理员控制**: 关键配置需要管理员签名
3. **暂停机制**: 管理员可以在紧急情况下暂停操作
4. **地址验证**: 所有地址在存储前都会被验证
5. **调用者验证**: 合约对所有敏感方法强制执行调用者验证
