# MiniAppCoinFlip

## Overview

MiniAppCoinFlip is a provably fair 50/50 coin flip game where players bet on heads or tails and win double their bet (minus 3% platform fee) if they guess correctly. The game uses TEE VRF (Verifiable Random Function) randomness to ensure fairness and transparency.

### Key Features

- **Provably Fair**: TEE VRF randomness ensures transparent outcome
- **Jackpot System**: 1% of bets contribute to jackpot pool with 0.5% win chance
- **Player Statistics**: Comprehensive tracking of bets, wins, streaks
- **Achievement System**: 10 unlockable achievements for milestones
- **Streak Bonuses**: Win streak bonuses up to 5% extra payout
- **Bet History**: Complete bet history per player

## How It Works

### Core Mechanism

1. **Player Choice**: Player selects heads (true) or tails (false)
2. **Bet Placement**: Player places bet (0.1 - 50 GAS)
3. **Randomness Request**: Gateway requests TEE VRF randomness
4. **Coin Flip**: Contract extracts first byte from randomness: `outcome = (randomness[0] % 2 == 0)`
5. **Jackpot Check**: 0.5% chance to win jackpot pool
6. **Streak Bonus**: Win streak adds bonus payout (0.5% per streak, max 5%)
7. **Payout**: If outcome matches choice, player wins `betAmount * 2 * 0.97` (3% platform fee)
8. **Stats Update**: Player statistics and achievements updated

### Architecture

The contract follows the standard MiniApp architecture with partial class organization:

- **Gateway Integration**: Only ServiceLayerGateway can trigger game resolution
- **Bet Tracking**: Each bet receives unique ID with full history
- **Player Statistics**: Comprehensive stats including streaks and achievements
- **Jackpot Pool**: Progressive jackpot from bet contributions
- **Achievement System**: Milestone-based achievements with event notifications
- **Event-Driven**: Rich event system for all game actions

### File Structure

```
MiniAppCoinFlip/
├── MiniAppCoinFlip.cs           # Main: delegates, constants, prefixes, events, structs
├── MiniAppCoinFlip.Methods.cs   # PlaceBet user method
├── MiniAppCoinFlip.Callback.cs  # OnServiceCallback handler
├── MiniAppCoinFlip.Internal.cs  # StoreBet, AddUserBet, StorePlayerStats
├── MiniAppCoinFlip.Stats.cs     # UpdatePlayerStats
├── MiniAppCoinFlip.Achievement.cs # CheckAchievements
├── MiniAppCoinFlip.Award.cs     # AwardAchievement
├── MiniAppCoinFlip.Query.cs     # GetBetDetails
├── MiniAppCoinFlip.PlayerQuery.cs # GetPlayerStatsDetails
├── MiniAppCoinFlip.Platform.cs  # GetPlatformStats
├── MiniAppCoinFlip.UserBets.cs  # GetUserBetCount, GetUserBets
└── MiniAppCoinFlip.Automation.cs # Automation hook
```

## Key Methods

### Game Logic

#### `PlaceBet(UInt160 player, BigInteger amount, bool choice, BigInteger receiptId) → BigInteger`

Places a new bet and returns bet ID.

**Parameters:**

- `player`: Address of the player
- `amount`: Bet amount (0.1 - 50 GAS)
- `choice`: Player's choice (true = heads, false = tails)
- `receiptId`: Payment receipt ID from PaymentHub

**Returns:**

- `betId`: Unique identifier for this bet

**Validation:**

- Contract must not be globally paused
- Requires player witness or gateway authorization
- Bet amount must be between MIN_BET (0.1 GAS) and MAX_BET (50 GAS)
- Payment receipt must be valid

**Behavior:**

- Validates payment receipt
- Increments bet counter
- Stores bet data with timestamp
- Adds to user bet history
- Contributes 1% to jackpot pool
- Emits `BetPlaced` event
- Returns new bet ID

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

