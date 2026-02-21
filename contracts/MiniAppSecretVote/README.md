# MiniAppSecretVote

## Overview

MiniAppSecretVote is a privacy-preserving voting contract that enables anonymous voting on proposals within the Neo MiniApp Platform. The contract provides a simple yet secure mechanism for casting votes while maintaining voter privacy through off-chain vote processing.

## What It Does

This contract facilitates anonymous voting by:

- Recording vote cast events without storing vote details on-chain
- Delegating vote validation and counting to off-chain services via the Gateway
- Ensuring only authorized voters can cast votes through witness validation
- Maintaining administrative controls for contract governance

## How It Works

### Architecture

The contract follows the standard MiniApp architecture pattern:

- **Gateway Integration**: All service interactions flow through the ServiceLayerGateway
- **Event-Driven**: Emits events that are processed by off-chain services
- **Minimal On-Chain State**: Stores only administrative configuration, not vote data
- **Privacy-First**: Vote details are processed off-chain to preserve anonymity

### Privacy Mechanism

Privacy is achieved through:

1. **Event-Only Recording**: The `CastVote` method emits an event but doesn't store vote choices on-chain
2. **Off-Chain Processing**: Vote tallying and validation occur in trusted off-chain services
3. **Witness Validation**: Only the voter can authorize their vote transaction

## Key Methods

### Public Methods

#### `CastVote(UInt160 voter, string proposalId)`

Casts a vote for a specific proposal.

**Parameters:**

- `voter`: Address of the voter (must provide witness)
- `proposalId`: Unique identifier for the proposal being voted on

**Behavior:**

- Validates that the caller has witness authority for the voter address
- Emits `VoteCast` event with voter address and proposal ID
- Vote details (choice, weight) are handled off-chain

**Events Emitted:**

- `VoteCast(UInt160 voter, string proposalId)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain services via the Gateway.

**Access Control:** Gateway only

### Administrative Methods

#### `SetAdmin(UInt160 a)`

Updates the contract administrator address.

#### `SetGateway(UInt160 g)`

Configures the ServiceLayerGateway address for service integration.

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub contract address for payment processing.

#### `SetPaused(bool paused)`

Enables or disables contract operations.

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

### `VoteCast`

```csharp
event VoteCastHandler(UInt160 voter, string proposalId)
```

Emitted when a vote is cast.

**Parameters:**

- `voter`: Address of the voter
- `proposalId`: Identifier of the proposal voted on

## Automation Support

MiniAppSecretVote supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Tally Votes After Deadline

The automation service automatically tallies votes and finalizes results when voting deadline is reached.

**Trigger Conditions:**

- Voting deadline has passed
- Proposal is in active voting state
- Votes have not been tallied yet

**Automation Flow:**

1. Automation service monitors proposal deadlines
2. When deadline passes
3. Service aggregates all votes from off-chain database
4. Service calls Gateway to finalize results
5. Final tally recorded and proposal status updated
6. `VotingFinalized` event emitted (if implemented)

**Benefits:**

- Immediate result finalization at deadline
- No manual intervention required
- Prevents vote manipulation after deadline
- Ensures timely governance decisions

**Configuration:**

- Check interval: Every 1 minute
- Grace period: 5 minutes after deadline
- Batch processing: Up to 20 proposals per batch

## Usage Flow

### Casting a Vote

1. **User Initiates Vote**: User selects their vote choice in the MiniApp frontend
2. **Transaction Creation**: Frontend creates transaction calling `CastVote(voterAddress, proposalId)`
3. **Witness Validation**: Contract verifies the voter's witness signature
4. **Event Emission**: `VoteCast` event is emitted with voter and proposal ID
5. **Off-Chain Processing**: Gateway service captures event and processes vote details
6. **Vote Recording**: Off-chain service records the vote and updates tallies

### Complete Voting Workflow

```
User → MiniApp Frontend → CastVote() → VoteCast Event → Gateway Service → Vote Database
                                                                ↓
                                                         Tally Updates
