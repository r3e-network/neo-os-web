# MiniAppGuardianPolicy

## Overview

MiniAppGuardianPolicy is a decentralized insurance policy contract that enables users to purchase and claim insurance policies on the Neo MiniApp Platform. It provides a framework for managing insurance claims and payouts in a trustless, blockchain-based environment.

## What It Does

The GuardianPolicy contract manages decentralized insurance policies where users can:

- Purchase insurance coverage for various risks
- Submit claims against their policies
- Receive automated payouts when claims are validated
- Track policy status and claim history

This contract acts as a bridge between traditional insurance concepts and blockchain-based automated execution, enabling transparent and trustless insurance operations.

## How It Works

### Architecture

The contract follows the standard MiniApp architecture:

- **Gateway Integration**: All policy operations are routed through ServiceLayerGateway
- **Event-Driven Claims**: Claims are processed and recorded via blockchain events
- **Admin Oversight**: Administrative controls for configuration and emergency management

### Core Mechanism

1. **Policy Management**: Policies are identified by unique `policyId` strings
2. **Claim Processing**: The Gateway validates claims and triggers `ClaimPolicy()`
3. **Payout Execution**: Contract emits `PolicyClaimed` event with payout details
4. **Service Integration**: Supports async callbacks for external validation services

## Key Methods

### Public Methods

#### `ClaimPolicy(UInt160 holder, ByteString policyId, BigInteger payout)`

Processes an insurance claim and records the payout.

**Parameters:**

- `holder`: Address of the policy holder making the claim
- `policyId`: Unique identifier of the insurance policy
- `payout`: Amount to be paid out to the holder

**Access Control:** Gateway only

**Events Emitted:** `PolicyClaimed(holder, policyId, payout)`

**Usage:** Called by Gateway after validating claim conditions (e.g., oracle data, proof of loss)

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Receives asynchronous callbacks from ServiceLayerGateway services.

**Access Control:** Gateway only

**Usage:** Can be used for oracle-based claim validation or external data verification

### Administrative Methods

#### `SetAdmin(UInt160 newAdmin)`

Transfers admin privileges to a new address.

#### `SetGateway(UInt160 gateway)`

Configures the ServiceLayerGateway contract address.

#### `SetPaymentHub(UInt160 hub)`

Configures the PaymentHub contract address for handling payments.

#### `SetPaused(bool paused)`

Pauses or unpauses contract operations for emergency situations.

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

### `PolicyClaimed`

```csharp
event PolicyClaimed(UInt160 holder, ByteString policyId, BigInteger payout)
```

Emitted when a policy claim is successfully processed.

**Parameters:**

- `holder`: Address of the policy holder
- `policyId`: Unique policy identifier
- `payout`: Payout amount in base units

## Automation Support

MiniAppGuardianPolicy supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Execute Policy Rules

The automation service automatically processes insurance claims when policy conditions are met.

**Trigger Conditions:**

- Policy condition triggered (e.g., oracle reports qualifying event)
- Policy is active and not expired
- Claim has not been processed yet
- Sufficient funds available for payout

**Automation Flow:**

1. Oracle service monitors insured events
2. When qualifying event detected
3. Service validates policy conditions and coverage
4. Service calculates payout amount
5. Service calls Gateway with claim details
6. Gateway invokes `ClaimPolicy()` with payout
7. `PolicyClaimed` event emitted
8. PaymentHub transfers funds to policy holder

**Benefits:**

- Instant claim processing when conditions met
- No manual claim submission required
- Transparent and fair policy execution
- Reduced claim processing time

**Configuration:**

- Oracle check interval: Every 1 minute
- Claim validation timeout: 5 minutes
- Max payout per claim: Configurable per policy
- Batch processing: Up to 30 claims per batch

## Usage Flow

### Standard Insurance Claim Flow

1. **Policy Purchase Phase**
   - User purchases insurance through frontend
   - Policy details stored off-chain or in separate contract
   - Policy ID assigned and linked to user address

2. **Claim Submission**
   - User submits claim through frontend with evidence
   - Frontend calls ServiceLayerGateway
   - Gateway validates claim conditions (may use oracles)

3. **Claim Processing**
   - Gateway calls `ClaimPolicy()` with validated payout amount
   - Contract emits `PolicyClaimed` event
   - PaymentHub processes the actual token transfer

4. **Payout Execution**
   - Off-chain services listen for `PolicyClaimed` event
   - PaymentHub transfers funds to policy holder
   - Frontend updates UI to show claim status

### Example Integration

```csharp
// Gateway validates claim and triggers payout
var policyId = "POLICY-2024-001";
var payoutAmount = 1000_00000000; // 1000 tokens

Contract.Call(guardianPolicyAddress, "claimPolicy",
    holderAddress,
    policyId,
    payoutAmount);

// Listen for claim event
OnPolicyClaimed += (holder, policyId, payout) => {
    // Trigger PaymentHub transfer
    // Update policy status to "claimed"
    // Notify user of successful claim
};
```

