# MiniAppDailyCheckin

## Overview

MiniAppDailyCheckin is a daily engagement platform that rewards users for consistent participation. Users check in daily to build streaks, earn rewards, and unlock badges. The system tracks user activity, provides milestone bonuses, and maintains comprehensive statistics.

### Key Features

- **Daily Check-in**: Users check in once per day to earn rewards
- **Streak Tracking**: Consecutive daily check-ins build streaks
- **Milestone Bonuses**: Special rewards at 30, 100, and 365 day streaks
- **Badge System**: Unlockable badges for achievements
- **Reward Claiming**: Accumulated rewards can be claimed anytime
- **Comprehensive Stats**: Full user and platform statistics

## How It Works

### Core Mechanism

1. **Check-in**: User calls CheckIn() with payment receipt
2. **Streak Update**: System updates streak (continues or resets)
3. **Reward Calculation**: Base reward + streak bonuses calculated
4. **Milestone Check**: Special bonuses for milestone streaks
5. **Badge Award**: Badges awarded for achievements
6. **Claim Rewards**: User claims accumulated rewards

### File Structure

```
MiniAppDailyCheckin/
├── MiniAppDailyCheckin.cs        # Main: delegates, constants, prefixes, events, structs
├── MiniAppDailyCheckin.Read.cs   # Global stats getters
├── MiniAppDailyCheckin.UserRead.cs # User stats getters
├── MiniAppDailyCheckin.Receipt.cs # Payment receipt validation
├── MiniAppDailyCheckin.CheckIn.cs # CheckIn method
├── MiniAppDailyCheckin.Reward.cs # Reward calculation
├── MiniAppDailyCheckin.Claim.cs  # ClaimRewards method
├── MiniAppDailyCheckin.Setters.cs # User storage setters
├── MiniAppDailyCheckin.GlobalSetters.cs # Global stats setters
├── MiniAppDailyCheckin.Milestone.cs # Milestone checking
├── MiniAppDailyCheckin.Badge.cs  # Badge checking
├── MiniAppDailyCheckin.Award.cs  # Badge awarding
├── MiniAppDailyCheckin.Query.cs  # Query helpers
├── MiniAppDailyCheckin.UserDetails.cs # GetUserStatsDetails
├── MiniAppDailyCheckin.Platform.cs # GetPlatformStats
├── MiniAppDailyCheckin.Status.cs # GetCheckinStatus
├── MiniAppDailyCheckin.Deploy.cs # Deployment
└── MiniAppDailyCheckin.Automation.cs # Automation hook
```

## Key Methods

### User Methods

#### `CheckIn(UInt160 user, BigInteger receiptId)`

Perform daily check-in for a user.

**Parameters:**
- `user`: User address
- `receiptId`: Payment receipt ID from PaymentHub

**Validation:**
- Contract must not be paused
- User must have valid payment receipt
- User can only check in once per UTC day

**Behavior:**
- Validates payment receipt for check-in fee
- Updates streak (continues if consecutive, resets if gap)
- Calculates and adds reward to unclaimed balance
- Checks and awards milestones
- Checks and awards badges
- Emits `CheckedIn` event

#### `ClaimRewards(UInt160 user)`

Claim accumulated unclaimed rewards.

**Parameters:**
- `user`: User address

**Validation:**
- Requires user witness or gateway authorization
- Must have unclaimed rewards > 0

**Behavior:**
- Transfers unclaimed rewards to user
- Updates claimed totals
- Resets unclaimed balance
- Emits `RewardsClaimed` event

### Query Methods

#### `GetCheckinStatus(UInt160 user) → Map<string, object>`

Returns current check-in status for a user.

**Returns:**
- `currentUtcDay`: Current UTC day number
- `lastCheckinDay`: Last check-in day
- `canCheckin`: Whether user can check in now
- `timeUntilEligible`: Seconds until next eligible check-in
- `streakWillReset`: Whether streak will reset on next check-in
- `currentStreak`: Current streak count
- `nextRewardDay`: Next reward milestone day

#### `GetUserStatsDetails(UInt160 user) → Map<string, object>`

Returns comprehensive user statistics.

**Returns:**
- `totalCheckins`: Total check-ins performed
- `currentStreak`: Current consecutive streak
- `highestStreak`: Best streak achieved
- `totalRewardsClaimed`: Total rewards claimed
- `unclaimedRewards`: Pending unclaimed rewards
- `streakResets`: Number of streak resets
- `badgeCount`: Badges earned
- `joinTime`: First check-in timestamp
- `lastCheckinTime`: Most recent check-in

#### `GetPlatformStats() → Map<string, object>`

Returns platform-wide statistics.

**Returns:**
- `totalUsers`: Total unique users
- `totalCheckins`: Total check-ins performed
- `totalRewarded`: Total rewards distributed
- `checkInFee`: Check-in fee amount
- `firstReward`: First day reward
- `subsequentReward`: Subsequent day reward
- `milestone30Bonus`: 30-day milestone bonus
- `milestone100Bonus`: 100-day milestone bonus
- `milestone365Bonus`: 365-day milestone bonus
- `currentUtcDay`: Current UTC day
- `nextMidnight`: Next midnight timestamp

## Events

### `CheckedIn(UInt160 user, BigInteger streak, BigInteger reward, BigInteger nextEligibleTs)`

Emitted when a user checks in.

