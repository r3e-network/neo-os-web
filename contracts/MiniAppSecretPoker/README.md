# MiniAppSecretPoker

## Overview

MiniAppSecretPoker is a Trusted Execution Environment (TEE) based Texas Hold'em poker game contract that enables secure, fair poker gameplay on the Neo blockchain. The contract leverages off-chain TEE services to ensure card dealing fairness while maintaining game integrity through on-chain settlement.

## What It Does

This contract provides a secure poker gaming platform by:

- Enabling fair Texas Hold'em poker games with TEE-based card dealing
- Processing hand results and payouts through the Gateway service
- Ensuring game integrity through cryptographic verification
- Managing player settlements on-chain while keeping card data private

## How It Works

### Architecture

The contract implements a hybrid on-chain/off-chain architecture:

- **TEE Card Dealing**: Card shuffling and dealing occur in a Trusted Execution Environment
- **Off-Chain Game Logic**: Hand evaluation and game progression handled by TEE services
- **On-Chain Settlement**: Final hand results and payouts are recorded on-chain
- **Gateway Integration**: All service interactions flow through ServiceLayerGateway

### Game Flow

1. **Game Initialization**: Players join a poker table via the MiniApp frontend
2. **TEE Processing**: Off-chain TEE service handles card dealing and game progression
3. **Hand Resolution**: When a hand completes, TEE service calculates winners and payouts
4. **On-Chain Settlement**: Gateway calls `ResolveHand()` to record results and trigger payouts
5. **Event Emission**: `HandResult` event is emitted for frontend updates

### Security Through TEE

The Trusted Execution Environment ensures:

- **Fair Dealing**: Cards are shuffled using cryptographically secure randomness
- **Privacy**: Player cards remain hidden until showdown
- **Tamper-Proof**: Game logic executes in isolated, verified environment
- **Verifiable**: Hand results can be cryptographically verified

## Key Methods

### Public Methods

#### `ResolveHand(UInt160 player, BigInteger payout)`

Records the result of a completed poker hand and triggers payout.

**Parameters:**

- `player`: Address of the player receiving the payout
- `payout`: Amount to be paid to the player (in smallest unit)

**Access Control:** Gateway only

**Behavior:**

- Validates that caller is the authorized Gateway
- Emits `HandResult` event with player address and payout amount
- Triggers payment processing through PaymentHub

**Events Emitted:**

- `HandResult(UInt160 player, BigInteger payout)`

#### `OnServiceCallback(BigInteger r, string a, string s, bool ok, ByteString res, string e)`

Receives callbacks from off-chain TEE services via the Gateway.

**Access Control:** Gateway only

**Purpose:** Handles asynchronous responses from TEE poker service

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

### `HandResult`

```csharp
event HandResultHandler(UInt160 player, BigInteger payout)
```

Emitted when a poker hand is resolved and payout is determined.

**Parameters:**

- `player`: Address of the player receiving the payout
- `payout`: Amount paid to the player

**Use Cases:**

- Frontend updates player balance display
- Analytics tracking for game statistics
- Audit trail for game outcomes

## Automation Support

MiniAppSecretPoker supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Timeout Inactive Games

The automation service automatically times out poker games where players have been inactive beyond the allowed time limit.

**Trigger Conditions:**

- Player has not acted within timeout period (default 5 minutes)
- Game is in active state waiting for player action
- Game has not already been timed out

**Automation Flow:**

1. Automation service monitors player action timestamps
2. When timeout period exceeded
3. Service calls Gateway to timeout inactive player
4. Inactive player automatically folds
5. Game continues with remaining active players
6. `PlayerTimedOut` event emitted (if implemented)

**Benefits:**

- Prevents games from stalling indefinitely
- Maintains game flow and player experience
- Automatic cleanup of abandoned games
- Fair enforcement of time limits

**Configuration:**

- Action timeout: 5 minutes per player turn
- Check interval: Every 30 seconds
- Grace period: 30 seconds warning before timeout
- Batch processing: Up to 50 games per batch

## Usage Flow

### Complete Game Workflow

```
1. Player Joins Table
   User → MiniApp Frontend → TEE Service (via Gateway)

2. Game Progression
   TEE Service → Card Dealing → Hand Evaluation → Winner Determination

3. Hand Settlement
   TEE Service → Gateway → ResolveHand() → HandResult Event → PaymentHub

4. Frontend Update
   HandResult Event → MiniApp Frontend → UI Update
```

### Detailed Hand Resolution

1. **Hand Completion**: All betting rounds complete or players fold
2. **Winner Calculation**: TEE service evaluates hands and determines winner(s)
3. **Payout Calculation**: Service calculates payout amounts based on pot size
4. **Gateway Invocation**: TEE service calls Gateway with settlement data
5. **Contract Execution**: Gateway invokes `ResolveHand(winner, payout)`
6. **Event Emission**: `HandResult` event is emitted
7. **Payment Processing**: PaymentHub transfers funds to winner