### Integration with Oracles

```csharp
// Request oracle data for claim validation
var requestId = Gateway.RequestService(
    "guardian-policy",
    "oracle",
    claimData
);

// OnServiceCallback receives oracle response
OnServiceCallback(requestId, appId, "oracle", true, oracleResult, "") => {
    // Parse oracle result
    // If valid, call ClaimPolicy()
};
```

## Security Considerations

1. **Gateway-Only Access**: Only the configured Gateway can process claims
2. **Admin Controls**: Critical configuration requires admin signature
3. **Pause Mechanism**: Admin can halt operations in emergencies
4. **Event Transparency**: All claims are publicly recorded on-chain
5. **Payout Validation**: Gateway must validate claims before calling contract

## Integration Points

- **ServiceLayerGateway**: Primary entry point for all operations
- **PaymentHub**: Handles actual token transfers for payouts
- **Oracle Services**: External data validation for claim verification
- **Frontend**: User interface for policy management and claims

## Deployment

1. Deploy contract (admin is set to deployer)
2. Call `SetGateway()` with ServiceLayerGateway address
3. Call `SetPaymentHub()` with PaymentHub address
4. Register with AppRegistry
5. Configure oracle services for claim validation
6. Set up frontend for policy management

## Version

**Version:** 1.0.0
**Author:** R3E Network
**Description:** Guardian Policy - Decentralized insurance policies

---

## 中文说明

### 概述

MiniAppGuardianPolicy 是一个去中心化保险策略智能合约,允许用户在 Neo MiniApp 平台上购买和申请保险理赔。它提供了一个在无需信任的区块链环境中管理保险索赔和赔付的框架。

### 核心功能

Guardian Policy 合约管理去中心化保险策略,用户可以:

- 为各种风险购买保险覆盖
- 针对其保单提交理赔申请
- 当理赔通过验证时自动获得赔付
- 跟踪保单状态和理赔历史

该合约充当传统保险概念与基于区块链的自动执行之间的桥梁,实现透明且无需信任的保险操作。

### 使用方法

#### 创建保险策略

用户通过 `CreatePolicy()` 方法创建保险策略:

```csharp
CreatePolicy(holder, assetType, coverage, startPrice, thresholdPercent)
```

- 用户指定资产类型、保额、起始价格和触发阈值
- 系统自动计算保费(保额的 5%)
- 保单有效期为 30 天

#### 申请理赔

当保险条件满足时,持有人可以通过 `RequestClaim()` 提交理赔:

1. 用户提交理赔请求
2. 合约向预言机请求当前价格验证
3. Gateway 验证价格数据
4. 如果价格下跌超过阈值,自动批准理赔
5. 赔付金额与价格下跌幅度成正比(上限为保额)

#### 自动化理赔处理

合约支持通过平台自动化服务进行自动理赔处理:

- 预言机服务监控保险事件
- 当符合条件的事件被检测到时
- 服务验证保单条件和覆盖范围
- 自动触发 `ClaimPolicy()` 进行赔付
- PaymentHub 将资金转账给保单持有人

### 参数说明

#### 合约常量

- **APP_ID**: `"miniapp-guardianpolicy"`
- **MIN_COVERAGE**: `100000000` (1 GAS) - 最低保额
- **PREMIUM_RATE_PERCENT**: `5` - 保费费率为保额的 5%
- **POLICY_DURATION**: `2592000000` (30 天,以毫秒为单位)

#### CreatePolicy 参数

- `holder`: 保单持有人地址
- `assetType`: 资产类型(如 "NEO", "GAS")
- `coverage`: 保额(最低 1 GAS)
- `startPrice`: 起始价格
- `thresholdPercent`: 价格下跌触发阈值(1-50%)

#### 理赔计算逻辑

```
价格下跌百分比 = (起始价格 - 当前价格) × 100 / 起始价格
如果价格下跌 >= 阈值百分比:
    赔付金额 = 保额 × 价格下跌百分比 / 100
    赔付金额上限 = 保额
```

### 事件

- **PolicyCreated**: 创建保单时触发
- **ClaimRequested**: 请求理赔时触发
- **ClaimProcessed**: 理赔处理完成时触发(包含批准状态和赔付金额)

### 自动化配置

- 预言机检查间隔: 每 1 分钟
- 理赔验证超时: 5 分钟
- 每次理赔最大赔付: 根据保单配置
- 批处理: 每批最多 30 个理赔

### 安全考虑

1. **Gateway 专属访问**: 只有配置的 Gateway 可以处理理赔
2. **管理员控制**: 关键配置需要管理员签名
3. **暂停机制**: 管理员可以在紧急情况下暂停操作
4. **事件透明性**: 所有理赔都在链上公开记录
5. **赔付验证**: Gateway 必须在调用合约前验证理赔
