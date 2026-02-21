# MiniAppGridBot

## Overview

MiniAppGridBot is a grid trading automation smart contract that enables automated buy and sell orders at predefined price levels. This contract serves as the on-chain component for grid trading strategies, recording order executions and integrating with external trading services through the ServiceLayerGateway.

## What It Does

The contract provides a secure, gateway-controlled interface for executing grid trading strategies. It:

- Records grid order fills on-chain
- Emits events for order tracking and analytics
- Integrates with external trading services via callbacks
- Enforces access control through the ServiceLayerGateway
- Supports pause/unpause functionality for emergency stops

Grid trading is a strategy that places buy and sell orders at regular intervals (grid levels) around a set price, profiting from market volatility.

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
- **Purpose**: Establishes the trusted gateway for order execution

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

#### `FillGridOrder(UInt160 trader, BigInteger gridLevel, bool isBuy, BigInteger amount)`

Records a grid order fill on-chain.

- **Access**: Gateway only
- **Parameters**:
  - `trader` - User address executing the order
  - `gridLevel` - Grid level identifier (e.g., level 0 = base price, level 1 = +1 grid step)
  - `isBuy` - true for buy orders, false for sell orders
  - `amount` - Order amount filled
- **Emits**: `GridOrderFilled` event

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Handles callbacks from external trading services.

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

### `GridOrderFilled`

Emitted when a grid order is filled.

**Signature**: `GridOrderFilled(UInt160 trader, BigInteger gridLevel, bool isBuy, BigInteger amount)`

**Parameters**:

- `trader` - Address of the trader
- `gridLevel` - Grid level where order was filled
- `isBuy` - Order direction (buy/sell)
- `amount` - Amount filled

## Automation Support

MiniAppGridBot supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Execute Grid Trading Orders

The automation service automatically executes buy and sell orders when price crosses grid levels.

**Trigger Conditions:**

- Market price crosses a predefined grid level
- Grid bot is active and not paused
- User has sufficient balance for order
- Grid level has not been filled yet

**Automation Flow:**

1. Price monitoring service tracks market prices
2. When price crosses grid level threshold
3. Service determines order type (buy/sell) based on grid level
4. Service calls Gateway with order details
5. Gateway invokes `FillGridOrder()` with execution data
6. `GridOrderFilled` event emitted
7. Off-chain systems execute actual trade on DEX

**Benefits:**

- Automatic profit capture from price volatility
- 24/7 trading without manual monitoring
- Consistent execution at predefined levels
- Disciplined trading strategy enforcement

**Configuration:**

- Price check interval: Every 5 seconds
- Grid level tolerance: 0.1% (slippage)
- Max orders per day: 100 (rate limiting)
- Batch processing: Up to 50 orders per batch

## Usage Flow

### Initial Setup

1. Deploy the contract (admin is set to deployer)
2. Admin calls `SetGateway()` to configure the ServiceLayerGateway
3. Admin calls `SetPaymentHub()` to configure payment processing
4. Gateway registers this contract as a valid MiniApp

### Grid Trading Flow

1. User configures grid strategy via frontend (price range, grid levels, order size)
2. User submits grid bot activation request to ServiceLayerGateway
3. Off-chain service monitors market prices
4. When price crosses a grid level:
   - Service sends execution request to Gateway
   - Gateway validates request and calls `FillGridOrder()`
   - Contract emits `GridOrderFilled` event
5. Off-chain systems monitor events and execute actual trades on DEX
6. Results are sent back via `OnServiceCallback()`
7. Process repeats as price moves through grid levels

### Example Grid Strategy

```
Price Range: 10-20 GAS
Grid Levels: 5
Grid Step: 2 GAS

Level 4: Sell at 18 GAS
Level 3: Sell at 16 GAS
Level 2: Base at 14 GAS (neutral)
Level 1: Buy at 12 GAS
Level 0: Buy at 10 GAS
```

As price moves up, sell orders execute. As price moves down, buy orders execute.

### Emergency Procedures

If issues are detected:

1. Admin calls `SetPaused(true)` to halt operations
2. Investigate and resolve issues
3. Admin calls `SetPaused(false)` to resume

