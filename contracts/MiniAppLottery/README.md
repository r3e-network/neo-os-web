# MiniAppLottery

## Overview

MiniAppLottery is a comprehensive VRF-based lottery system where players purchase tickets for a chance to win the accumulated prize pool. The lottery operates in rounds, with each round accumulating a prize pool from ticket sales. Winners are selected using provably fair TEE VRF randomness, with 90% of the pool distributed as prizes and 10% retained as platform fee.

### Key Features

- **Provably Fair**: TEE VRF randomness ensures transparent winner selection
- **Player Statistics**: Comprehensive tracking of tickets, wins, and spending
- **Achievement System**: 6 unlockable achievements for participation milestones
- **Jackpot Rollover**: Unclaimed prizes roll over to next round
- **Round History**: Complete historical data for all lottery rounds
- **Minimum Participants**: Requires 3+ participants for fair draws

## How It Works

### Core Mechanism

1. **Ticket Purchase**: Players buy tickets at 0.1 GAS each (up to 100 per transaction)
2. **Pool Accumulation**: Ticket revenue accumulates in the prize pool for the current round
3. **Participant Tracking**: Contract tracks all participants and their ticket counts
4. **VRF Draw**: Admin triggers draw through gateway requesting TEE VRF randomness
5. **Winner Selection**: Contract uses SHA256 hash of randomness to select weighted winner
6. **Prize Distribution**: Winner receives 90% of prize pool, 10% goes to platform
7. **Stats Update**: Player statistics and achievements are updated
8. **New Round**: Contract resets pool and starts new round

### Architecture

The contract follows the standard MiniApp architecture with partial class organization:

- **Round-Based System**: Each lottery operates in discrete rounds with full history
- **Gateway Integration**: ServiceLayerGateway handles RNG requests and callbacks
- **Ticket Tracking**: Tracks tickets per player per round with participant indexing
- **Prize Pool Management**: Accumulates funds with rollover support
- **Player Statistics**: Comprehensive stats including wins, spending, streaks
- **Achievement System**: Milestone-based achievements with event notifications
- **Event-Driven**: Rich event system for all game actions

### File Structure

```
MiniAppLottery/
├── MiniAppLottery.cs           # Main: delegates, constants, prefixes, events, structs
├── MiniAppLottery.Read.cs      # Global read methods
├── MiniAppLottery.PlayerRead.cs # Player data read methods
├── MiniAppLottery.Deploy.cs    # Deployment initialization
├── MiniAppLottery.Methods.cs   # BuyTickets user method
├── MiniAppLottery.Admin.cs     # InitiateDraw admin method
├── MiniAppLottery.Callback.cs  # OnServiceCallback handler
├── MiniAppLottery.Internal.cs  # ProcessDrawResult, SelectWinner
├── MiniAppLottery.Storage.cs   # Storage helper methods
├── MiniAppLottery.Round.cs     # Round management
├── MiniAppLottery.Stats.cs     # Player stats update
├── MiniAppLottery.Achievement.cs # Achievement checking
├── MiniAppLottery.Award.cs     # Achievement awarding
├── MiniAppLottery.Query.cs     # Round query methods
├── MiniAppLottery.PlayerQuery.cs # Player stats query
├── MiniAppLottery.AchievementQuery.cs # Achievement query
├── MiniAppLottery.Platform.cs  # Platform statistics
├── MiniAppLottery.CurrentRound.cs # Current round info
└── MiniAppLottery.Automation.cs # Automation hook
```

## Key Methods

### Game Logic

#### `BuyTickets(UInt160 player, BigInteger ticketCount, BigInteger receiptId)`

Purchase lottery tickets for the current round.

**Parameters:**

- `player`: Address of the player
- `ticketCount`: Number of tickets to purchase (1-100)
- `receiptId`: Payment receipt ID from PaymentHub

**Validation:**

- Contract must not be globally paused
- Ticket count must be between 1 and 100
- Draw must not be in progress
- Requires player witness or gateway authorization
- Payment receipt must be valid