- Retrieves bet data from stored request
- Extracts first byte from randomness
- Calculates outcome: `(randomness[0] % 2 == 0)`
- Determines if player won: `outcome == choice`
- Checks for jackpot win (0.5% chance)
- Calculates streak bonus (0.5% per win streak, max 5%)
- Calculates payout: `amount * 2 * 0.97 + streakBonus` if won
- Updates player statistics
- Checks and awards achievements
- Emits `BetResolved`, `JackpotWon`, `StreakUpdated` events

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

#### `GetBetDetails(BigInteger betId) → Map<string, object>`

Returns details for a specific bet.

**Returns:**
- `player`: Player address
- `amount`: Bet amount
- `choice`: Player's choice
- `timestamp`: Bet placement time
- `resolved`: Whether bet is resolved
- `won`: Whether player won
- `payout`: Payout amount
- `streakBonus`: Streak bonus amount

#### `GetPlayerStatsDetails(UInt160 player) → Map<string, object>`

Returns comprehensive player statistics.

**Returns:**
- `totalBets`: Total bets placed
- `totalWins`: Total wins
- `totalLosses`: Total losses
- `totalWagered`: Total GAS wagered
- `totalWon`: Total GAS won
- `totalLost`: Total GAS lost
- `currentWinStreak`: Current win streak
- `currentLossStreak`: Current loss streak
- `bestWinStreak`: Best win streak achieved
- `worstLossStreak`: Worst loss streak
- `highestWin`: Largest single win
- `highestBet`: Largest single bet
- `achievementCount`: Achievements unlocked
- `jackpotsWon`: Jackpots won
- `joinTime`: First bet timestamp
- `lastBetTime`: Most recent bet
- `winRate`: Win percentage (basis points)
- `netProfit`: Total won minus total lost
- `hasFirstWin`, `hasTenWins`, etc.: Achievement flags

#### `GetPlatformStats() → Map<string, object>`

Returns platform-wide statistics.

**Returns:**
- `totalBets`: Total bets placed
- `totalPlayers`: Unique players
- `totalWagered`: Total GAS wagered
- `totalPaid`: Total GAS paid out
- `jackpotPool`: Current jackpot pool
- `minBet`: Minimum bet amount
- `maxBet`: Maximum bet amount
- `platformFee`: Platform fee percentage
- `jackpotThreshold`: Minimum jackpot to win
- `jackpotChance`: Jackpot win chance (basis points)
- `highRollerThreshold`: High roller threshold
- `streakBonusBps`: Streak bonus per win
- `maxStreakBonus`: Maximum streak bonus
- `houseEdge`: Actual house edge (basis points)

#### `GetUserBetCount(UInt160 player) → BigInteger`

Returns total bet count for a player.

#### `GetUserBets(UInt160 player, BigInteger offset, BigInteger limit) → BigInteger[]`

Returns paginated bet IDs for a player.

#### `Admin() → UInt160`

Returns the admin address.

#### `Gateway() → UInt160`

Returns the gateway address.

#### `PaymentHub() → UInt160`

Returns the payment hub address.

#### `IsPaused() → bool`

Returns whether the contract is paused.

## Events

### `BetPlaced(UInt160 player, BigInteger betId, BigInteger amount, bool choice)`

Emitted when a player places a bet.

### `BetResolved(UInt160 player, BigInteger betId, bool won, BigInteger payout)`

Emitted when a bet is resolved.

### `JackpotWon(UInt160 player, BigInteger amount)`

Emitted when a player wins the jackpot.

### `AchievementUnlocked(UInt160 player, BigInteger achievementId, string name)`

Emitted when a player unlocks an achievement.

### `StreakUpdated(UInt160 player, BigInteger streakType, BigInteger streakCount)`

Emitted when a player's streak is updated (1 = win streak, 2 = loss streak).

## Usage Flow

### Standard Game Flow