## Security Considerations

### Access Control

- Only Gateway can fill orders, preventing unauthorized access
- Admin functions require witness verification
- All addresses are validated before storage

### Validation

- Gateway address must be set before order execution
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
- Grid bot service fees
- Platform fees

### External Trading Services

Trading services integrate via:

- REST API calls to Gateway
- Price monitoring and order triggering
- Callback mechanism for async results
- Event monitoring for order confirmations

## Development Notes

- Contract follows the standard MiniApp pattern
- Uses storage prefixes for organized data management
- Implements defensive programming with assertions
- Events enable off-chain monitoring and analytics
- Designed for integration with off-chain trading infrastructure
- Grid levels are abstract identifiers; actual price calculations happen off-chain

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root

---

## 中文说明

### 概述

MiniAppGridBot 是一个网格交易自动化智能合约,可在预定义的价格水平上实现自动买卖订单。该合约作为网格交易策略的链上组件,记录订单执行并通过 ServiceLayerGateway 与外部交易服务集成。

### 核心功能

该合约提供了一个安全的、由网关控制的网格交易策略接口。它可以:

- 在链上记录网格订单成交
- 发出事件用于订单跟踪和分析
- 通过回调与外部交易服务集成
- 通过 ServiceLayerGateway 强制执行访问控制
- 支持暂停/恢复功能以应对紧急情况

网格交易是一种在设定价格周围以固定间隔(网格水平)放置买卖订单的策略,从市场波动中获利。

### 使用方法

#### 创建网格

交易者通过 `CreateGrid()` 方法创建网格交易策略:

```csharp
CreateGrid(trader, pair, stake, lowPrice, highPrice, gridLevels)
```

- 指定交易对(如 "NEO/GAS")
- 设置价格范围(最低价和最高价)
- 定义网格层数(2-20 层)
- 质押金额(最低 0.1 GAS)
- 网格从中间层开始

#### 请求价格检查

通过 `RequestPriceCheck()` 触发网格订单评估:

1. 合约向预言机请求当前价格
2. Gateway 返回价格数据
3. 合约计算当前价格对应的网格层
4. 如果层级变化,触发买入或卖出订单
5. 价格下跌时买入,价格上涨时卖出

#### 停用网格

交易者可以通过 `DeactivateGrid()` 停用网格策略。

### 参数说明

#### 合约常量

- **APP_ID**: `"miniapp-gridbot"`
- **MIN_STAKE**: `10000000` (0.1 GAS) - 最低质押金额
- **MAX_GRID_LEVELS**: `20` - 最大网格层数

#### CreateGrid 参数

- `trader`: 交易者地址
- `pair`: 交易对(如 "NEO/GAS")
- `stake`: 质押金额(最低 0.1 GAS)
- `lowPrice`: 网格最低价格
- `highPrice`: 网格最高价格
- `gridLevels`: 网格层数(2-20)

#### 网格层级计算逻辑

```
价格步长 = (最高价 - 最低价) / 网格层数
当前层级 = (当前价格 - 最低价) / 价格步长
如果层级变化:
    如果新层级 < 旧层级: 买入(价格下跌)
    如果新层级 > 旧层级: 卖出(价格上涨)
    交易金额 = 质押金额 / 网格层数
```

### 事件

- **GridCreated**: 创建网格时触发
- **PriceRequested**: 请求价格检查时触发
- **GridOrderFilled**: 网格订单成交时触发(包含层级、方向和金额)

### 自动化配置

- 价格检查间隔: 每 5 秒
- 网格层级容差: 0.1%(滑点)
- 每天最大订单数: 100(速率限制)
- 批处理: 每批最多 50 个订单

### 安全考虑

1. **Gateway 专属访问**: 只有 Gateway 可以填充订单
2. **管理员控制**: 关键配置需要管理员签名
3. **暂停机制**: 管理员可以在紧急情况下暂停操作
4. **地址验证**: 所有地址在存储前都会被验证
5. **调用者验证**: 合约对所有敏感方法强制执行调用者验证
