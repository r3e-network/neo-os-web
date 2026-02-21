# MiniAppGovBooster

## Overview

MiniAppGovBooster is a governance voting power booster contract that allows users to amplify their voting power in governance proposals. This contract integrates with the ServiceLayerGateway to provide enhanced voting capabilities within the Neo MiniApp Platform ecosystem.

## What It Does

The GovBooster contract enables users to boost their voting power on governance proposals by applying a multiplier to their votes. This creates a mechanism for incentivizing participation in governance decisions and allows for weighted voting systems where certain stakeholders can have amplified influence based on predefined criteria.

## How It Works

### Architecture

The contract follows the standard MiniApp architecture pattern:

- **Gateway Integration**: All core operations are triggered through the ServiceLayerGateway
- **Admin Control**: Administrative functions for configuration and upgrades
- **Event-Driven**: Emits events for off-chain tracking and UI updates

### Core Mechanism

1. **Vote Boosting**: The Gateway calls `BoostVote()` with voter address, proposal ID, and multiplier
2. **Event Emission**: The contract emits a `VoteBoosted` event for tracking
3. **Service Callbacks**: Supports async service callbacks from the Gateway

## Key Methods

### Public Methods

#### `BoostVote(UInt160 voter, string proposalId, BigInteger multiplier)`

Applies a voting power multiplier to a user's vote on a specific proposal.

**Parameters:**

- `voter`: Address of the voter receiving the boost
- `proposalId`: Unique identifier of the governance proposal
- `multiplier`: Voting power multiplier to apply

**Access Control:** Gateway only

**Events Emitted:** `VoteBoosted(voter, proposalId, multiplier)`

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Receives asynchronous callbacks from ServiceLayerGateway services.

**Access Control:** Gateway only

### Administrative Methods

#### `SetAdmin(UInt160 newAdmin)`

Transfers admin privileges to a new address.

#### `SetGateway(UInt160 gateway)`

Configures the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address.

#### `SetPaused(bool paused)`

Pauses or unpauses contract operations.

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

### `VoteBoosted`

```csharp
event VoteBoosted(UInt160 voter, string proposalId, BigInteger multiplier)
```

Emitted when a vote is boosted with a multiplier.

**Parameters:**

- `voter`: Address of the voter
- `proposalId`: Governance proposal identifier
- `multiplier`: Applied voting power multiplier

## Automation Support

MiniAppGovBooster supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Unlock Expired Stakes

The automation service automatically unlocks governance token stakes after the lock period expires.

**Trigger Conditions:**

- Stake lock period has expired
- Stake has not been unlocked yet
- User has active staked balance

**Automation Flow:**

1. Automation service monitors stake expiration times
2. When lock period expires
3. Service calls Gateway to unlock stake
4. Tokens returned to user's available balance
5. Voting power multiplier removed
6. `StakeUnlocked` event emitted (if implemented)

**Benefits:**

- Automatic stake unlocking at expiration
- No manual intervention required
- Improved user experience
- Timely return of staked tokens

**Configuration:**

- Check interval: Every 10 minutes
- Grace period: 1 hour after expiration
- Batch processing: Up to 50 stakes per batch

## Usage Flow

### Standard Voting Boost Flow

1. **Setup Phase**
   - Admin deploys the contract
   - Admin configures Gateway and PaymentHub addresses
   - Contract is registered with the platform

2. **Boost Execution**
   - User initiates a vote boost through the frontend
   - Frontend calls ServiceLayerGateway
   - Gateway validates and calls `BoostVote()`
   - Contract emits `VoteBoosted` event
   - Frontend updates UI based on event

3. **Integration with Governance**
   - Governance contract listens for `VoteBoosted` events
   - Applies multiplier to user's voting power
   - Calculates final vote weight

### Example Integration

```csharp
// Frontend/Gateway initiates boost
var multiplier = 2; // 2x voting power
Contract.Call(govBoosterAddress, "boostVote",
    userAddress,
    "proposal-123",
    multiplier);

// Listen for event
OnVoteBoosted += (voter, proposalId, mult) => {
    // Update governance vote weight
    // voter's vote on proposalId now has mult multiplier
};
```

## Security Considerations

1. **Gateway-Only Access**: Core logic methods can only be called by the configured Gateway
2. **Admin Controls**: Critical configuration changes require admin signature
3. **Pause Mechanism**: Admin can pause operations in emergency situations
4. **Upgrade Safety**: Contract upgrades require admin authorization

## Integration Points

- **ServiceLayerGateway**: Primary integration point for all operations
- **PaymentHub**: Payment processing for boost fees (if applicable)
- **Governance Contract**: Consumes VoteBoosted events to apply multipliers

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure frontend to interact through Gateway

## Version

**Version:** 1.0.0
**Author:** R3E Network

## 中文说明

### 概述

MiniAppGovBooster 是一个治理投票权增强合约,允许用户通过质押代币来放大其在治理提案中的投票权重。该合约集成TEE验证机制,确保投票权增强的公平性和安全性。

### 核心功能

- **投票权增强**: 通过质押NEO/GAS获得投票权倍数加成
- **锁定期机制**: 锁定时间越长,获得的倍数越高(1.5x - 3x)
- **TEE验证**: 可信执行环境验证质押状态,防止双重质押
- **自动解锁**: 支持自动化解锁到期的质押
- **提案隔离**: 每个提案只能增强一次投票权

### 使用方法

#### 请求投票权增强

```csharp
RequestBoost(voter, proposalId, stakeAmount, lockDays)
```

**参数:**

- `voter`: 投票人地址
- `proposalId`: 提案ID
- `stakeAmount`: 质押金额(最小1 GAS)
- `lockDays`: 锁定天数(7-365天)

**流程:**

1. 用户质押代币并指定锁定期
2. 合约请求TEE验证质押状态
3. TEE计算投票权倍数
4. 验证通过后应用增强效果

### 参数说明

**合约常量:**

- `MIN_STAKE`: 100000000 (1 GAS) - 最小质押金额
- `BASE_MULTIPLIER`: 100 (1x = 100) - 基础倍数
- `MAX_MULTIPLIER`: 300 (3x = 300) - 最大倍数

**锁定期与倍数关系:**

- 7-30天: 约1.5x倍数
- 31-90天: 约2x倍数
- 91-180天: 约2.5x倍数
- 181-365天: 约3x倍数(最大)

### 自动化支持

合约支持通过AutomationAnchor进行周期性自动化:

- **触发类型**: `interval` 或 `cron`
- **调度配置**: 例如 `hourly`、`daily` 或 cron表达式
- **业务逻辑**: 自动解锁到期的质押并返还代币

### 集成要求

使用此合约前:

1. 管理员必须调用 `SetGateway()` 配置ServiceLayerGateway
2. 管理员必须调用 `SetAutomationAnchor()` 配置自动化锚点
3. TEE服务必须配置好质押验证逻辑
4. 治理合约需监听 `VoteBoosted` 事件应用倍数
