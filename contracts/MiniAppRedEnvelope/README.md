# MiniAppRedEnvelope

## Overview

MiniAppRedEnvelope is a WeChat-style red packet (hongbao) contract that enables users to create and distribute random GAS red envelopes on the Neo blockchain. The contract implements the popular Chinese tradition of giving red packets with a gamified twist - random distribution amounts and a "best luck" winner feature.

## What It Does

This contract provides a red envelope distribution platform by:

- Creating red envelopes with random packet distribution
- Managing WeChat-style random claiming mechanics
- Tracking the "best luck" winner (largest packet claimed)
- Preventing double-claiming and ensuring fair distribution
- Emitting events for envelope lifecycle (created, claimed, completed)

## How It Works

### Architecture

The contract implements a complete red envelope lifecycle:

- **Creation**: Creator deposits total amount divided into N packets
- **Random Distribution**: Each claim receives a random amount from remaining pool
- **Best Luck Tracking**: Contract tracks who claimed the largest packet
- **Completion**: When all packets claimed, best luck winner is announced
- **Gateway Integration**: All operations flow through ServiceLayerGateway

### WeChat-Style Random Algorithm

The random distribution follows WeChat's red envelope algorithm:

1. Each packet gets a random amount from remaining balance
2. Minimum amount ensures all packets have value
3. Last packet receives all remaining balance
4. Creates excitement as amounts vary significantly
5. "Best luck" winner gets recognition (and potentially bonus rewards)

### Storage Structure

Each envelope stores:

- **Creator Address** (20 bytes): Who created the envelope
- **Total Amount** (32 bytes): Original total GAS amount
- **Packet Count** (32 bytes): Total number of packets
- **Remaining** (32 bytes): Number of unclaimed packets
- **Best Luck Address** (20 bytes): Address of best luck winner
- **Best Luck Amount** (32 bytes): Largest packet amount claimed

## Key Methods

### Public Methods

#### `CreateEnvelope(string envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount)`

Creates a new red envelope with specified parameters.

**Parameters:**

- `envelopeId`: Unique identifier for the envelope
- `creator`: Address of the envelope creator
- `totalAmount`: Total GAS amount to distribute
- `packetCount`: Number of packets (max 100)

**Access Control:** Gateway only

**Validations:**

- Total amount must be greater than 0
- Packet count must be between 1 and 100
- Envelope ID must not already exist

**Behavior:**

- Stores envelope data in contract storage
- Initializes remaining packets to packet count
- Sets best luck winner to zero address initially
- Emits `EnvelopeCreated` event

**Events Emitted:**

- `EnvelopeCreated(string envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount)`

#### `Claim(string envelopeId, UInt160 claimer, BigInteger amount)`

Claims a packet from a red envelope.

**Parameters:**

- `envelopeId`: Identifier of the envelope to claim from
- `claimer`: Address of the user claiming the packet
- `amount`: Amount being claimed (determined by off-chain randomness)

**Access Control:** Gateway only

**Returns:** The claimed amount

**Validations:**

- Envelope must exist
- Envelope must have remaining packets
- Claimer must not have already claimed from this envelope

**Behavior:**

- Records the claim to prevent double-claiming
- Updates remaining packet count
- Updates best luck winner if this amount is highest
- Emits `EnvelopeClaimed` event
- If all packets claimed, emits `EnvelopeCompleted` event

**Events Emitted:**

- `EnvelopeClaimed(string envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining)`
- `EnvelopeCompleted(string envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount)` (if last packet)

#### `GetEnvelope(string envelopeId) → object[]`

Retrieves envelope information.

**Parameters:**

- `envelopeId`: Identifier of the envelope

**Returns:** Array containing:

- `[0]` creator (UInt160)
- `[1]` totalAmount (BigInteger)
- `[2]` packetCount (BigInteger)
- `[3]` remaining (BigInteger)
- `[4]` bestLuckAddress (UInt160)
- `[5]` bestLuckAmount (BigInteger)

**Returns null if envelope doesn't exist**

#### `HasClaimed(string envelopeId, UInt160 claimer) → bool`

Checks if a user has already claimed from an envelope.

**Parameters:**

- `envelopeId`: Identifier of the envelope
- `claimer`: Address to check

**Returns:** true if user has claimed, false otherwise

#### `GetClaimedAmount(string envelopeId, UInt160 claimer) → BigInteger`

Gets the amount a user claimed from an envelope.

**Parameters:**

- `envelopeId`: Identifier of the envelope
- `claimer`: Address to check

**Returns:** Amount claimed (0 if not claimed)

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

### `EnvelopeCreated`

```csharp
event EnvelopeCreatedHandler(string envelopeId, UInt160 creator, BigInteger totalAmount, BigInteger packetCount)
```

Emitted when a new red envelope is created.

**Parameters:**

- `envelopeId`: Unique identifier for the envelope
- `creator`: Address of the creator
- `totalAmount`: Total GAS amount in the envelope
- `packetCount`: Number of packets available

