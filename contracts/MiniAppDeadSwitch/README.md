# MiniAppDeadSwitch

## 中文说明

### 概述

全链上遗产遗嘱是一个自动化继承系统，通过心跳检测机制，在所有者失联后自动将资产转移给指定继承人。

### 核心机制

- **心跳检测**：定期发送心跳信号证明存活
- **自动触发**：超时未心跳则自动执行遗嘱
- **加密消息**：可附带加密遗言给继承人
- **灵活配置**：自定义检查间隔（1天-1年）

### 主要功能

#### 1. 创建开关 (CreateSwitch)

```csharp
public static void CreateSwitch(UInt160 owner, UInt160 heir, BigInteger checkInterval,
                                string encryptedMessage, BigInteger receiptId)
```

- 设置继承人和检查间隔
- 存入至少 1 GAS
- 可选加密遗言
- 触发 `SwitchCreated` 事件

#### 2. 发送心跳 (Heartbeat)

```csharp
public static void Heartbeat(UInt160 owner, BigInteger switchId)
```

- 重置截止时间
- 证明所有者仍然存活
- 触发 `Heartbeat` 事件

#### 3. 触发开关 (TriggerSwitch)

```csharp
public static void TriggerSwitch(BigInteger switchId)
```

- 超时后自动执行
- 将资产转给继承人
- 触发 `SwitchTriggered` 事件

#### 4. 追加资金 (AddFunds)

```csharp
public static void AddFunds(UInt160 owner, BigInteger switchId, BigInteger amount, BigInteger receiptId)
```

- 向现有开关追加资产

### 使用场景

1. **数字遗产**：自动化数字资产继承
2. **紧急备份**：失联时资产自动转移
3. **家族信托**：长期资产传承规划
4. **安全保障**：意外情况下的资产保护

### 技术特性

- **最低存款**：1 GAS
- **检查间隔**：1天 - 1年可配置
- **TEE 加密**：遗言通过 TEE 加密传递
- **自动执行**：无需人工干预

### 参数说明

- **MIN_DEPOSIT**: 100000000 (1 GAS)
- **MIN_INTERVAL**: 86400 (1 天)
- **MAX_INTERVAL**: 31536000 (1 年)

### 事件

- `SwitchCreated(switchId, owner, heir, checkInterval)` - 开关创建
- `Heartbeat(switchId, nextDeadline)` - 心跳信号
- `SwitchTriggered(switchId, heir, amount)` - 开关触发

---

## English Description

### Overview

Dead Man's Switch is an automated inheritance system that uses heartbeat detection to automatically transfer assets to designated heirs after owner becomes unresponsive.

### Core Mechanics

- **Heartbeat Detection**: Periodically send heartbeat signals to prove alive
- **Auto Trigger**: Automatically execute will if heartbeat timeout
- **Encrypted Messages**: Optional encrypted last words for heirs
- **Flexible Config**: Customizable check intervals (1 day - 1 year)

### Main Functions

#### 1. Create Switch

```csharp
public static void CreateSwitch(UInt160 owner, UInt160 heir, BigInteger checkInterval,
                                string encryptedMessage, BigInteger receiptId)
```

- Set heir and check interval
- Deposit minimum 1 GAS
- Optional encrypted message
- Triggers `SwitchCreated` event

#### 2. Send Heartbeat

```csharp
public static void Heartbeat(UInt160 owner, BigInteger switchId)
```

- Reset deadline
- Prove owner still alive
- Triggers `Heartbeat` event

#### 3. Trigger Switch

```csharp
public static void TriggerSwitch(BigInteger switchId)
```

- Auto-execute after timeout
- Transfer assets to heir
- Triggers `SwitchTriggered` event

#### 4. Add Funds

```csharp
public static void AddFunds(UInt160 owner, BigInteger switchId, BigInteger amount, BigInteger receiptId)
```

- Add more assets to existing switch

### Use Cases

1. **Digital Heritage**: Automated digital asset inheritance
2. **Emergency Backup**: Auto-transfer assets if lost contact
3. **Family Trust**: Long-term asset succession planning
4. **Security Guarantee**: Asset protection in emergencies

### Technical Features

- **Minimum Deposit**: 1 GAS
- **Check Interval**: 1 day - 1 year configurable
- **TEE Encryption**: Messages encrypted via TEE
- **Auto Execution**: No manual intervention needed

### Parameters

- **MIN_DEPOSIT**: 100000000 (1 GAS)
- **MIN_INTERVAL**: 86400 (1 day)
- **MAX_INTERVAL**: 31536000 (1 year)

### Events

- `SwitchCreated(switchId, owner, heir, checkInterval)` - Switch created
- `Heartbeat(switchId, nextDeadline)` - Heartbeat signal
- `SwitchTriggered(switchId, heir, amount)` - Switch triggered

### Contract Information

- **App ID**: `miniapp-dead-switch`
- **Version**: 1.0.0
- **Author**: R3E Network
