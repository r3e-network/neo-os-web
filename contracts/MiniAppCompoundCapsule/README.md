# MiniAppCompoundCapsule

## 中文说明

### 概述

时间胶囊复利机是一个强制储蓄合约，用户锁定 NEO 资产并自动复利 GAS 收益，到期后一次性提取本金和收益。

### 核心机制

- **时间锁定**：用户设定锁定天数，解锁时间为链上 Unix 时间戳（秒）
- **自动复利**：NEO 产生的 GAS 自动累积复利
- **强制储蓄**：到期前无法提前解锁，培养储蓄习惯
- **平台手续费**：解锁时收取 2% 手续费

### 主要功能

#### 1. 创建胶囊 (CreateCapsule)

```csharp
public static BigInteger CreateCapsule(UInt160 owner, BigInteger neoAmount, BigInteger lockDays)
```

- 存入 NEO 并设定锁定天数
- 创建唯一胶囊 ID
- 触发 `CapsuleCreated` 事件

#### 2. 解锁胶囊 (UnlockCapsule)

```csharp
public static void UnlockCapsule(BigInteger capsuleId)
```

- 到期后提取本金和复利收益
- 合约内部验证所有者身份
- 扣除 2% 平台手续费
- 触发 `CapsuleUnlocked` 事件

#### 3. 查询信息

```csharp
public static BigInteger TotalCapsules()
```

- 查询总胶囊数量

### 使用场景

1. **长期储蓄**：强制锁定资产，避免冲动消费
2. **复利增长**：NEO 持续产生 GAS，自动复投
3. **目标储蓄**：为特定目标设定时间锁
4. **财富传承**：为子女创建长期储蓄计划

### 技术特性

- **时间锁**：智能合约强制执行解锁时间
- **自动复利**：NEO 产生的 GAS 自动累积
- **透明费用**：2% 平台手续费公开透明
- **安全保障**：只有所有者可以解锁

### 参数说明

- **最低存款**：无最低限制
- **平台费率**：2%
- **解锁条件**：必须达到设定的解锁时间（秒）

### 事件

- `CapsuleCreated(capsuleId, owner, principal, unlockTime)` - 胶囊创建事件（unlockTime 为秒）
- `CapsuleUnlocked(capsuleId, owner, total)` - 胶囊解锁事件

---

## English Description

### Overview

Compound Time Capsule is a forced savings contract where users lock NEO assets with auto-compounding GAS yields, withdrawing principal and earnings at maturity.

### Core Mechanics

- **Time Lock**: Users set lock duration in days; unlock time is a Unix timestamp (seconds)
- **Auto-Compounding**: GAS generated from NEO automatically compounds
- **Forced Savings**: Cannot unlock early, cultivating savings habits
- **Platform Fee**: 2% fee charged upon unlock

### Main Functions

#### 1. Create Capsule

```csharp
public static BigInteger CreateCapsule(UInt160 owner, BigInteger neoAmount, BigInteger lockDays)
```

- Deposit NEO and set lock duration in days
- Create unique capsule ID
- Triggers `CapsuleCreated` event

#### 2. Unlock Capsule

```csharp
public static void UnlockCapsule(BigInteger capsuleId)
```

- Withdraw principal and compound earnings after maturity
- Contract internally verifies owner identity
- Deduct 2% platform fee
- Triggers `CapsuleUnlocked` event

#### 3. Query Information

```csharp
public static BigInteger TotalCapsules()
```

- Query total number of capsules

### Use Cases

1. **Long-term Savings**: Force lock assets, avoid impulsive spending
2. **Compound Growth**: NEO continuously generates GAS, auto-reinvested
3. **Goal-based Savings**: Set time locks for specific goals
4. **Wealth Transfer**: Create long-term savings plans for children

### Technical Features

- **Time Lock**: Smart contract enforces unlock time
- **Auto-Compounding**: GAS from NEO automatically accumulates
- **Transparent Fees**: 2% platform fee is publicly transparent
- **Security**: Only owner can unlock

### Parameters

- **Minimum Deposit**: No minimum
- **Platform Fee**: 2%
- **Unlock Condition**: Must reach set unlock time

### Events

- `CapsuleCreated(capsuleId, owner, principal, unlockTime)` - Capsule creation event (unlockTime in seconds)
- `CapsuleUnlocked(capsuleId, owner, total)` - Capsule unlock event

### Contract Information

- **App ID**: `miniapp-compound-capsule`
- **Version**: 1.0.0
- **Author**: R3E Network
