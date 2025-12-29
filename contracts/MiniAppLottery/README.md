# MiniAppLottery

## Overview

MiniAppLottery is a VRF-based lottery system where players purchase tickets for a chance to win the accumulated prize pool. The lottery operates in rounds, with each round accumulating a prize pool from ticket sales. Winners are selected using provably fair VRF randomness, with 90% of the pool distributed as prizes and 10% retained as platform fee.

## How It Works

### Core Mechanism

1. **Ticket Purchase**: Players buy tickets at 0.1 GAS each (up to 100 per transaction)
2. **Pool Accumulation**: Ticket revenue accumulates in the prize pool for the current round
3. **VRF Draw**: Admin triggers draw through gateway with VRF randomness
4. **Winner Selection**: Contract uses randomness to select winner from ticket holders
5. **Prize Distribution**: Winner receives 90% of prize pool, 10% goes to platform
6. **New Round**: Contract resets pool and increments round number

### Architecture

The contract follows the standard MiniApp architecture:

- **Round-Based System**: Each lottery operates in discrete rounds
- **Gateway Integration**: Only ServiceLayerGateway can trigger draws
- **Ticket Tracking**: Tracks tickets per player per round
- **Prize Pool Management**: Accumulates and distributes funds automatically
- **Event-Driven**: Emits events for ticket purchases and winner announcements

## Key Methods

### Game Logic

#### `BuyTickets(UInt160 player, BigInteger ticketCount)`

Purchase lottery tickets for the current round.

**Parameters:**

- `player`: Address of the player
- `ticketCount`: Number of tickets to purchase (1-100)

**Validation:**

- Requires player witness
- Ticket count must be between 1 and 100

**Behavior:**

- Calculates total cost: `ticketCount * 0.1 GAS`
- Records tickets for player in current round
- Adds cost to prize pool
- Emits `TicketPurchased` event

#### `DrawWinner(ByteString randomness)`

Draws a winner using VRF randomness and distributes prizes.

**Parameters:**

- `randomness`: VRF randomness from gateway

**Validation:**

- Only callable by gateway
- Prize pool must be greater than 0

**Behavior:**

- Calculates prize: `pool * 90%`
- Selects winner based on randomness (simplified in current implementation)
- Resets prize pool to 0
- Increments round number
- Emits `WinnerDrawn` event

#### `OnServiceCallback(BigInteger requestId, string appId, string serviceType, bool success, ByteString result, string error)`

Handles VRF service callbacks from gateway.

**Parameters:**

- `requestId`: Request identifier
- `appId`: Application identifier
- `serviceType`: Type of service (expects "rng")
- `success`: Whether service call succeeded
- `result`: VRF randomness result
- `error`: Error message if failed

**Validation:**

- Only callable by gateway

**Behavior:**

- If success and serviceType is "rng", calls `DrawWinner()` with result

### Admin Methods

#### `SetAdmin(UInt160 newAdmin)`

Sets a new admin address. Only current admin can call.

#### `SetGateway(UInt160 gateway)`

Sets the ServiceLayerGateway address. Only admin can call.

#### `SetPaymentHub(UInt160 paymentHub)`

Sets the PaymentHub address for payment processing. Only admin can call.

#### `SetPaused(bool paused)`

Pauses or unpauses the contract. Only admin can call.

#### `Update(ByteString nefFile, string manifest)`

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

#### `CurrentRound() → BigInteger`

Returns the current round number.

#### `PrizePool() → BigInteger`

Returns the current prize pool amount.

## Events

### `TicketPurchased(UInt160 player, BigInteger ticketCount, BigInteger roundId)`

Emitted when a player purchases tickets.

**Parameters:**

- `player`: Player's address
- `ticketCount`: Number of tickets purchased
- `roundId`: Current round number

### `WinnerDrawn(UInt160 winner, BigInteger prize, BigInteger roundId)`

Emitted when a winner is drawn.

**Parameters:**

- `winner`: Winner's address
- `prize`: Prize amount (90% of pool)
- `roundId`: Round number for this draw

## Usage Flow

### Standard Game Flow

```
1. Players purchase tickets via BuyTickets()
   ↓
2. Contract records tickets and adds to prize pool
   ↓
3. Contract emits TicketPurchased events
   ↓
4. Admin triggers draw through gateway
   ↓
5. Gateway requests VRF randomness
   ↓
6. Gateway calls OnServiceCallback() with randomness
   ↓
7. Contract calls DrawWinner() internally
   ↓
8. Winner selected, prize calculated (90% of pool)
   ↓
9. Contract emits WinnerDrawn event
   ↓
10. New round begins with reset pool
```