```
1. Player initiates game through frontend
   ↓
2. Frontend calls PlaceBet() with amount, choice, receiptId
   ↓
3. Contract validates payment and stores bet
   ↓
4. Contract emits BetPlaced event with betId
   ↓
5. Gateway requests TEE VRF randomness
   ↓
6. Gateway calls OnServiceCallback() with randomness
   ↓
7. Contract calculates result, checks jackpot
   ↓
8. Contract updates player stats and achievements
   ↓
9. Contract emits BetResolved (and JackpotWon if applicable)
   ↓
10. PaymentHub processes payout if player won
   ↓
11. Frontend displays result to player
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
- **Platform Fee**: 3%
- **Effective Payout**: 1.94x (2 × 0.97)
- **House Edge**: 3%
- **Expected Return**: 97% (fair game with house edge)
- **Jackpot Contribution**: 1% of each bet
- **Jackpot Win Chance**: 0.5% per bet
- **Streak Bonus**: 0.5% per consecutive win (max 5%)

## Achievement System

Players can unlock achievements based on participation milestones:

| ID | Name | Requirement |
|----|------|-------------|
| 1 | First Win | Win 1 bet |
| 2 | Ten Wins | Win 10 bets |
| 3 | Hundred Wins | Win 100 bets |
| 4 | High Roller | Single bet >= 10 GAS |
| 5 | Lucky Streak | 5 consecutive wins |
| 6 | Jackpot Winner | Win the jackpot |
| 7 | Veteran | Place 100 total bets |
| 8 | Big Spender | Wager 100 GAS total |
| 9 | Comeback King | Win after 5 loss streak |
| 10 | Whale | Single bet >= 50 GAS |

## Data Structures

### BetData

```csharp
public struct BetData
{
    public UInt160 Player;
    public BigInteger Amount;
    public bool Choice;
    public BigInteger Timestamp;
    public bool Resolved;
    public bool Won;
    public BigInteger Payout;
    public BigInteger StreakBonus;
}
```

### PlayerStats

```csharp
public struct PlayerStats
{
    public BigInteger TotalBets;
    public BigInteger TotalWins;
    public BigInteger TotalLosses;
    public BigInteger TotalWagered;
    public BigInteger TotalWon;
    public BigInteger TotalLost;
    public BigInteger CurrentWinStreak;
    public BigInteger CurrentLossStreak;
    public BigInteger BestWinStreak;
    public BigInteger WorstLossStreak;
    public BigInteger HighestWin;
    public BigInteger HighestBet;
    public BigInteger AchievementCount;
    public BigInteger JackpotsWon;
    public BigInteger JoinTime;
    public BigInteger LastBetTime;
}
```

## Security Features

1. **Gateway-Only Resolution**: Only gateway can resolve bets via callback
2. **Player Witness Required**: PlaceBet requires player signature or gateway authorization
3. **Admin Controls**: Separate admin functions with witness validation
4. **Global Pause**: Emergency pause mechanism via platform registry
5. **TEE VRF Randomness**: Uses provably fair randomness for outcome
6. **Bet Limits**: Min 0.1 GAS, Max 50 GAS prevents manipulation
7. **Receipt Validation**: Payment receipts prevent double-spending
8. **Bet Limits Validation**: Validates against platform bet limits

## Constants

```csharp
private const string APP_ID = "miniapp-coinflip";
private const int PLATFORM_FEE_PERCENT = 3;
private const long MIN_BET = 10000000;              // 0.1 GAS
private const long MAX_BET = 5000000000;            // 50 GAS
private const int JACKPOT_CONTRIBUTION_BPS = 100;   // 1%
private const int JACKPOT_CHANCE_BPS = 50;          // 0.5%
private const long JACKPOT_THRESHOLD = 100000000;   // 1 GAS minimum
private const long HIGH_ROLLER_THRESHOLD = 1000000000; // 10 GAS
private const int STREAK_BONUS_BPS = 50;            // 0.5% per streak
private const int MAX_STREAK_BONUS = 500;           // 5% max
```

## Storage Prefixes

| Prefix | Value | Purpose |
|--------|-------|---------|
| PREFIX_BET_ID | 0x20 | Bet counter |
| PREFIX_BETS | 0x21 | Bet data storage |
| PREFIX_PLAYER_STATS | 0x22 | Player statistics |
| PREFIX_TOTAL_WAGERED | 0x23 | Total wagered |
| PREFIX_TOTAL_PAID | 0x24 | Total paid out |
| PREFIX_JACKPOT_POOL | 0x25 | Jackpot pool |
| PREFIX_ACHIEVEMENTS | 0x26 | Player achievements |
| PREFIX_USER_BETS | 0x27 | User bet history |
| PREFIX_USER_BET_COUNT | 0x28 | User bet count |
| PREFIX_TOTAL_PLAYERS | 0x29 | Total players |

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

MiniAppCoinFlip 是一个可证明公平的 50/50 硬币翻转游戏，玩家押注正面或反面，如果猜对则赢得双倍赌注（扣除 3% 平台费用）。游戏使用 TEE VRF（可验证随机函数）随机性确保公平性和透明度。

### 主要特性

- **可证明公平**: TEE VRF 随机性确保透明结果
- **累积奖池**: 每注 1% 贡献到奖池，0.5% 中奖概率
- **玩家统计**: 全面跟踪下注、获胜、连胜
- **成就系统**: 10 个可解锁的里程碑成就
- **连胜奖励**: 连胜奖励最高 5% 额外支付
- **下注历史**: 每个玩家的完整下注历史

### 核心功能

1. **玩家选择**: 玩家选择正面(true)或反面(false)
2. **下注**: 玩家下注（0.1 - 50 GAS）
3. **随机性请求**: 网关请求 TEE VRF 随机性
4. **硬币翻转**: 合约从随机性中提取第一个字节
5. **奖池检查**: 0.5% 概率赢得奖池
6. **连胜奖励**: 连胜增加奖励支付（每次 0.5%，最高 5%）
7. **支付**: 如果结果匹配选择，玩家赢得 `betAmount * 2 * 0.97`
8. **统计更新**: 更新玩家统计和成就

### 成就系统

| ID | 名称 | 要求 |
|----|------|------|
| 1 | 首胜 | 赢得 1 次 |
| 2 | 十胜 | 赢得 10 次 |
| 3 | 百胜 | 赢得 100 次 |
| 4 | 豪赌客 | 单次下注 >= 10 GAS |
| 5 | 幸运连胜 | 连续赢 5 次 |
| 6 | 奖池赢家 | 赢得奖池 |
| 7 | 老手 | 累计下注 100 次 |
| 8 | 大手笔 | 累计下注 100 GAS |
| 9 | 逆转王 | 连输 5 次后获胜 |
| 10 | 巨鲸 | 单次下注 >= 50 GAS |

### 游戏经济

- 获胜概率: 50%（真正的 50/50 游戏）
- 获胜倍数: 2x
- 平台费用: 3%
- 有效支付: 1.94x (2 × 0.97)
- 庄家优势: 3%
- 预期回报: 97%
- 奖池贡献: 每注 1%
- 奖池中奖概率: 0.5%
- 连胜奖励: 每次连胜 0.5%（最高 5%）

### 使用方法

**下注流程:**

```
1. 玩家通过前端发起游戏
2. 前端调用 PlaceBet() 传入金额、选择和收据ID
3. 合约验证支付并存储下注
4. 合约发出 BetPlaced 事件
5. 网关请求 TEE VRF 随机性
6. 网关调用 OnServiceCallback() 返回随机性
7. 合约计算结果，检查奖池
8. 合约更新玩家统计和成就
9. 合约发出 BetResolved 事件（如中奖池则发出 JackpotWon）
10. PaymentHub 处理支付（如果玩家获胜）
11. 前端向玩家显示结果
```
