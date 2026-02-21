# MiniAppBurnLeague

## 中文说明

### 概述

GAS 燃烧排位赛是一个通缩型奖励系统，用户通过燃烧 GAS 来赚取平台奖励和排名积分。

### 核心机制

- **燃烧竞赛**：用户支付 GAS 进行燃烧，累积燃烧量排名
- **通缩模型**：所有燃烧的 GAS 永久销毁，减少流通供应
- **奖励系统**：根据燃烧量获得平台奖励和排行榜地位
- **排位机制**：实时更新全球燃烧排行榜

### 主要功能

#### 1. 燃烧 GAS (BurnGas)

```csharp
public static void BurnGas(UInt160 burner, BigInteger amount, BigInteger receiptId)
```

- 用户支付 GAS 进行燃烧
- 更新个人和全局燃烧统计
- 触发 `GasBurned` 事件

#### 2. 查询统计

```csharp
public static BigInteger TotalBurned()
public static BigInteger GetUserBurned(UInt160 user)
```

- 查询全局总燃烧量
- 查询用户个人燃烧量

### 使用场景

1. **通缩治理**：通过燃烧减少代币供应
2. **排名竞赛**：争夺燃烧排行榜榜首
3. **平台忠诚度**：展示对生态的长期承诺
4. **奖励获取**：通过燃烧获得平台特殊奖励

### 技术特性

- **永久销毁**：燃烧的 GAS 无法恢复
- **透明统计**：链上记录所有燃烧数据
- **实时排名**：即时更新排行榜
- **防作弊**：通过支付凭证验证

### 事件

- `GasBurned(burner, amount, totalBurned)` - GAS 燃烧事件
- `RewardClaimed(claimer, reward)` - 奖励领取事件

---

## English Description

### Overview

Burn League is a deflationary reward system where users burn GAS to earn platform rewards and ranking points.

### Core Mechanics

- **Burn Competition**: Users pay GAS to burn, accumulating burn rankings
- **Deflationary Model**: All burned GAS is permanently destroyed, reducing circulating supply
- **Reward System**: Earn platform rewards and leaderboard status based on burn amount
- **Ranking Mechanism**: Real-time global burn leaderboard updates

### Main Functions

#### 1. Burn GAS

```csharp
public static void BurnGas(UInt160 burner, BigInteger amount, BigInteger receiptId)
```

- Users pay GAS to burn
- Updates personal and global burn statistics
- Triggers `GasBurned` event

#### 2. Query Statistics

```csharp
public static BigInteger TotalBurned()
public static BigInteger GetUserBurned(UInt160 user)
```

- Query total global burn amount
- Query user's personal burn amount

### Use Cases

1. **Deflationary Governance**: Reduce token supply through burning
2. **Ranking Competition**: Compete for top burn leaderboard position
3. **Platform Loyalty**: Demonstrate long-term ecosystem commitment
4. **Reward Acquisition**: Earn special platform rewards through burning

### Technical Features

- **Permanent Destruction**: Burned GAS cannot be recovered
- **Transparent Statistics**: All burn data recorded on-chain
- **Real-time Rankings**: Instant leaderboard updates
- **Anti-cheating**: Verification through payment receipts

### Events

- `GasBurned(burner, amount, totalBurned)` - GAS burn event
- `RewardClaimed(claimer, reward)` - Reward claim event

### Contract Information

- **App ID**: `miniapp-burn-league`
- **Version**: 1.0.0
- **Author**: R3E Network