### `EnvelopeClaimed`

```csharp
event EnvelopeClaimedHandler(string envelopeId, UInt160 claimer, BigInteger amount, BigInteger remaining)
```

Emitted when a packet is claimed from an envelope.

**Parameters:**

- `envelopeId`: Identifier of the envelope
- `claimer`: Address of the claimer
- `amount`: Amount claimed in this packet
- `remaining`: Number of packets still available

### `EnvelopeCompleted`

```csharp
event EnvelopeCompletedHandler(string envelopeId, UInt160 bestLuckWinner, BigInteger bestLuckAmount)
```

Emitted when all packets have been claimed.

**Parameters:**

- `envelopeId`: Identifier of the envelope
- `bestLuckWinner`: Address of the user who claimed the largest packet
- `bestLuckAmount`: Amount of the largest packet

## Automation Support

MiniAppRedEnvelope supports automated operations through the platform's automation service:

### Automated Tasks

#### Auto-Refund Expired Envelopes

The automation service monitors red envelopes and automatically refunds unclaimed packets after expiration.

**Trigger Conditions:**

- Envelope has expired (past deadline)
- Envelope has remaining unclaimed packets
- Creator has not manually cancelled

**Automation Flow:**

1. Automation service monitors envelope expiration times
2. When envelope expires with unclaimed packets
3. Service calls Gateway to trigger refund
4. Remaining balance returned to envelope creator
5. `EnvelopeExpired` event emitted (if implemented)

**Benefits:**

- Prevents locked funds in expired envelopes
- Automatic cleanup of stale envelopes
- No manual intervention required from creators
- Improves user experience and fund recovery

**Configuration:**

- Expiration period: Configurable per envelope (default 24 hours)
- Check interval: Every 5 minutes
- Batch processing: Up to 50 envelopes per batch

## Usage Flow

### Creating a Red Envelope

```
1. User Creates Envelope
   User → MiniApp Frontend → PaymentHub (deposit GAS)

2. Envelope Creation
   PaymentHub → Gateway → CreateEnvelope() → EnvelopeCreated Event

3. Share Envelope
   Frontend → Generate Share Link → Social Media/Chat
```

### Claiming a Packet

```
1. User Opens Envelope
   User → MiniApp Frontend → Check HasClaimed()

2. Random Amount Generation
   Frontend → Off-Chain Service → Generate Random Amount

3. Claim Processing
   Service → Gateway → Claim() → EnvelopeClaimed Event → PaymentHub

4. Update Display
   EnvelopeClaimed Event → Frontend → Show Amount + Best Luck Status
```

### Complete Workflow

1. **Creation Phase**
   - Creator deposits total amount to PaymentHub
   - Gateway calls `CreateEnvelope()` with envelope parameters
   - Contract stores envelope data and emits `EnvelopeCreated` event
   - Frontend generates shareable link

2. **Claiming Phase**
   - User clicks envelope link
   - Frontend checks `HasClaimed()` to prevent double-claiming
   - Off-chain service generates random amount using WeChat algorithm
   - Gateway calls `Claim()` with claimer address and amount
   - Contract validates and records claim
   - PaymentHub transfers amount to claimer
   - Contract updates best luck winner if applicable
   - Frontend displays claimed amount and best luck status

3. **Completion Phase**
   - Last packet is claimed
   - Contract emits `EnvelopeCompleted` event with best luck winner
   - Frontend displays completion animation and best luck winner
   - Optional: Platform awards bonus to best luck winner

## Security Considerations

### Access Control

- **Gateway Restriction**: Only Gateway can create envelopes and process claims
- **Admin Protection**: Administrative functions require admin witness
- **Pause Mechanism**: Emergency stop capability for security incidents

### Double-Claim Prevention

- **Storage-Based Tracking**: Each claim is recorded in contract storage
- **Validation**: `Claim()` checks `HasClaimed()` before processing
- **Immutable Records**: Once claimed, cannot claim again from same envelope

### Fairness Mechanisms

- **Off-Chain Randomness**: Random amounts generated by trusted service
- **Best Luck Tracking**: Transparent tracking of largest packet
- **Packet Limit**: Maximum 100 packets prevents abuse
- **Amount Validation**: Total distributed cannot exceed envelope total

### Trust Model

- **Gateway Trust**: Gateway must relay accurate claim amounts
- **Randomness Trust**: Off-chain service must generate fair random amounts
- **Creator Trust**: Creator must deposit full amount before distribution

### Limitations

- Random amount generation is off-chain (not verifiable on-chain)
- Gateway is a centralized trust point
- No dispute resolution mechanism
- Best luck winner determined by claim order and randomness

## Integration Requirements

### Prerequisites

1. **ServiceLayerGateway**: Deployed and configured
2. **PaymentHub**: Deployed for handling deposits and payouts
3. **Random Service**: Off-chain service for generating random amounts
4. **Frontend**: MiniApp interface for creating and claiming envelopes

