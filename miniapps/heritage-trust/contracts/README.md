# MiniAppHeritageTrust

## 中文说明

### 概述

遗产信托 DAO 是一个生前信托系统，用户可锁定 NEO 或 GAS 作为本金，不会一次性转给受益人，而是在触发后按月释放。NEO 会转换为 bNEO，通过 NeoBurger 赚取 GAS 奖励。

### 核心机制

- **资产锁定**：锁定 NEO/GAS 作为本金，NEO 转为 bNEO 赚取奖励
- **GAS 本金**：支持仅锁定 GAS 并按月释放本金
- **心跳检测**：每 30 天发送心跳证明存活
- **触发释放**：心跳超时后进入按月释放阶段
- **释放模式**：NEO + GAS、NEO + 奖励、仅奖励

### 主要功能

#### 1. 创建信托 (CreateTrust)

```csharp
public static void CreateTrust(UInt160 owner, UInt160 heir, BigInteger neoAmount, BigInteger gasAmount, BigInteger heartbeatIntervalDays, BigInteger monthlyNeo, BigInteger monthlyGas, bool onlyRewards, string trustName, string notes, BigInteger receiptId)
```

- 锁定 NEO/GAS 创建信托
- 设置继承人地址、心跳间隔（天）与每月释放计划
- 通过 onlyRewards 选择“仅奖励”模式
- 触发 `TrustCreated` 事件

#### 2. 发送心跳 (Heartbeat)

```csharp
public static void Heartbeat(BigInteger trustId)
```

- 重置心跳倒计时
- 证明所有者仍然存活
- 必须定期执行

#### 3. 领取收益 (ClaimYield)

```csharp
public static void ClaimYield(BigInteger trustId)
```

- 领取 NEO 产生的 GAS 收益
- 本金保持锁定，适用于信托未触发期间
- 触发 `YieldClaimed` 事件

#### 4. 执行信托 (ExecuteTrust)

```csharp
public static void ExecuteTrust(BigInteger trustId)
```

- 心跳超时后触发信托
- 进入按月释放阶段
- 触发 `TrustExecuted` 事件

#### 5. 领取释放资产 (ClaimReleasedAssets)

```csharp
public static void ClaimReleasedAssets(BigInteger trustId)
```

- 由受益人领取当月释放的本金与奖励
- 支持 NEO + GAS、NEO + 奖励、仅奖励模式

### 使用场景

1. **家族传承**：NEO 资产代际传承
2. **生前收益**：持有期间享受 GAS 收益
3. **自动继承**：无需遗嘱公证
4. **资产保护**：意外情况下的资产安全

### 技术特性

- **心跳间隔**：可配置（天）
- **触发释放**：超时后开始按月释放
- **收益分离**：本金与奖励分别管理
- **bNEO 复利**：NEO 转换为 bNEO 获取 GAS 奖励
- **bNEO 合约配置**：默认按网络选择主网/测试网 bNEO 地址，可由管理员调用 `SetBneoContract` 覆盖

### 参数说明

- **HEARTBEAT_INTERVAL**: 2592000 (30 天)
- **MIN_PRINCIPAL**: 1 NEO

### 事件

- `TrustCreated(trustId, owner, heir, principal)` - 信托创建
- `YieldClaimed(trustId, owner, amount)` - 收益领取
- `TrustExecuted(trustId, heir, principal)` - 信托触发

---

## English Description

### Overview

Heritage Trust DAO is a living trust system where users lock NEO or GAS as principal. NEO is converted to bNEO via NeoBurger to earn GAS rewards, and assets are released monthly after inactivity is triggered.

### Core Mechanics

- **Principal Lock**: Lock NEO/GAS; NEO becomes bNEO for rewards
- **GAS-only Trusts**: Support GAS principal with monthly GAS releases
- **Heartbeat Detection**: Send a heartbeat every 30 days to prove alive
- **Triggered Release**: After timeout, monthly releases begin
- **Release Modes**: NEO + GAS, NEO + rewards, or rewards only

### Main Functions

#### 1. Create Trust

```csharp
public static void CreateTrust(UInt160 owner, UInt160 heir, BigInteger neoAmount, BigInteger gasAmount, BigInteger heartbeatIntervalDays, BigInteger monthlyNeo, BigInteger monthlyGas, bool onlyRewards, string trustName, string notes, BigInteger receiptId)
```

- Lock NEO/GAS to create trust
- Set heir address, heartbeat interval (days), and monthly release schedule
- Use onlyRewards for rewards-only mode
- Triggers `TrustCreated` event

#### 2. Send Heartbeat

```csharp
public static void Heartbeat(BigInteger trustId)
```

- Reset heartbeat countdown
- Prove owner still alive
- Must execute periodically

#### 3. Claim Yield

```csharp
public static void ClaimYield(BigInteger trustId)
```

- Claim GAS yields from NEO
- Principal remains locked while active
- Triggers `YieldClaimed` event

#### 4. Execute Trust

```csharp
public static void ExecuteTrust(BigInteger trustId)
```

- Triggered after heartbeat timeout
- Starts the monthly release schedule
- Triggers `TrustExecuted` event

#### 5. Claim Released Assets

```csharp
public static void ClaimReleasedAssets(BigInteger trustId)
```

- Beneficiaries claim released principal and rewards
- Supports fixed release, NEO + rewards, or rewards-only modes

### Use Cases

1. **Family Succession**: NEO asset generational transfer
2. **Lifetime Income**: Enjoy GAS yields during holding period
3. **Auto Inheritance**: No need for will notarization
4. **Asset Protection**: Asset security in emergencies

### Technical Features

- **Heartbeat Interval**: Configurable (days)
- **Triggered Releases**: Monthly releases after timeout
- **Yield Separation**: Principal and rewards managed separately
- **bNEO Compounding**: NEO converts to bNEO for GAS rewards
- **bNEO Contract Config**: Default bNEO address is selected per network; admin can override via `SetBneoContract`

### Parameters

- **HEARTBEAT_INTERVAL**: 2592000 (30 days)
- **MIN_PRINCIPAL**: 1 NEO

### Events

- `TrustCreated(trustId, owner, heir, principal)` - Trust created
- `YieldClaimed(trustId, owner, amount)` - Yield claimed
- `TrustExecuted(trustId, heir, principal)` - Trust triggered

### Contract Information

- **App ID**: `miniapp-heritage-trust`
- **Version**: 2.0.0
- **Author**: R3E Network
