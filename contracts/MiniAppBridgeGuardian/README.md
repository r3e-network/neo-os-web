# MiniAppBridgeGuardian

## Overview

MiniAppBridgeGuardian is a cross-chain bridge guardian smart contract that monitors and records cross-chain asset transfers on the Neo blockchain. This contract serves as the on-chain component for bridge security and validation, recording transfer events and integrating with external bridge services through the ServiceLayerGateway.

## What It Does

The contract provides a secure, gateway-controlled interface for cross-chain bridge operations. It:

- Records cross-chain transfer events on-chain
- Tracks transfers to different target chains
- Emits events for bridge monitoring and analytics
- Integrates with external bridge validators via callbacks
- Enforces access control through the ServiceLayerGateway
- Supports pause/unpause functionality for emergency stops

Bridge guardians are critical security components that validate cross-chain transfers, preventing unauthorized or fraudulent bridge operations.

## Architecture

### Access Control Model

The contract implements a three-tier access control system:

1. **Admin**: Contract owner with full configuration rights
2. **Gateway**: ServiceLayerGateway contract that validates and routes requests
3. **PaymentHub**: Payment processing contract for fee handling

All bridge operations must be invoked through the Gateway, ensuring proper validation and authorization.

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
- **Purpose**: Establishes the trusted gateway for bridge operations

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

### Core Bridge Methods

#### `ProcessBridge(UInt160 user, string targetChain, BigInteger amount, ByteString txHash)`

Records a cross-chain bridge transfer on-chain.

- **Access**: Gateway only
- **Parameters**:
  - `user` - User address initiating the bridge transfer
  - `targetChain` - Target blockchain (e.g., "Ethereum", "BSC", "Polygon")
  - `amount` - Amount being bridged
  - `txHash` - Transaction hash on source or target chain
- **Emits**: `BridgeTransfer` event

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Handles callbacks from external bridge validators.

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

### `BridgeTransfer`

Emitted when a cross-chain bridge transfer is processed.

**Signature**: `BridgeTransfer(UInt160 user, string targetChain, BigInteger amount, ByteString txHash)`

**Parameters**:

- `user` - Address of the user initiating the transfer
- `targetChain` - Target blockchain identifier
- `amount` - Amount being bridged
- `txHash` - Transaction hash reference

## Automation Support

MiniAppBridgeGuardian supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Verify Cross-Chain Transactions

The automation service automatically verifies and processes cross-chain bridge transactions.

**Trigger Conditions:**

- Bridge transfer initiated on source chain
- Transaction confirmed on source chain (minimum confirmations met)
- Transfer has not been verified yet
- Multi-signature threshold not yet reached

**Automation Flow:**

1. Bridge monitoring service detects transfer on source chain
2. Service waits for required confirmations
3. Service validates transaction details and signatures
4. Service calls Gateway with verification data
5. Gateway invokes `ProcessBridge()` with transfer details
6. `BridgeTransfer` event emitted
7. Validators sign multi-sig approval
8. Assets released on target chain

**Benefits:**

- Fast cross-chain transfer processing
- Automatic verification without manual intervention
- Reduced bridge completion time
- Enhanced security through automated checks

**Configuration:**

- Confirmation requirements: 12 blocks (source chain)
- Check interval: Every 30 seconds
- Validator threshold: 2/3 multi-sig
- Batch processing: Up to 20 transfers per batch

## Usage Flow

### Initial Setup

1. Deploy the contract (admin is set to deployer)
2. Admin calls `SetGateway()` to configure the ServiceLayerGateway
3. Admin calls `SetPaymentHub()` to configure payment processing
4. Gateway registers this contract as a valid MiniApp

### Cross-Chain Bridge Flow

1. User initiates bridge transfer via frontend (selects target chain and amount)
2. Frontend sends request to ServiceLayerGateway
3. Gateway validates user balance and bridge parameters
4. Gateway locks user assets (if bridging from Neo)
5. Gateway calls `ProcessBridge()` with transfer details
6. Contract emits `BridgeTransfer` event
7. Off-chain bridge validators monitor event
8. Validators verify transfer and sign multi-sig approval
9. Assets are released on target chain
10. Confirmation sent back via `OnServiceCallback()`

### Emergency Procedures

If security issues are detected:

1. Admin calls `SetPaused(true)` to halt all bridge operations
2. Investigate suspicious transfers
3. Coordinate with bridge validators
4. Admin calls `SetPaused(false)` to resume after resolution

