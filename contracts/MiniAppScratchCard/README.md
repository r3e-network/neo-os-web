# MiniAppScratchCard

## Overview

MiniAppScratchCard is an instant-win scratch card game where players purchase cards of different types and reveal them using VRF randomness. Players have a 20% chance to win double their card cost (minus 5% platform fee). The game provides instant gratification with immediate win/loss determination.

## How It Works

### Core Mechanism

1. **Card Purchase**: Player selects card type (determines cost multiplier)
2. **Card Reveal**: Gateway provides VRF randomness for reveal
3. **Win Calculation**: Contract generates random number 0-99 from randomness
4. **Prize Determination**: If random < 20 (20% chance), player wins `cost * cardType * 2 * 0.95`
5. **Instant Payout**: Winner receives prize immediately through PaymentHub

### Architecture

The contract follows the standard MiniApp architecture:

- **Gateway Integration**: Only ServiceLayerGateway can trigger card reveals
- **Card Type System**: Different card types with varying costs/prizes
- **Admin Controls**: Admin manages gateway, payment hub, and pause state
- **Event-Driven**: Emits events for card reveals with prize information

## Key Methods

### Game Logic

#### `Reveal(UInt160 player, BigInteger cardType, BigInteger cost, ByteString randomness)`

Reveals a scratch card using VRF randomness.

**Parameters:**

- `player`: Address of the player
- `cardType`: Type of card (affects prize multiplier)
- `cost`: Cost paid for the card
- `randomness`: VRF randomness from gateway

**Validation:**

- Only callable by gateway

**Behavior:**

- Extracts first byte from randomness: `rand = randomness[0] % 100`
- Calculates prize: if `rand < 20`, prize = `cost * cardType * 2 * 95 / 100`, else 0
- Emits `CardRevealed` event with result

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Handles service callbacks from gateway (currently no-op).

**Parameters:**

- `requestId`: Request identifier
- `appId`: Application identifier
- `serviceType`: Type of service
- `success`: Whether service call succeeded
- `result`: Service result
- `error`: Error message if failed

**Validation:**

- Only callable by gateway

### Admin Methods

#### `SetAdmin(UInt160 a)`

Sets a new admin address. Only current admin can call.

#### `SetGateway(UInt160 g)`

Sets the ServiceLayerGateway address. Only admin can call.

#### `SetPaymentHub(UInt160 hub)`

Sets the PaymentHub address for payment processing. Only admin can call.

#### `SetPaused(bool paused)`

Pauses or unpauses the contract. Only admin can call.

#### `Update(ByteString nef, string manifest)`

Updates the contract code. Only admin can call.

### Query Methods

#### `Admin() → UInt160`

Returns the admin address.

#### `Gateway() → UInt160`

Returns the gateway address.

#### `PaymentHub() → UInt160`

Returns the payment hub address.

#### `IsPaused() → bool`

Returns whether the contract is paused.

## Events

### `CardRevealed(UInt160 player, BigInteger cardType, BigInteger prize)`

Emitted when a scratch card is revealed.

**Parameters:**

- `player`: Player's address
- `cardType`: Type of card revealed
- `prize`: Prize amount (0 if lost)

## Usage Flow

### Standard Game Flow

```
1. Player purchases card through frontend
   ↓
2. Frontend calls Gateway with card type and cost
   ↓
3. Gateway requests VRF randomness
   ↓
4. Gateway calls Reveal() with randomness
   ↓
5. Contract generates random number (0-99)
   ↓
6. Contract calculates prize (20% win chance)
   ↓
7. Contract emits CardRevealed event
   ↓
8. PaymentHub processes payout if won
   ↓
9. Frontend displays result to player
```

### Deployment Flow

```
1. Deploy contract
   ↓
2. Admin calls SetGateway() with gateway address
   ↓
3. Admin calls SetPaymentHub() with payment hub address
   ↓
4. Register with AppRegistry
   ↓
5. Contract ready for gameplay
```

## Game Economics

- **Win Probability**: 20% (1 in 5 chance)
- **Win Multiplier**: 2x \* cardType
- **Platform Fee**: 5%
- **Effective Payout**: 1.9x _ cardType (2 _ 0.95)
- **House Edge**: 5%
- **Expected Return**: 38% (20% win rate \* 1.9x payout)

## Security Features

1. **Gateway-Only Access**: Game logic only callable by authorized gateway
2. **Admin Controls**: Separate admin functions with witness validation
3. **Pausable**: Emergency pause mechanism
4. **Deterministic Randomness**: Uses VRF for provable fairness
5. **Instant Resolution**: No state storage reduces attack surface

## Constants

- **Win Threshold**: 20 (out of 100, giving 20% win rate)
- **Platform Fee**: 5% (hardcoded)
- **Win Multiplier**: 2x \* cardType (before fee)

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
- **Business Logic**: Auto-manage prize pool distribution

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Notes

- Contract must be registered with AppRegistry
- Gateway must be configured before gameplay
- PaymentHub must be set for automatic payouts
- Frontend should listen to `CardRevealed` events for real-time updates
- Card type system allows for different prize tiers
- Randomness must be at least 1 byte in length

## 中文说明

### 概述

MiniAppScratchCard 是一个即开型刮刮卡游戏,玩家购买不同类型的卡片并使用 VRF 随机性揭开它们。玩家有 20% 的机会赢得双倍卡片成本(扣除 5% 平台费用)。游戏提供即时满足感,立即确定输赢。

### 核心功能

1. **购买卡片**: 玩家选择卡片类型(决定成本倍数)
2. **揭开卡片**: 网关提供 VRF 随机性进行揭示
3. **计算获胜**: 合约从随机性生成 0-99 的随机数
4. **奖金确定**: 如果随机数 < 20(20% 机会),玩家赢得 `cost * cardType * 2 * 0.95`
5. **即时支付**: 获胜者立即通过 PaymentHub 获得奖金

### 使用方法

**标准游戏流程:**

```
1. 玩家通过前端购买卡片
2. 前端调用 Gateway 传入卡片类型和成本
3. Gateway 请求 VRF 随机性
4. Gateway 使用随机性调用 Reveal()
5. 合约生成随机数(0-99)
6. 合约计算奖金(20% 获胜机会)
7. 合约发出 CardRevealed 事件
8. PaymentHub 处理支付(如果获胜)
9. 前端向玩家显示结果
```

### 参数说明

**Reveal 方法:**

- `player`: 玩家地址
- `cardType`: 卡片类型(影响奖金倍数)
- `cost`: 卡片支付的成本
- `randomness`: 来自网关的 VRF 随机性

**游戏经济:**

- 获胜概率: 20%(1/5 机会)
- 获胜倍数: 2x \* cardType
- 平台费用: 5%
- 有效支付: 1.9x _ cardType (2 _ 0.95)
- 庄家优势: 5%
- 预期回报: 38%(20% 获胜率 \* 1.9x 支付)

**安全特性:**

- 仅网关可访问游戏逻辑
- 管理员控制功能需要见证验证
- 紧急暂停机制
- 使用 VRF 保证确定性随机性
- 即时结算减少攻击面