### Configuration Steps

1. Deploy MiniAppRedEnvelope contract
2. Call `SetGateway(gatewayAddress)` to configure Gateway integration
3. Call `SetPaymentHub(hubAddress)` to enable payment processing
4. Configure random service with WeChat-style algorithm
5. Integrate frontend with contract events

### Random Service Requirements

- Must implement WeChat red envelope algorithm
- Must ensure fair distribution across all packets
- Must prevent amount manipulation
- Should use cryptographically secure randomness

## WeChat Red Envelope Algorithm

### Distribution Rules

1. **Minimum Amount**: Each packet gets at least 0.01 GAS
2. **Random Range**: Each packet can get 0.01 to (remaining \* 2 / remaining_packets)
3. **Last Packet**: Gets all remaining balance
4. **Fairness**: Average amount equals total / packet_count

### Example Distribution

```
Total: 10 GAS, Packets: 5

Packet 1: 2.3 GAS  (random from remaining 10)
Packet 2: 0.8 GAS  (random from remaining 7.7)
Packet 3: 3.5 GAS  (random from remaining 6.9) <- Best Luck!
Packet 4: 1.2 GAS  (random from remaining 3.4)
Packet 5: 2.2 GAS  (all remaining)

Best Luck Winner: Packet 3 claimer (3.5 GAS)
```

## Use Cases

### Social Gifting

- Birthday celebrations with friends
- Holiday red packets (Chinese New Year, etc.)
- Group rewards and incentives
- Community engagement activities

### Marketing Campaigns

- User acquisition red packet drops
- Referral rewards
- Community building events
- Platform promotions

### Gaming Integration

- Tournament prize distribution
- Achievement rewards
- Lucky draw mechanics
- Community events

## Contract Metadata

- **Name**: MiniAppRedEnvelope
- **Author**: R3E Network
- **Version**: 2.0.0
- **Description**: Red Envelope - WeChat-style random GAS red packets with best luck winner

## 中文说明

### 概述

MiniAppRedEnvelope 是一个微信风格的红包合约,使用户能够在 Neo 区块链上创建和分发随机 GAS 红包。合约实现了流行的中国传统红包,并带有游戏化的转折 - 随机分配金额和"手气最佳"获胜者功能。

### 核心功能

1. **创建红包**: 使用随机红包分配创建红包
2. **管理机制**: 微信风格的随机领取机制
3. **手气最佳追踪**: 追踪领取最大红包的获胜者
4. **防止重复领取**: 确保公平分配
5. **事件发出**: 为红包生命周期发出事件(创建、领取、完成)

### 使用方法

**创建红包流程:**

```
1. 用户创建红包
   用户 → MiniApp 前端 → PaymentHub(存入 GAS)

2. 红包创建
   PaymentHub → Gateway → CreateEnvelope() → EnvelopeCreated 事件

3. 分享红包
   前端 → 生成分享链接 → 社交媒体/聊天
```

**领取红包流程:**

```
1. 用户打开红包
   用户 → MiniApp 前端 → 检查 HasClaimed()

2. 随机金额生成
   前端 → 链外服务 → 生成随机金额

3. 领取处理
   服务 → Gateway → Claim() → EnvelopeClaimed 事件 → PaymentHub

4. 更新显示
   EnvelopeClaimed 事件 → 前端 → 显示金额 + 手气最佳状态
```

### 参数说明

**合约常量:**

- `MIN_AMOUNT`: 10000000 (0.1 GAS) - 红包总金额最小值
- `MAX_PACKETS`: 100 - 最大红包个数
- 每包最小金额: 0.01 GAS

**CreateEnvelope 方法:**

- `creator`: 红包创建者地址
- `totalAmount`: 要分配的总 GAS 金额 (最小 0.1 GAS)
- `packetCount`: 红包个数 (1-100 个)
- `expiryDurationMs`: 过期时间 (毫秒)
- `receiptId`: 支付收据 ID

**Claim 方法:**

- `envelopeId`: 要领取的红包标识符
- `claimer`: 领取用户的地址

**GetEnvelope 方法:**

- `envelopeId`: 红包标识符
- 返回: 包含创建者、总金额、红包个数、剩余个数、手气最佳地址和金额的数组

**微信红包算法:**

- 总金额最小值: 0.1 GAS
- 每包最小金额: 0.01 GAS
- 随机范围: 每个红包可获得 0.01 到 (剩余金额 \* 2 / 剩余红包数)
- 最后一个红包: 获得所有剩余余额
- 公平性: 平均金额等于总金额 / 红包个数

**安全特性:**

- 仅网关可以创建红包和处理领取
- 管理功能需要管理员见证
- 紧急暂停机制
- 基于存储的追踪防止重复领取
- 领取验证确保每个红包只能领取一次
- 红包个数限制最多 100 个防止滥用