**Behavior:**

- Calculates total cost: `ticketCount * 0.1 GAS`
- Records tickets for player in current round
- Tracks new participants with indexing
- Adds cost to prize pool
- Updates player statistics (tickets, spending, rounds played)
- Checks and awards achievements
- Emits `TicketPurchased` event

#### `InitiateDraw()`

Admin initiates the lottery draw by requesting RNG from gateway.

**Validation:**

- Only admin can call
- Draw must not already be pending
- Prize pool must be greater than 0
- Minimum 3 participants required

**Behavior:**

- Sets draw pending flag
- Requests RNG from gateway with round ID payload
- Stores request data for callback
- Emits `DrawInitiated` event

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

- Retrieves round ID from stored request data
- If failed: clears draw pending flag, emits event with zero winner
- If success: processes draw result with randomness
- Selects winner using weighted ticket distribution
- Updates winner statistics (wins, prize amount, streaks)
- Stores completed round data
- Starts new round with fresh pool
- Emits `WinnerDrawn` and `RoundCompleted` events

### Query Methods

#### `GetPlayerStatsDetails(UInt160 player) → Map<string, object>`

Returns comprehensive player statistics.

**Returns:**
- `totalTickets`: Total tickets purchased across all rounds
- `totalSpent`: Total GAS spent on tickets
- `totalWins`: Number of wins
- `totalWon`: Total GAS won
- `roundsPlayed`: Number of rounds participated
- `consecutiveWins`: Current win streak
- `bestWinStreak`: Best win streak achieved
- `highestWin`: Largest single win
- `achievementCount`: Number of achievements unlocked
- `joinTime`: First participation timestamp
- `lastPlayTime`: Most recent activity
- `winRate`: Win percentage (basis points)
- `netProfit`: Total won minus total spent
- `currentRoundTickets`: Tickets in current round

#### `GetRoundDetails(BigInteger roundId) → Map<string, object>`

Returns details for a specific round.

**Returns:**
- `id`: Round identifier
- `totalTickets`: Total tickets sold
- `prizePool`: Total prize pool
- `participantCount`: Number of participants
- `winner`: Winner address
- `winnerPrize`: Prize amount
- `startTime`: Round start timestamp
- `endTime`: Round end timestamp
- `completed`: Whether round is complete

#### `GetCurrentRoundInfo() → Map<string, object>`

Returns current round status.

**Returns:**
- `roundId`: Current round number
- `prizePool`: Current pool including rollover
- `totalTickets`: Tickets sold this round
- `participantCount`: Current participants
- `startTime`: Round start time
- `isDrawPending`: Whether draw is in progress
- `ticketPrice`: Price per ticket
- `minParticipants`: Minimum required participants

#### `GetPlatformStats() → Map<string, object>`

Returns platform-wide statistics.

**Returns:**
- `currentRound`: Current round number
- `prizePool`: Current prize pool
- `totalTickets`: Total tickets this round
- `totalPlayers`: All-time unique players
- `totalPrizesDistributed`: All-time prizes paid
- `rolloverAmount`: Rollover from previous rounds
- `ticketPrice`: Ticket price constant
- `platformFee`: Platform fee percentage
- `maxTicketsPerTx`: Max tickets per purchase
- `minParticipants`: Minimum participants for draw
- `isDrawPending`: Draw status

## Events

### `TicketPurchased(UInt160 player, BigInteger ticketCount, BigInteger roundId)`

Emitted when a player purchases tickets.

### `DrawInitiated(BigInteger roundId, BigInteger requestId)`

Emitted when admin initiates a draw.

### `WinnerDrawn(UInt160 winner, BigInteger prize, BigInteger roundId)`

Emitted when a winner is selected.

### `RoundCompleted(BigInteger roundId, UInt160 winner, BigInteger prize, BigInteger totalTickets)`

Emitted when a round is fully completed with all statistics.

### `AchievementUnlocked(UInt160 player, BigInteger achievementId, string achievementName)`

Emitted when a player unlocks an achievement.