```

## Security Considerations

### Access Control

- **Voter Authorization**: Only the voter (via witness) can cast their vote
- **Gateway Restriction**: Service callbacks can only be invoked by the Gateway
- **Admin Protection**: Administrative functions require admin witness

### Privacy Features

- Vote choices are not stored on-chain
- Only voter address and proposal ID are publicly visible
- Actual vote data is processed in off-chain trusted execution environments

### Limitations

- Privacy depends on off-chain service security
- Voter addresses are visible on-chain (not fully anonymous)
- No on-chain vote verification or tallying

## Integration Requirements

### Prerequisites

1. ServiceLayerGateway contract deployed and configured
2. PaymentHub contract deployed (if payment features are used)
3. Off-chain voting service configured to process `VoteCast` events

### Configuration Steps

1. Deploy MiniAppSecretVote contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment features
4. Configure off-chain service to monitor and process voting events

## Contract Metadata

- **Name**: MiniAppSecretVote
- **Author**: R3E Network
- **Version**: 1.0.0
- **Description**: Secret Vote - Privacy-preserving voting

---

## 中文说明

### 概述

MiniAppSecretVote 是一个隐私保护投票合约，在 Neo MiniApp 平台上实现匿名提案投票。该合约通过链下投票处理提供简单而安全的投票机制，同时保护投票者隐私。

### 核心功能

- **隐私投票**: 不在链上存储投票详情，仅记录投票事件
- **见证验证**: 通过见证签名确保只有授权投票者可以投票
- **链下处理**: 投票验证和计票由链下服务通过网关处理
- **自动计票**: 自动化服务在投票截止时间后自动统计票数
- **管理控制**: 提供合约治理的管理功能

### 使用方法

#### 投票流程

1. **发起投票**: 用户在 MiniApp 前端选择投票选项
2. **创建交易**: 前端创建调用 `CastVote(voterAddress, proposalId)` 的交易
3. **见证验证**: 合约验证投票者的见证签名
4. **事件发出**: 发出包含投票者和提案 ID 的 `VoteCast` 事件
5. **链下处理**: 网关服务捕获事件并处理投票详情
6. **记录投票**: 链下服务记录投票并更新统计

#### 自动化任务

**投票截止后自动计票**

- 触发条件: 投票截止时间已过，提案处于活跃投票状态
- 自动流程: 监控截止时间 → 汇总投票 → 调用网关完成结果 → 发出事件
- 检查间隔: 每 1 分钟
- 批处理: 每批最多 20 个提案

### 参数说明

#### CastVote 方法

```
CastVote(UInt160 voter, string proposalId)
```

**参数:**

- `voter`: 投票者地址（必须提供见证）
- `proposalId`: 被投票提案的唯一标识符

**访问控制:** 需要投票者地址的见证权限

**事件:** 发出 `VoteCast(UInt160 voter, string proposalId)` 事件

#### 管理方法

- `SetAdmin(UInt160 a)`: 更新合约管理员地址
- `SetGateway(UInt160 g)`: 配置 ServiceLayerGateway 地址
- `SetPaymentHub(UInt160 hub)`: 设置 PaymentHub 合约地址
- `SetPaused(bool paused)`: 启用或禁用合约操作

#### 查询方法

- `Admin()`: 返回当前管理员地址
- `Gateway()`: 返回配置的网关地址
- `PaymentHub()`: 返回 PaymentHub 合约地址
- `IsPaused()`: 返回合约是否暂停

### 安全考虑

**隐私特性:**

- 投票选择不存储在链上
- 仅投票者地址和提案 ID 公开可见
- 实际投票数据在链下可信执行环境中处理

**访问控制:**

- 只有投票者（通过见证）可以投票
- 服务回调只能由网关调用
- 管理功能需要管理员见证

**限制:**

- 隐私依赖于链下服务安全性
- 投票者地址在链上可见（非完全匿名）
- 无链上投票验证或计票
