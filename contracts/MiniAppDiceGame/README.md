# MiniAppDiceGame

## Overview

MiniAppDiceGame is a provably fair dice rolling game where players choose a number from 1-6 and win 6x their bet (minus 5% platform fee) if the dice roll matches their chosen number. The game uses VRF (Verifiable Random Function) randomness provided through the ServiceLayerGateway to ensure fairness.

## How It Works

### Core Mechanism

1. **Player Selection**: Player chooses a number between 1 and 6
2. **Randomness Generation**: Gateway provides VRF randomness
3. **Dice Roll**: Contract extracts first byte from randomness and calculates: `rolled = (randomness[0] % 6) + 1`
4. **Payout Calculation**: If rolled number matches chosen number, player wins `betAmount * 6 * 0.95` (5% platform fee)

### Architecture

The contract follows the standard MiniApp architecture:

- **Gateway Integration**: Only the ServiceLayerGateway can trigger game logic
- **Admin Controls**: Admin can configure gateway, payment hub, and pause state
- **Event-Driven**: Emits events for off-chain tracking and UI updates

## Key Methods

### Game Logic

#### `Roll(UInt160 player, BigInteger chosenNumber, BigInteger betAmount, ByteString randomness)`

Executes a dice roll for the player.

**Parameters:**

- `player`: Address of the player
- `chosenNumber`: Player's chosen number (1-6)
- `betAmount`: Amount wagered
- `randomness`: VRF randomness from gateway

**Validation:**

- Only callable by gateway
- `chosenNumber` must be between 1 and 6

**Behavior:**

- Extracts first byte from randomness
- Calculates rolled number: `(randomness[0] % 6) + 1`
- Calculates payout: `betAmount * 6 * 95 / 100` if match, else 0
- Emits `DiceRolled` event

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

### `DiceRolled(UInt160 player, BigInteger chosen, BigInteger rolled, BigInteger payout)`

Emitted when a dice roll is completed.

**Parameters:**

- `player`: Player's address
- `chosen`: Number chosen by player (1-6)
- `rolled`: Actual rolled number (1-6)
- `payout`: Amount won (0 if lost)

## Usage Flow

### Standard Game Flow

```
1. Player initiates game through frontend
   ↓
2. Frontend calls Gateway with bet and chosen number
   ↓
3. Gateway requests VRF randomness
   ↓
4. Gateway calls Roll() with randomness
   ↓
5. Contract calculates result and emits DiceRolled event
   ↓
6. PaymentHub processes payout if player won
   ↓
7. Frontend displays result to player
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

- **Win Probability**: 1/6 (16.67%)
- **Win Multiplier**: 6x
- **Platform Fee**: 5%
- **Effective Payout**: 5.7x (6 \* 0.95)
- **House Edge**: 5%
- **Expected Return**: 95% (fair game with house edge)

## Security Features

1. **Gateway-Only Access**: Game logic only callable by authorized gateway
2. **Admin Controls**: Separate admin functions with witness validation
3. **Pausable**: Emergency pause mechanism
4. **Deterministic Randomness**: Uses VRF for provable fairness
5. **Input Validation**: Validates chosen number range (1-6)

## Constants

- **Platform Fee**: 5% (hardcoded)
- **Dice Range**: 1-6 (standard six-sided die)
- **Win Multiplier**: 6x (before fee)

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
- **Business Logic**: Auto-settle expired games after timeout period

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Notes

- Contract must be registered with AppRegistry
- Gateway must be configured before gameplay
- PaymentHub must be set for automatic payouts
- Frontend should listen to `DiceRolled` events for real-time updates
- Randomness must be at least 1 byte in length

## 中文说明

### 概述

MiniAppDiceGame 是一个可证明公平的掷骰子游戏,玩家选择 1-6 之间的数字,如果骰子结果匹配所选数字,则赢得 6 倍赌注(扣除 5% 平台费用)。游戏使用通过 ServiceLayerGateway 提供的 VRF(可验证随机函数)随机性确保公平性。

### 核心功能

1. **玩家选择**: 玩家选择 1 到 6 之间的数字
2. **随机性生成**: 网关提供 VRF 随机性
3. **掷骰子**: 合约从随机性中提取第一个字节并计算: `rolled = (randomness[0] % 6) + 1`
4. **支付计算**: 如果掷出的数字匹配所选数字,玩家赢得 `betAmount * 6 * 0.95`(5% 平台费用)

### 使用方法

**标准游戏流程:**

```
1. 玩家通过前端发起游戏
2. 前端调用 Gateway 传入赌注和所选数字
3. Gateway 请求 VRF 随机性
4. Gateway 使用随机性调用 Roll()
5. 合约计算结果并发出 DiceRolled 事件
6. PaymentHub 处理支付(如果玩家获胜)
7. 前端向玩家显示结果
```

### 参数说明

**Roll 方法:**

- `player`: 玩家地址
- `chosenNumber`: 玩家选择的数字(1-6)
- `betAmount`: 下注金额
- `randomness`: 来自网关的 VRF 随机性

**游戏经济:**

- 获胜概率: 1/6 (16.67%)
- 获胜倍数: 6x
- 平台费用: 5%
- 有效支付: 5.7x (6 \* 0.95)
- 庄家优势: 5%
- 预期回报: 95%(带庄家优势的公平游戏)

**安全特性:**

- 仅网关可访问游戏逻辑
- 管理员控制功能需要见证验证
- 紧急暂停机制
- 使用 VRF 保证确定性随机性
- 输入验证确保所选数字范围(1-6)
