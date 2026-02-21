# MiniAppHeritageTrust

## 中文说明

### 概述

遗产信托 DAO 是一个生前信托系统，用户存入 NEO 资产，生前享受 GAS 收益，去世后本金自动转移给继承人。

### 核心机制

- **生前收益**：存入 NEO，定期领取 GAS 收益
- **心跳检测**：每 30 天需发送心跳证明存活
- **自动继承**：心跳超时后本金转给继承人
- **平台费用**：最终收益收取 5% 手续费

### 主要功能

#### 1. 创建信托 (CreateTrust)

```csharp
public static void CreateTrust(UInt160 owner, UInt160 heir, BigInteger neoAmount)
```

- 存入 NEO 创建信托
- 设置继承人地址
- 开始心跳倒计时
- 触发 `TrustCreated` 事件

#### 2. 发送心跳 (Heartbeat)

```csharp
public static void Heartbeat(UInt160 owner, BigInteger trustId)
```

- 重置 30 天倒计时
- 证明所有者仍然存活
- 必须定期执行

#### 3. 领取收益 (ClaimYield)

```csharp
public static void ClaimYield(UInt160 owner, BigInteger trustId)
```

- 领取 NEO 产生的 GAS 收益
- 本金保持不变
- 触发 `YieldClaimed` 事件

#### 4. 执行信托 (ExecuteTrust)

```csharp
public static void ExecuteTrust(BigInteger trustId)
```

- 心跳超时后自动执行
- 本金转给继承人
- 触发 `TrustExecuted` 事件

### 使用场景

1. **家族传承**：NEO 资产代际传承
2. **生前收益**：持有期间享受 GAS 收益
3. **自动继承**：无需遗嘱公证
4. **资产保护**：意外情况下的资产安全

### 技术特性

- **心跳间隔**：30 天
- **平台费率**：5%
- **自动执行**：超时自动触发
- **收益分离**：本金和收益分开管理

### 参数说明

- **HEARTBEAT_INTERVAL**: 2592000 (30 天)
- **PLATFORM_FEE_PERCENT**: 5%
- **最低存款**: 无限制

### 事件

- `TrustCreated(trustId, owner, heir, principal)` - 信托创建
- `YieldClaimed(trustId, owner, amount)` - 收益领取
- `TrustExecuted(trustId, heir, principal)` - 信托执行

---

## English Description

### Overview

Heritage Trust DAO is a living trust system where users deposit NEO assets, enjoy GAS yields while alive, and automatically transfer principal to heirs upon death.

### Core Mechanics

- **Lifetime Yields**: Deposit NEO, periodically claim GAS yields
- **Heartbeat Detection**: Must send heartbeat every 30 days to prove alive
- **Auto Inheritance**: Principal transfers to heir after heartbeat timeout
- **Platform Fee**: 5% fee on final yields

### Main Functions

#### 1. Create Trust

```csharp
public static void CreateTrust(UInt160 owner, UInt160 heir, BigInteger neoAmount)
```

- Deposit NEO to create trust
- Set heir address
- Start heartbeat countdown
- Triggers `TrustCreated` event

#### 2. Send Heartbeat

```csharp
public static void Heartbeat(UInt160 owner, BigInteger trustId)
```

- Reset 30-day countdown
- Prove owner still alive
- Must execute periodically

#### 3. Claim Yield

```csharp
public static void ClaimYield(UInt160 owner, BigInteger trustId)
```

- Claim GAS yields from NEO
- Principal remains unchanged
- Triggers `YieldClaimed` event

#### 4. Execute Trust

```csharp
public static void ExecuteTrust(BigInteger trustId)
```

- Auto-execute after heartbeat timeout
- Transfer principal to heir
- Triggers `TrustExecuted` event

### Use Cases

1. **Family Succession**: NEO asset generational transfer
2. **Lifetime Income**: Enjoy GAS yields during holding period
3. **Auto Inheritance**: No need for will notarization
4. **Asset Protection**: Asset security in emergencies

### Technical Features

- **Heartbeat Interval**: 30 days
- **Platform Fee**: 5%
- **Auto Execution**: Timeout triggers automatically
- **Yield Separation**: Principal and yields managed separately

### Parameters

- **HEARTBEAT_INTERVAL**: 2592000 (30 days)
- **PLATFORM_FEE_PERCENT**: 5%
- **Minimum Deposit**: No limit

### Events

- `TrustCreated(trustId, owner, heir, principal)` - Trust created
- `YieldClaimed(trustId, owner, amount)` - Yield claimed
- `TrustExecuted(trustId, heir, principal)` - Trust executed

### Contract Information

- **App ID**: `miniapp-heritage-trust`
- **Version**: 1.0.0
- **Author**: R3E Network