### `JackpotRollover(BigInteger roundId, BigInteger rolloverAmount)`

Emitted when prize pool rolls over to next round.

## Achievement System

Players can unlock achievements based on participation milestones:

| ID | Name | Requirement |
|----|------|-------------|
| 1 | First Ticket | Purchase 1 ticket |
| 2 | Ten Tickets | Purchase 10 tickets total |
| 3 | Hundred Tickets | Purchase 100 tickets total |
| 4 | First Win | Win 1 lottery |
| 5 | Big Winner | Win 10+ GAS in single draw |
| 6 | Lucky Streak | Win 3 consecutive rounds |

## Data Structures

### PlayerStats

```csharp
public struct PlayerStats
{
    public BigInteger TotalTickets;
    public BigInteger TotalSpent;
    public BigInteger TotalWins;
    public BigInteger TotalWon;
    public BigInteger RoundsPlayed;
    public BigInteger ConsecutiveWins;
    public BigInteger BestWinStreak;
    public BigInteger HighestWin;
    public BigInteger AchievementCount;
    public BigInteger JoinTime;
    public BigInteger LastPlayTime;
}
```

### RoundData

```csharp
public struct RoundData
{
    public BigInteger Id;
    public BigInteger TotalTickets;
    public BigInteger PrizePool;
    public BigInteger ParticipantCount;
    public UInt160 Winner;
    public BigInteger WinnerPrize;
    public BigInteger StartTime;
    public BigInteger EndTime;
    public bool Completed;
}
```

## Usage Flow

### Standard Game Flow