## Security Considerations

### Access Control

- Only Gateway can process bridge transfers, preventing unauthorized access
- Admin functions require witness verification
- All addresses are validated before storage

### Validation

- Gateway address must be set before bridge operations
- Admin address must be valid for administrative operations
- Contract enforces caller validation on all sensitive methods

### Bridge Security

- Multi-signature validation by independent validators
- Transaction hash tracking prevents double-spending
- Pause mechanism for emergency response
- Event-based monitoring for anomaly detection

### Upgrade Safety

- Contract supports upgrades via `Update()` method
- Only admin can trigger upgrades
- Upgrade preserves storage state

## Integration Points

### ServiceLayerGateway

The Gateway acts as the primary entry point, handling:

- Request validation
- User authentication
- Asset locking/unlocking
- Fee collection
- Service routing

### PaymentHub

Manages payment processing for:

- Bridge fees
- Validator rewards
- Platform fees

### External Bridge Validators

Bridge validators integrate via:

- Event monitoring for transfer requests
- Multi-signature validation protocols
- Callback mechanism for confirmations
- Cross-chain transaction verification

## Development Notes

- Contract follows the standard MiniApp pattern
- Uses storage prefixes for organized data management
- Implements defensive programming with assertions
- Events enable off-chain monitoring and analytics
- Bridge validation logic is handled by external validators
- Contract serves as immutable record of bridge events
- Designed for multi-chain bridge support

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root

---

## 中文说明

### 概述

MiniAppBridgeGuardian 是一个跨链桥接守护智能合约,在 Neo 区块链上监控和记录跨链资产转移。该合约作为桥接安全和验证的链上组件,记录转移事件并通过 ServiceLayerGateway 与外部桥接服务集成。

### 核心功能

该合约提供了一个安全的、由网关控制的跨链桥接操作接口。它可以:

- 在链上记录跨链转移事件
- 跟踪到不同目标链的转移
- 发出事件用于桥接监控和分析
- 通过回调与外部桥接验证器集成
- 通过 ServiceLayerGateway 强制执行访问控制
- 支持暂停/恢复功能以应对紧急情况

桥接守护者是关键的安全组件,用于验证跨链转移,防止未经授权或欺诈性的桥接操作。

### 使用方法

#### 发起跨链桥接

用户通过 `InitiateBridge()` 方法发起跨链转移:

```csharp
InitiateBridge(user, targetChain, amount, targetAddress)
```

- 指定目标区块链(如 "Ethereum", "BSC", "Polygon")
- 设置转移金额(最低 1 GAS)
- 提供目标链上的接收地址
- 合约向预言机请求桥接验证

#### 桥接验证流程

1. 用户在前端发起桥接转移请求
2. Gateway 验证用户余额和桥接参数
3. Gateway 锁定用户资产(如果从 Neo 桥接)
4. 合约调用 `InitiateBridge()` 记录转移详情
5. 合约发出 `BridgeInitiated` 和 `VerificationRequested` 事件
6. 链下桥接验证器监听事件
7. 验证器验证转移并签署多签批准
8. 资产在目标链上释放
9. 确认通过 `OnServiceCallback()` 返回

### 参数说明

#### 合约常量

- **APP_ID**: `"miniapp-bridgeguardian"`
- **MIN_BRIDGE_AMOUNT**: `100000000` (1 GAS) - 最低桥接金额

#### InitiateBridge 参数

- `user`: 用户地址
- `targetChain`: 目标区块链名称(如 "Ethereum", "BSC", "Polygon")
- `amount`: 桥接金额(最低 1 GAS)
- `targetAddress`: 目标链上的接收地址

### 事件

- **BridgeInitiated**: 发起桥接时触发
- **VerificationRequested**: 请求验证时触发
- **BridgeCompleted**: 桥接完成时触发(包含成功状态)

### 自动化配置

- 确认要求: 源链 12 个区块确认
- 检查间隔: 每 30 秒
- 验证器阈值: 2/3 多签
- 批处理: 每批最多 20 个转移

### 安全考虑

1. **Gateway 专属访问**: 只有 Gateway 可以处理桥接转移
2. **管理员控制**: 关键配置需要管理员签名
3. **暂停机制**: 管理员可以在紧急情况下暂停所有桥接操作
4. **多签验证**: 独立验证器进行多签验证
5. **交易哈希跟踪**: 防止双花攻击
6. **事件监控**: 基于事件的异常检测