### Deployment Flow

```
1. Deploy contract (initializes round 1, pool 0)
   ↓
2. Admin calls SetGateway() with gateway address
   ↓
3. Admin calls SetPaymentHub() with payment hub address
   ↓
4. Register with AppRegistry
   ↓
5. Contract ready for ticket sales
```

## Game Economics

- **Ticket Price**: 0.1 GAS (10000000)
- **Max Tickets Per Purchase**: 100
- **Prize Distribution**: 90% to winner, 10% platform fee
- **Round-Based**: Each draw starts new round with fresh pool

## Security Features

1. **Gateway-Only Draws**: Only gateway can trigger winner selection
2. **Player Witness Required**: BuyTickets requires player signature
3. **Admin Controls**: Separate admin functions with witness validation
4. **Pausable**: Emergency pause mechanism
5. **VRF Randomness**: Uses provably fair randomness for winner selection
6. **Ticket Limits**: Max 100 tickets per purchase prevents manipulation
7. **Pool Validation**: Ensures pool exists before drawing winner

## Constants

- **Ticket Price**: 0.1 GAS (10000000)
- **Platform Fee**: 10%
- **Max Tickets Per Purchase**: 100

## Implementation Notes

**Current Limitation**: The winner selection in `DrawWinner()` is simplified and uses admin address as placeholder. A production implementation should:

- Track all ticket holders and their ticket counts
- Use randomness to select from weighted pool based on ticket ownership
- Implement proper winner selection algorithm

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
- **Business Logic**: Auto-trigger lottery draws

### Events

- `AutomationRegistered(taskId, triggerType, schedule)`
- `AutomationCancelled(taskId)`
- `PeriodicExecutionTriggered(taskId)`

## Integration Notes

- Contract must be registered with AppRegistry
- Gateway must be configured before draws
- PaymentHub must be set for automatic prize distribution
- Frontend should listen to `TicketPurchased` and `WinnerDrawn` events
- Admin must trigger draws through gateway with VRF service
- Round tracking allows for historical lottery data

## 中文说明

### 概述

MiniAppLottery 是一个基于 VRF 的彩票系统,玩家购买彩票以赢取累积奖池。彩票以轮次运行,每轮从彩票销售中累积奖池。使用可证明公平的 VRF 随机性选择获胜者,90% 的奖池作为奖金分配,10% 作为平台费用保留。

### 核心功能

1. **购买彩票**: 玩家以每张 0.1 GAS 的价格购买彩票(每次交易最多 100 张)
2. **奖池累积**: 彩票收入累积到当前轮次的奖池中
3. **VRF 开奖**: 管理员通过网关使用 VRF 随机性触发开奖
4. **选择获胜者**: 合约使用随机性从彩票持有者中选择获胜者
5. **奖金分配**: 获胜者获得奖池的 90%,10% 归平台所有
6. **新轮次**: 合约重置奖池并递增轮次编号

### 使用方法

**购买彩票流程:**

```
1. 玩家通过 BuyTickets() 购买彩票
2. 合约记录彩票并添加到奖池
3. 合约发出 TicketPurchased 事件
```

**开奖流程:**

```
1. 管理员通过网关触发开奖
2. 网关请求 VRF 随机性
3. 网关使用随机性调用 OnServiceCallback()
4. 合约内部调用 DrawWinner()
5. 选择获胜者,计算奖金(奖池的 90%)
6. 合约发出 WinnerDrawn 事件
7. 新轮次开始,奖池重置
```

### 参数说明

**BuyTickets 方法:**

- `player`: 玩家地址
- `ticketCount`: 购买彩票数量(1-100)

**DrawWinner 方法:**

- `randomness`: 来自网关的 VRF 随机性

**游戏经济:**

- 彩票价格: 0.1 GAS (10000000)
- 每次购买最多彩票数: 100 张
- 奖金分配: 90% 给获胜者,10% 平台费用
- 基于轮次: 每次开奖开始新轮次,奖池清零

**安全特性:**

- 仅网关可触发开奖
- 购买彩票需要玩家签名
- 管理员控制功能需要见证验证
- 紧急暂停机制
- 使用 VRF 保证公平的随机性
- 每次购买最多 100 张彩票防止操纵
- 开奖前验证奖池存在
