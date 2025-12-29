# MiniAppDarkRadio

## 中文说明

### 概述

黑暗森林电台是一个匿名抗审查广播系统，用户支付 GAS 发布匿名消息，支付越多展示时间越长、优先级越高。

### 核心机制

- **匿名广播**：TEE 剥离发送者身份后广播
- **付费展示**：支付 GAS 购买展示时长
- **优先级系统**：支付越多，字体越大、位置越靠前
- **抗审查**：无法追踪消息来源

### 主要功能

#### 1. 基础广播 (Broadcast)

```csharp
public static void Broadcast(UInt160 sender, string contentHash, BigInteger receiptId)
```

- 支付 0.1 GAS 发布消息
- 展示时长：1 小时
- 触发 `Broadcast` 事件

#### 2. 高级广播 (BroadcastPremium)

```csharp
public static void BroadcastPremium(UInt160 sender, string contentHash,
                                    BigInteger amount, BigInteger receiptId)
```

- 支付更多 GAS 获得更长展示时间
- 计算公式：每 1 GAS = 1 小时展示
- 设置消息优先级

### 使用场景

1. **匿名发声**：无法追踪的言论自由
2. **抗审查通信**：绕过中心化审查
3. **暗网广告**：匿名商业推广
4. **吹哨人保护**：安全披露敏感信息

### 技术特性

- **最低费用**：0.1 GAS
- **展示时长**：1 GAS = 1 小时
- **TEE 匿名化**：完全剥离身份信息
- **内容哈希**：存储内容哈希而非明文

### 参数说明

- **MIN_BROADCAST**: 10000000 (0.1 GAS)
- **SECONDS_PER_GAS**: 3600 (1 小时)
- **内容长度限制**: 128 字符

---

## English Description

### Overview

Dark Forest Radio is an anonymous censorship-resistant broadcast system where users pay GAS to publish anonymous messages, with more payment resulting in longer display time and higher priority.

### Core Mechanics

- **Anonymous Broadcast**: TEE strips sender identity before broadcast
- **Paid Display**: Pay GAS to purchase display duration
- **Priority System**: More payment = larger font, better position
- **Censorship Resistant**: Untraceable message source

### Main Functions

#### 1. Basic Broadcast

```csharp
public static void Broadcast(UInt160 sender, string contentHash, BigInteger receiptId)
```

- Pay 0.1 GAS to publish message
- Display duration: 1 hour
- Triggers `Broadcast` event

#### 2. Premium Broadcast

```csharp
public static void BroadcastPremium(UInt160 sender, string contentHash,
                                    BigInteger amount, BigInteger receiptId)
```

- Pay more GAS for longer display time
- Formula: 1 GAS = 1 hour display
- Set message priority

### Use Cases

1. **Anonymous Voice**: Untraceable freedom of speech
2. **Censorship Resistance**: Bypass centralized censorship
3. **Dark Web Ads**: Anonymous commercial promotion
4. **Whistleblower Protection**: Safely disclose sensitive information

### Technical Features

- **Minimum Fee**: 0.1 GAS
- **Display Duration**: 1 GAS = 1 hour
- **TEE Anonymization**: Complete identity stripping
- **Content Hash**: Store content hash instead of plaintext

### Parameters

- **MIN_BROADCAST**: 10000000 (0.1 GAS)
- **SECONDS_PER_GAS**: 3600 (1 hour)
- **Content Length Limit**: 128 characters

### Contract Information

- **App ID**: `miniapp-dark-radio`
- **Version**: 1.0.0
- **Author**: R3E Network
