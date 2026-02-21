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

## 中文说明

### 概述

MiniAppILGuard 是一个无常损失(IL)保护合约,为流动性提供者在AMM池中因价格偏离而产生的损失提供补偿。它帮助降低DeFi中提供流动性的主要风险之一。

### 核心功能

- **无常损失补偿**: 自动补偿流动性提供者的无常损失
- **价格监控**: 通过预言机持续监控LP仓位的价格变化
- **阈值触发**: 当IL超过5%时触发补偿机制
- **最大补偿**: 最高补偿50%的损失
- **自动化保护**: 支持周期性自动检查和触发保护

### 使用方法

#### 创建保护仓位

```csharp
CreatePosition(provider, pair, amount, initialPriceRatio)
```

**参数:**

- `provider`: 流动性提供者地址
- `pair`: 交易对(例如 "NEO/GAS")
- `amount`: 仓位金额(最小1 GAS)
- `initialPriceRatio`: 初始价格比率(token0/token1 × 1e8)

#### 请求监控检查

```csharp
RequestMonitor(positionId)
```

流动性提供者或管理员可请求检查仓位的无常损失状态。

#### 关闭仓位

```csharp
ClosePosition(positionId)
```

提取剩余抵押品并关闭保护仓位。

### 参数说明

**合约常量:**

- `MIN_POSITION`: 100000000 (1 GAS) - 最小仓位金额
- `IL_THRESHOLD_PERCENT`: 5 (5%) - 触发补偿的IL阈值
- `MAX_COMPENSATION_PERCENT`: 50 (50%) - 最大补偿比例

**无常损失计算:**

```
IL% ≈ (|初始价格比率 - 当前价格比率| / 初始价格比率) × 25
```

当IL% ≥ 5%时触发补偿:

```
补偿金额 = 仓位金额 × min(IL%, 50%) / 100
```

### 自动化支持

合约支持通过AutomationAnchor进行周期性自动化:

- **触发类型**: `interval` 或 `cron`
- **调度配置**: 例如 `hourly`、`daily` 或 cron表达式
- **业务逻辑**: 自动检查活跃仓位并触发IL保护

### 集成要求

使用此合约前:

1. 管理员必须调用 `SetGateway()` 配置ServiceLayerGateway
2. 管理员必须调用 `SetAutomationAnchor()` 配置自动化锚点
3. 预言机系统必须配置好池子仓位监控
4. IL计算逻辑必须在链下实现
5. 补偿资金池必须有充足的资金
