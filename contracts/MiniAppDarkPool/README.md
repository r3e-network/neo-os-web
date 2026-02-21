# MiniAppDarkPool

## 中文说明

### 概述

隐私投票代理池是一个匿名治理系统，用户将 NEO 存入池中参与匿名投票，保护投票隐私的同时获得收益分配。

### 核心机制

- **匿名投票**：通过资金池隐藏个人投票身份
- **收益分配**：根据份额分配池子收益
- **隐私保护**：TEE 技术保护投票者身份
- **流动性管理**：随时存取 NEO

### 主要功能

#### 1. 存入 NEO (Deposit)

```csharp
public static void Deposit(UInt160 depositor, BigInteger neoAmount)
```

- 存入 NEO 到匿名池
- 获得对应份额
- 触发 `Deposit` 事件

#### 2. 提取 NEO (Withdraw)

```csharp
public static void Withdraw(UInt160 depositor, BigInteger neoAmount)
```

- 从池中提取 NEO
- 减少对应份额
- 验证余额充足

#### 3. 查询信息

```csharp
public static BigInteger TotalPooled()
```

- 查询池中总 NEO 数量

### 使用场景

1. **匿名治理**：隐藏投票身份参与治理
2. **隐私保护**：保护大户投票意图
3. **收益共享**：共享池子治理收益
4. **流动投票**：灵活参与多个提案

### 技术特性

- **TEE 隐私**：可信执行环境保护身份
- **份额制度**：按比例分配收益
- **即时流动**：随时存取资金
- **透明池子**：总量公开可查

---

## English Description

### Overview

Dark Pool is an anonymous governance system where users deposit NEO into a pool for anonymous voting, protecting voting privacy while earning yield distribution.

### Core Mechanics

- **Anonymous Voting**: Hide personal voting identity through pooling
- **Yield Distribution**: Distribute pool earnings based on shares
- **Privacy Protection**: TEE technology protects voter identity
- **Liquidity Management**: Deposit and withdraw NEO anytime

### Main Functions

#### 1. Deposit NEO

```csharp
public static void Deposit(UInt160 depositor, BigInteger neoAmount)
```

- Deposit NEO into anonymous pool
- Receive corresponding shares
- Triggers `Deposit` event

#### 2. Withdraw NEO

```csharp
public static void Withdraw(UInt160 depositor, BigInteger neoAmount)
```

- Withdraw NEO from pool
- Reduce corresponding shares
- Verify sufficient balance

#### 3. Query Information

```csharp
public static BigInteger TotalPooled()
```

- Query total NEO in pool

### Use Cases

1. **Anonymous Governance**: Hide voting identity in governance
2. **Privacy Protection**: Protect whale voting intentions
3. **Yield Sharing**: Share pool governance earnings
4. **Flexible Voting**: Participate in multiple proposals flexibly

### Technical Features

- **TEE Privacy**: Trusted execution environment protects identity
- **Share System**: Proportional yield distribution
- **Instant Liquidity**: Deposit/withdraw anytime
- **Transparent Pool**: Total amount publicly queryable

### Contract Information

- **App ID**: `miniapp-dark-pool`
- **Version**: 1.0.0
- **Author**: R3E Network
