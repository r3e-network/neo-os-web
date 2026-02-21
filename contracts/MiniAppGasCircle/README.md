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

---

## 中文说明

### 概述

MiniAppGasCircle 是一个每日储蓄互助圈（ROSCA - 轮流储蓄和信贷协会）合约，使群组能够汇集 GAS 代币进行集体储蓄和借贷。该合约在区块链上实现传统储蓄互助圈机制，为基于社区的金融合作提供透明性和自动化。

### 核心功能

- **定期存款**: 成员定期向共享资金池存款
- **轮流支付**: 管理成员的轮流支付计划
- **透明追踪**: 透明追踪存款和分配
- **自动化运营**: 通过智能合约逻辑自动化互助圈运营
- **公平参与**: 通过链上执行确保公平参与

### 使用方法

#### 储蓄互助圈机制

传统储蓄互助圈的运作方式：

1. **组建**: N 个成员同意每期贡献 X 金额
2. **存款**: 每个成员定期存入 X 金额（每日/每周/每月）
3. **轮流**: 每期一个成员获得全部资金池（N × X）
4. **完成**: N 期后，所有成员都已获得支付
5. **优势**: 无需利息即可获得大额资金

#### 使用流程

**互助圈组建:**

1. 群组成员商定条款（金额、周期、轮流顺序）
2. 组织者在 MiniApp 前端创建互助圈
3. 成员加入互助圈并承诺存款计划
4. 建立轮流顺序（随机或预定）

**存款周期:**

1. 存款期开始（例如每日午夜）
2. 成员收到存款提醒
3. 成员调用 `MakeDeposit()` 存入约定金额
4. 合约发出 `Deposit` 事件
5. 链下服务追踪存款和成员状态

**支付周期:**

1. 服务根据轮流计划确定下一个接收者
2. 服务计算存款总额
3. PaymentHub 将资金池金额转给接收者
4. 接收者获得一次性支付
5. 互助圈进入下一轮

#### 自动化任务

**自动处理互助圈支付**

- 触发条件: 存款期已开始，支付期已到达，所有成员已存款
- 自动流程: 监控互助圈计划 → 发送提醒 → 计算资金池 → 处理支付 → 发出事件
- 检查间隔: 每 1 小时
- 批处理: 每批最多 20 个互助圈

### 参数说明

#### MakeDeposit 方法

```
MakeDeposit(UInt160 member, BigInteger amount)
```

**参数:**

- `member`: 进行存款的成员地址
- `amount`: 存入的 GAS 金额

**访问控制:** 需要成员地址的见证权限

**事件:** 发出 `Deposit(UInt160 member, BigInteger amount)` 事件

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

### 使用场景

#### 社区储蓄

- 邻里储蓄小组
- 家庭金融合作
- 朋友圈大额购买
- 社区发展基金

#### 商业应用

- 员工储蓄计划
- 供应商支付圈
- 商业合作融资
- 创业资本形成

#### 社会金融

- 小额信贷替代方案
- 无银行账户者的金融包容
- 点对点借贷圈
- 社区投资池

### 互助圈示例

**每日储蓄圈:**

```
成员: 10 人
存款: 每天 1 GAS
周期: 10 天
支付: 每天 10 GAS（轮流）

第 1 天: 所有人存 1 GAS → 成员 A 获得 10 GAS
第 2 天: 所有人存 1 GAS → 成员 B 获得 10 GAS
...
第 10 天: 所有人存 1 GAS → 成员 J 获得 10 GAS
```

**每周储蓄圈:**

```
成员: 5 人
存款: 每周 10 GAS
周期: 5 周
支付: 每周 50 GAS（轮流）

第 1 周: 所有人存 10 GAS → 成员 A 获得 50 GAS
第 2 周: 所有人存 10 GAS → 成员 B 获得 50 GAS
...
第 5 周: 所有人存 10 GAS → 成员 E 获得 50 GAS
```

### 安全考虑

**访问控制:**

- 只有成员（通过见证）可以存款
- 服务回调只能由网关调用
- 管理功能需要管理员见证

**互助圈完整性:**

- 所有存款通过事件记录在链上
- 所有贡献的公开验证
- 不可变的存款历史记录
- 链下服务强制执行轮流计划

**风险因素:**

- 违约风险: 成员可能无法存款
- 时间风险: 早期接收者比后期接收者受益更多
- 协调风险: 需要所有成员积极参与
- 服务风险: 依赖链下服务可用性

**区块链优势:**

- 透明性: 所有存款和支付公开可验证
- 自动化: 智能合约无需中介即可执行规则
- 信任: 无需中央协调员或财务主管
- 不可变性: 记录无法被更改或争议