## Security Considerations

### TEE Security

- **Isolated Execution**: Game logic runs in hardware-protected environment
- **Attestation**: TEE provides cryptographic proof of correct execution
- **Sealed Data**: Card state is encrypted and sealed within TEE
- **No Manipulation**: Neither players nor operators can manipulate card dealing

### Access Control

- **Gateway Restriction**: Only Gateway can call `ResolveHand()`
- **Admin Protection**: Administrative functions require admin witness
- **Pause Mechanism**: Emergency stop capability for security incidents

### Trust Model

- **TEE Trust**: Players must trust the TEE hardware and attestation
- **Gateway Trust**: Gateway must be trusted to relay TEE results accurately
- **Operator Trust**: Contract admin has emergency pause capability

### Limitations

- Requires functional TEE infrastructure
- Gateway is a centralized trust point
- No on-chain verification of hand outcomes (relies on TEE attestation)

## Integration Requirements

### Prerequisites

1. **TEE Service**: Poker game service running in TEE environment
2. **ServiceLayerGateway**: Deployed and configured to communicate with TEE
3. **PaymentHub**: Deployed for handling player payouts
4. **Attestation Service**: For verifying TEE integrity

### Configuration Steps

1. Deploy MiniAppSecretPoker contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment processing
4. Configure TEE service with contract address and Gateway endpoint
5. Verify TEE attestation and register with Gateway

### TEE Service Requirements

- Must implement Texas Hold'em game logic
- Must generate cryptographically secure random numbers
- Must provide attestation proof of execution
- Must communicate results through Gateway

## Game Rules

### Texas Hold'em Basics

- Each player receives 2 hole cards (private)
- 5 community cards dealt in stages (flop, turn, river)
- Players make best 5-card hand from 7 available cards
- Standard poker hand rankings apply

### Payout Structure

- Winner takes the pot (sum of all bets)
- In case of tie, pot is split equally
- Rake/fees may be deducted by platform

## Contract Metadata

- **Name**: MiniAppSecretPoker
- **Author**: R3E Network
- **Version**: 2.0.0
- **Description**: Secret Poker - TEE Texas Hold'em

---

## 中文说明

### 概述

MiniAppSecretPoker 是基于可信执行环境（TEE）的德州扑克游戏合约，在 Neo 区块链上实现安全、公平的扑克游戏。该合约利用链下 TEE 服务确保发牌公平性，同时通过链上结算维护游戏完整性。

### 核心功能

- **TEE 发牌**: 使用可信执行环境进行公平的洗牌和发牌
- **隐私保护**: 玩家手牌在摊牌前保持隐藏
- **链上结算**: 通过网关服务处理牌局结果和支付
- **防篡改**: 游戏逻辑在隔离的、经过验证的环境中执行
- **自动超时**: 自动化服务处理不活跃玩家的超时弃牌

### 使用方法

#### 游戏流程

1. **加入牌桌**: 玩家通过 MiniApp 前端加入德州扑克牌桌
2. **TEE 处理**: 链下 TEE 服务处理洗牌、发牌和游戏进程
3. **牌局结算**: 牌局完成后，TEE 服务计算赢家和支付金额
4. **链上记录**: 网关调用 `ResolveHand()` 记录结果并触发支付
5. **事件发出**: 发出 `HandResult` 事件用于前端更新

#### 自动化任务

**不活跃游戏自动超时**

- 触发条件: 玩家在超时期限内未行动（默认 5 分钟）
- 自动流程: 监控玩家行动时间戳 → 超时后调用网关 → 不活跃玩家自动弃牌 → 游戏继续
- 检查间隔: 每 30 秒
- 批处理: 每批最多 50 个游戏

### 参数说明

#### ResolveHand 方法

```
ResolveHand(UInt160 player, BigInteger payout)
```

**参数:**

- `player`: 接收支付的玩家地址
- `payout`: 支付给玩家的金额（最小单位）

**访问控制:** 仅网关可调用

**事件:** 发出 `HandResult(UInt160 player, BigInteger payout)` 事件

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

**TEE 安全性:**

- 游戏逻辑在硬件保护的环境中运行
- TEE 提供正确执行的密码学证明
- 牌组状态在 TEE 内加密和密封
- 玩家和运营商都无法操纵发牌

**访问控制:**

- 只有网关可以调用 `ResolveHand()`
- 管理功能需要管理员见证
- 紧急停止机制用于安全事件

**信任模型:**

- 玩家必须信任 TEE 硬件和认证
- 网关必须被信任以准确传递 TEE 结果
- 合约管理员拥有紧急暂停能力

**游戏规则:**

- 每位玩家获得 2 张底牌（私有）
- 5 张公共牌分阶段发出（翻牌、转牌、河牌）
- 玩家从 7 张可用牌中组成最佳 5 张牌
- 赢家获得底池（所有下注总和）