### `RewardsClaimed(UInt160 user, BigInteger amount, BigInteger totalClaimed)`

Emitted when rewards are claimed.

### `StreakReset(UInt160 user, BigInteger previousStreak, BigInteger highestStreak)`

Emitted when a streak is reset due to missed day.

### `MilestoneReached(UInt160 user, BigInteger milestoneType, BigInteger streak)`

Emitted when user reaches a milestone (30, 100, 365 days).

### `BadgeEarned(UInt160 user, BigInteger badgeType, string badgeName)`

Emitted when user earns a badge.

### `BonusReward(UInt160 user, BigInteger bonusAmount, string bonusType)`

Emitted when user receives a bonus reward.

## Data Structures

### UserStats

```csharp
public struct UserStats
{
    public BigInteger TotalCheckins;
    public BigInteger CurrentStreak;
    public BigInteger HighestStreak;
    public BigInteger TotalRewardsClaimed;
    public BigInteger UnclaimedRewards;
    public BigInteger StreakResets;
    public BigInteger BadgeCount;
    public BigInteger JoinTime;
    public BigInteger LastCheckinTime;
    public BigInteger ComebackCount;
}
```

## Constants

```csharp
private const string APP_ID = "miniapp-dailycheckin";
private const long TWENTY_FOUR_HOURS_SECONDS = 86400;
private const long CHECK_IN_FEE = 100000;           // 0.001 GAS
private const long FIRST_REWARD = 100000000;        // 1 GAS
private const long SUBSEQUENT_REWARD = 150000000;   // 1.5 GAS
private const long MILESTONE_30_BONUS = 500000000;  // 5 GAS
private const long MILESTONE_100_BONUS = 2000000000; // 20 GAS
private const long MILESTONE_365_BONUS = 10000000000; // 100 GAS
```

## Storage Prefixes

| Prefix | Value | Purpose |
|--------|-------|---------|
| PREFIX_USER_STREAK | 0x20 | Current streak |
| PREFIX_USER_HIGHEST | 0x21 | Highest streak |
| PREFIX_USER_LAST_CHECKIN | 0x22 | Last check-in day |
| PREFIX_USER_UNCLAIMED | 0x23 | Unclaimed rewards |
| PREFIX_USER_CLAIMED | 0x24 | Total claimed |
| PREFIX_USER_CHECKINS | 0x25 | Total check-ins |
| PREFIX_TOTAL_USERS | 0x26 | Platform users |
| PREFIX_TOTAL_CHECKINS | 0x27 | Platform check-ins |
| PREFIX_TOTAL_REWARDED | 0x28 | Platform rewards |
| PREFIX_USER_BADGES | 0x29 | User badges |
| PREFIX_USER_STATS | 0x2A | User stats |
| PREFIX_USER_RESETS | 0x2B | Streak resets |
| PREFIX_USER_JOIN_TIME | 0x2C | Join timestamp |
| PREFIX_USER_BADGE_COUNT | 0x2D | Badge count |

## Usage Flow

### Daily Check-in Flow

```
1. User calls CheckIn(user, receiptId)
   ↓
2. Contract validates payment receipt
   ↓
3. Check if user can check in today
   ↓
4. Update streak (continue or reset)
   ↓
5. Calculate reward based on streak
   ↓
6. Check milestone bonuses (30/100/365)
   ↓
7. Check and award badges
   ↓
8. Update user and platform stats
   ↓
9. Emit CheckedIn event
```

### Reward Claiming Flow

```
1. User calls ClaimRewards(user)
   ↓
2. Verify unclaimed balance > 0
   ↓
3. Transfer rewards to user
   ↓
4. Update claimed totals
   ↓
5. Reset unclaimed balance
   ↓
6. Emit RewardsClaimed event
```

## 中文说明

### 概述

MiniAppDailyCheckin 是一个每日签到参与平台，奖励用户持续参与。用户每天签到以建立连续签到记录、获得奖励并解锁徽章。系统跟踪用户活动，提供里程碑奖励，并维护全面的统计数据。

### 主要特性

- **每日签到**: 用户每天签到一次获得奖励
- **连续记录**: 连续每日签到建立连续记录
- **里程碑奖励**: 30、100、365 天连续签到的特殊奖励
- **徽章系统**: 可解锁的成就徽章
- **奖励领取**: 累积奖励可随时领取
- **全面统计**: 完整的用户和平台统计

### 奖励机制

| 类型 | 金额 |
|------|------|
| 签到费用 | 0.001 GAS |
| 首日奖励 | 1 GAS |
| 后续奖励 | 1.5 GAS |
| 30天里程碑 | 5 GAS |
| 100天里程碑 | 20 GAS |
| 365天里程碑 | 100 GAS |

### 使用方法

**签到流程:**
```
1. 用户调用 CheckIn(user, receiptId)
2. 合约验证支付收据
3. 检查用户今天是否可以签到
4. 更新连续记录（继续或重置）
5. 根据连续记录计算奖励
6. 检查里程碑奖励
7. 检查并颁发徽章
8. 发出 CheckedIn 事件
```

**领取奖励流程:**
```
1. 用户调用 ClaimRewards(user)
2. 验证未领取余额 > 0
3. 转移奖励给用户
4. 更新已领取总额
5. 重置未领取余额
6. 发出 RewardsClaimed 事件
```
