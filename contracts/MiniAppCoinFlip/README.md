# MiniAppCoinFlip

## Overview

MiniAppCoinFlip is a provably fair 50/50 coin flip game where players bet on heads or tails and win double their bet (minus 5% platform fee) if they guess correctly. The game uses VRF (Verifiable Random Function) randomness to ensure fairness and transparency.

## How It Works

### Core Mechanism

1. **Player Choice**: Player selects heads (true) or tails (false)
2. **Bet Placement**: Player places bet with minimum 0.05 GAS
3. **Randomness Generation**: Gateway provides VRF randomness
4. **Coin Flip**: Contract extracts first byte from randomness: `outcome = (randomness[0] % 2 == 0)`
5. **Payout**: If outcome matches choice, player wins `betAmount * 2 * 0.95` (5% platform fee)

### Architecture

The contract follows the standard MiniApp architecture:

- **Gateway Integration**: Only ServiceLayerGateway can trigger game resolution
- **Bet Tracking**: Each bet receives unique ID for tracking
- **Admin Controls**: Admin manages gateway, payment hub, and pause state
- **Event-Driven**: Emits events for bet placement and resolution

## Key Methods

### Game Logic

#### `PlaceBet(UInt160 player, BigInteger amount, bool choice) → BigInteger`

Places a new bet and returns bet ID.

**Parameters:**

- `player`: Address of the player
- `amount`: Bet amount (minimum 0.05 GAS = 5000000)
- `choice`: Player's choice (true = heads, false = tails)

**Returns:**

- `betId`: Unique identifier for this bet

**Validation:**

- Requires player witness
- Minimum bet: 0.05 GAS (5000000)

**Behavior:**

- Increments bet counter
- Emits `BetPlaced` event
- Returns new bet ID

#### `ResolveBet(BigInteger betId, UInt160 player, BigInteger amount, bool choice, ByteString randomness)`

Resolves a bet using VRF randomness.

**Parameters:**

- `betId`: Unique bet identifier
- `player`: Address of the player
- `amount`: Original bet amount
- `choice`: Player's original choice
- `randomness`: VRF randomness from gateway

**Validation:**

- Only callable by gateway

**Behavior:**

- Extracts first byte from randomness
- Calculates outcome: `(randomness[0] % 2 == 0)`
- Determines if player won: `outcome == choice`
- Calculates payout: `amount * 2 * 95 / 100` if won, else 0
- Emits `BetResolved` event

### Admin Methods

#### `SetGateway(UInt160 gateway)`

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

### `BetPlaced(UInt160 player, BigInteger amount, bool choice, BigInteger betId)`

Emitted when a player places a bet.

**Parameters:**

- `player`: Player's address
- `amount`: Bet amount
- `choice`: Player's choice (true = heads, false = tails)
- `betId`: Unique bet identifier

### `BetResolved(UInt160 player, BigInteger payout, bool won, BigInteger betId)`

Emitted when a bet is resolved.

**Parameters:**

- `player`: Player's address
- `payout`: Amount won (0 if lost)
- `won`: Whether player won
- `betId`: Unique bet identifier

## Usage Flow

### Standard Game Flow

```
1. Player initiates game through frontend
   ↓
2. Frontend calls PlaceBet() with amount and choice
   ↓
3. Contract emits BetPlaced event with betId
   ↓
4. Gateway requests VRF randomness
   ↓
5. Gateway calls ResolveBet() with randomness
   ↓
6. Contract calculates result and emits BetResolved event
   ↓
7. PaymentHub processes payout if player won
   ↓
8. Frontend displays result to player
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

- **Win Probability**: 50% (true 50/50 game)
- **Win Multiplier**: 2x
- **Platform Fee**: 5%
- **Effective Payout**: 1.9x (2 \* 0.95)
- **House Edge**: 5%
- **Expected Return**: 95% (fair game with house edge)

## Security Features

1. **Gateway-Only Resolution**: Only gateway can resolve bets
2. **Player Witness Required**: PlaceBet requires player signature
3. **Admin Controls**: Separate admin functions with witness validation
4. **Pausable**: Emergency pause mechanism
5. **Deterministic Randomness**: Uses VRF for provable fairness
6. **Minimum Bet**: Prevents dust attacks (0.05 GAS minimum)

## Constants

- **Minimum Bet**: 0.05 GAS (5000000)
- **Platform Fee**: 5% (hardcoded)
- **Win Multiplier**: 2x (before fee)

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
- **Business Logic**: Auto-settle expired bets after timeout period

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Notes

- Contract must be registered with AppRegistry
- Gateway must be configured before gameplay
- PaymentHub must be set for automatic payouts
- Frontend should listen to both `BetPlaced` and `BetResolved` events
- Bet ID tracking allows for asynchronous bet resolution
- Randomness must be at least 1 byte in length

## 中文说明

### 概述

MiniAppCoinFlip 是一个可证明公平的 50/50 硬币翻转游戏,玩家押注正面或反面,如果猜对则赢得双倍赌注(扣除 5% 平台费用)。游戏使用 VRF(可验证随机函数)随机性确保公平性和透明度。

### 核心功能

1. **玩家选择**: 玩家选择正面(true)或反面(false)
2. **下注**: 玩家下注,最低 0.05 GAS
3. **随机性生成**: 网关提供 VRF 随机性
4. **硬币翻转**: 合约从随机性中提取第一个字节: `outcome = (randomness[0] % 2 == 0)`
5. **支付**: 如果结果匹配选择,玩家赢得 `betAmount * 2 * 0.95`(5% 平台费用)

### 使用方法

**下注流程:**

```
1. 玩家通过前端发起游戏
2. 前端调用 PlaceBet() 传入金额和选择
3. 合约发出 BetPlaced 事件并返回 betId
4. 网关请求 VRF 随机性
5. 网关使用随机性调用 ResolveBet()
6. 合约计算结果并发出 BetResolved 事件
7. PaymentHub 处理支付(如果玩家获胜)
8. 前端向玩家显示结果
```

### 参数说明

**PlaceBet 方法:**

- `player`: 玩家地址
- `amount`: 下注金额(最低 0.05 GAS = 5000000)
- `choice`: 玩家选择(true = 正面, false = 反面)
- 返回: `betId` - 此次下注的唯一标识符

**ResolveBet 方法:**

- `betId`: 唯一下注标识符
- `player`: 玩家地址
- `amount`: 原始下注金额
- `choice`: 玩家的原始选择
- `randomness`: 来自网关的 VRF 随机性

**游戏经济:**

- 获胜概率: 50%(真正的 50/50 游戏)
- 获胜倍数: 2x
- 平台费用: 5%
- 有效支付: 1.9x (2 \* 0.95)
- 庄家优势: 5%
- 预期回报: 95%(带庄家优势的公平游戏)

**安全特性:**

- 仅网关可以解决下注
- PlaceBet 需要玩家签名
- 管理员控制功能需要见证验证
- 紧急暂停机制
- 使用 VRF 保证确定性随机性
- 最低下注防止粉尘攻击(0.05 GAS 最低)