```
1. Player calls BuyTickets(player, ticketCount, receiptId)
   ↓
2. Contract validates payment receipt
   ↓
3. Contract records tickets and tracks participant
   ↓
4. Player stats updated (tickets, spending, rounds)
   ↓
5. Achievements checked and awarded
   ↓
6. TicketPurchased event emitted
   ↓
7. Admin calls InitiateDraw() when ready
   ↓
8. Contract requests RNG from gateway
   ↓
9. DrawInitiated event emitted
   ↓
10. Gateway calls OnServiceCallback() with randomness
   ↓
11. Winner selected via weighted ticket distribution
   ↓
12. Winner stats updated (wins, prize, streaks)
   ↓
13. Round data stored, new round initialized
   ↓
14. WinnerDrawn and RoundCompleted events emitted
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

- **Ticket Price**: 0.1 GAS (10,000,000 fractions)
- **Max Tickets Per Purchase**: 100
- **Minimum Participants**: 3
- **Prize Distribution**: 90% to winner, 10% platform fee
- **Big Win Threshold**: 10 GAS (for achievement)
- **Jackpot Rollover**: Supported for unclaimed prizes

## Security Features

1. **Gateway-Only Draws**: Only gateway can trigger winner selection via callback
2. **Player Witness Required**: BuyTickets requires player signature or gateway authorization
3. **Admin Controls**: Separate admin functions with witness validation
4. **Global Pause**: Emergency pause mechanism via platform registry
5. **TEE VRF Randomness**: Uses provably fair randomness for winner selection
6. **Ticket Limits**: Max 100 tickets per purchase prevents manipulation
7. **Pool Validation**: Ensures pool exists before drawing winner
8. **Minimum Participants**: Requires 3+ participants for fair draws
9. **Receipt Validation**: Payment receipts prevent double-spending
10. **Bet Limits**: Validates against platform bet limits

## Constants

```csharp
private const string APP_ID = "miniapp-lottery";
private const long TICKET_PRICE = 10000000;      // 0.1 GAS
private const int PLATFORM_FEE_PERCENT = 10;
private const int MAX_TICKETS_PER_TX = 100;
private const int MIN_PARTICIPANTS = 3;
private const long BIG_WIN_THRESHOLD = 1000000000; // 10 GAS
```

## Storage Prefixes

| Prefix | Value | Purpose |
|--------|-------|---------|
| PREFIX_ROUND | 0x20 | Current round number |
| PREFIX_POOL | 0x21 | Prize pool amount |
| PREFIX_TICKETS | 0x22 | Player tickets per round |
| PREFIX_TICKET_COUNT | 0x23 | Total tickets this round |
| PREFIX_PARTICIPANTS | 0x24 | Participant addresses |
| PREFIX_DRAW_PENDING | 0x25 | Draw in progress flag |
| PREFIX_PARTICIPANT_COUNT | 0x26 | Participant count per round |
| PREFIX_PLAYER_STATS | 0x27 | Player statistics |
| PREFIX_ROUND_DATA | 0x28 | Round history data |
| PREFIX_ACHIEVEMENTS | 0x29 | Player achievements |
| PREFIX_TOTAL_PLAYERS | 0x2A | All-time player count |
| PREFIX_TOTAL_PRIZES | 0x2B | All-time prizes distributed |
| PREFIX_ROLLOVER | 0x2C | Rollover amount |

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

MiniAppLottery 是一个基于 TEE VRF 的彩票系统，玩家购买彩票以赢取累积奖池。彩票以轮次运行，每轮从彩票销售中累积奖池。使用可证明公平的 VRF 随机性选择获胜者，90% 的奖池作为奖金分配，10% 作为平台费用保留。

### 主要特性

- **可证明公平**: TEE VRF 随机性确保透明的获胜者选择
- **玩家统计**: 全面跟踪彩票、获胜和消费
- **成就系统**: 6 个可解锁的参与里程碑成就
- **奖池滚存**: 未领取的奖金滚存到下一轮
- **轮次历史**: 所有彩票轮次的完整历史数据
- **最低参与者**: 需要 3+ 参与者才能开奖

### 核心功能

1. **购买彩票**: 玩家以每张 0.1 GAS 的价格购买彩票（每次交易最多 100 张）
2. **奖池累积**: 彩票收入累积到当前轮次的奖池中
3. **参与者跟踪**: 合约跟踪所有参与者及其彩票数量
4. **VRF 开奖**: 管理员通过网关请求 TEE VRF 随机性触发开奖
5. **选择获胜者**: 合约使用 SHA256 哈希随机性按权重选择获胜者
6. **奖金分配**: 获胜者获得奖池的 90%，10% 归平台所有
7. **统计更新**: 更新玩家统计和成就
8. **新轮次**: 合约重置奖池并开始新轮次

### 成就系统

| ID | 名称 | 要求 |
|----|------|------|
| 1 | 首张彩票 | 购买 1 张彩票 |
| 2 | 十张彩票 | 累计购买 10 张彩票 |
| 3 | 百张彩票 | 累计购买 100 张彩票 |
| 4 | 首次获胜 | 赢得 1 次彩票 |
| 5 | 大赢家 | 单次赢得 10+ GAS |
| 6 | 幸运连胜 | 连续赢得 3 轮 |

### 使用方法

**购买彩票流程:**

```
1. 玩家调用 BuyTickets(player, ticketCount, receiptId)
2. 合约验证支付收据
3. 合约记录彩票并跟踪参与者
4. 更新玩家统计（彩票、消费、轮次）
5. 检查并颁发成就
6. 发出 TicketPurchased 事件
```

**开奖流程:**

```
1. 管理员调用 InitiateDraw()
2. 合约向网关请求 RNG
3. 发出 DrawInitiated 事件
4. 网关调用 OnServiceCallback() 返回随机性
5. 按权重彩票分布选择获胜者
6. 更新获胜者统计（获胜、奖金、连胜）
7. 存储轮次数据，初始化新轮次
8. 发出 WinnerDrawn 和 RoundCompleted 事件
```

### 游戏经济

- **彩票价格**: 0.1 GAS (10,000,000 fractions)
- **每次购买最多彩票数**: 100 张
- **最低参与者**: 3 人
- **奖金分配**: 90% 给获胜者，10% 平台费用
- **大赢门槛**: 10 GAS（用于成就）
- **奖池滚存**: 支持未领取奖金滚存
