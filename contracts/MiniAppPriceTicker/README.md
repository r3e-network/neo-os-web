# MiniAppPriceTicker

## Overview

MiniAppPriceTicker is a real-time price feed display contract that provides cryptocurrency and asset price information to users. It serves as a data visualization layer for price oracles and market data feeds within the Neo MiniApp Platform.

## What It Does

The contract provides a standardized interface for displaying real-time price information:

- **Price Feed Display**: Shows current market prices for various assets
- **Oracle Integration**: Receives price data from external oracle services
- **Gateway-Managed**: All data updates route through ServiceLayerGateway
- **Read-Only Interface**: Primarily serves as a data display layer

## How It Works

### Architecture

The contract follows the standard MiniApp architecture with:

1. **Admin Management**: Controls contract configuration and upgrades
2. **Gateway Integration**: Receives price updates through ServiceLayerGateway
3. **PaymentHub Integration**: Handles any fee-based operations
4. **Pause Mechanism**: Emergency stop functionality

### Data Flow

1. External price oracles fetch market data
2. Data is validated and formatted off-chain
3. ServiceLayerGateway receives price update requests
4. Gateway calls `OnServiceCallback()` to deliver price data
5. Frontend applications query and display the price information
6. Users view real-time price feeds in the MiniApp interface

## Key Methods

### Public Methods

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Callback handler for receiving price data from external services.

**Parameters:**

- `r`: Request ID
- `a`: Action identifier
- `s`: Service identifier
- `ok`: Success status
- `res`: Response data (price information)
- `e`: Error message (if any)

**Requirements:**

- Can only be called by ServiceLayerGateway

### Admin Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

#### `SetGateway(UInt160 g)`

Sets the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address.

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
- **Business Logic**: Auto-update price data feeds

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Usage Flow

### For Users

1. **View Price Feeds**: Access the MiniApp frontend to view real-time prices
2. **Monitor Updates**: Price data refreshes automatically from oracle sources
3. **No Direct Interaction**: Users consume data passively (read-only)

### For Developers

```javascript
// Example: Displaying price data in frontend
const priceData = await fetchPriceFromOracle();
// Data is delivered through ServiceLayerGateway
// Frontend queries and displays the information
```

## Integration Requirements

Before using this contract:

1. Admin must call `SetGateway()` to configure ServiceLayerGateway
2. Admin must call `SetPaymentHub()` to configure PaymentHub
3. External price oracle services must be configured to push data
4. Frontend applications must be configured to query price data

## Contract Information

- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Price Ticker - Real-time price feeds
- **Permissions**: Full contract permissions (`*`, `*`)

## 中文说明

### 概述

MiniAppPriceTicker 是一个实时价格信息展示合约,为用户提供加密货币和资产的价格数据。它作为价格预言机和市场数据源的数据可视化层,服务于Neo MiniApp平台。

### 核心功能

- **实时价格更新**: 通过预言机服务获取并存储最新市场价格
- **多币种支持**: 支持任意交易对的价格查询
- **链上价格存储**: 其他合约可直接读取价格数据
- **自动化更新**: 支持周期性自动更新价格数据
- **速率限制**: 防止价格更新过于频繁(最小60秒间隔)

### 使用方法

#### 请求价格更新

```csharp
RequestPriceUpdate(symbol)
```

**参数:**

- `symbol`: 交易对符号(例如 "BTC", "ETH", "NEO")

**流程:**

1. 任何人都可以请求价格更新
2. 合约检查速率限制(距上次更新至少60秒)
3. 向ServiceLayerGateway请求价格数据
4. 预言机服务返回最新价格
5. 合约存储价格和时间戳
6. 触发 `PriceUpdated` 事件

#### 查询价格

```csharp
GetPrice(symbol)  // 返回价格
GetPriceTimestamp(symbol)  // 返回更新时间
```

### 参数说明

**合约常量:**

- `MIN_UPDATE_INTERVAL`: 60000 (60秒) - 最小更新间隔

**数据存储:**

- 价格数据按交易对符号存储
- 每个价格都有对应的时间戳
- 支持历史价格追踪

### 自动化支持

合约支持通过AutomationAnchor进行周期性自动化:

- **触发类型**: `interval` 或 `cron`
- **调度配置**: 例如 `hourly`、`daily` 或 cron表达式
- **业务逻辑**: 自动更新配置的交易对价格数据

### 集成要求

使用此合约前:

1. 管理员必须调用 `SetGateway()` 配置ServiceLayerGateway
2. 管理员必须调用 `SetAutomationAnchor()` 配置自动化锚点
3. 外部价格预言机服务必须配置好数据推送
4. 前端应用需配置好价格数据查询接口
