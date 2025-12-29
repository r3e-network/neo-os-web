# MiniAppTimeCapsule | 时间胶囊

## Overview | 概述

**English**: TEE-encrypted time capsule system. Bury encrypted messages that unlock after a specific time. Public capsules can be discovered by others through "fishing".

**中文**: TEE加密时间胶囊系统。埋藏加密消息，在特定时间后解锁。公开胶囊可以通过"钓鱼"被他人发现。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppTimeCapsule`
- **App ID**: `miniapp-time-capsule`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Bury Capsule**: Store encrypted content with unlock time
2. **Public/Private**: Choose visibility (public can be fished)
3. **Time Lock**: Content unlocks after specified time
4. **Fishing**: Discover random public capsules
5. **Reveal**: View content after unlock time

### 中文

1. **埋藏胶囊**: 存储带解锁时间的加密内容
2. **公开/私密**: 选择可见性（公开可被钓鱼）
3. **时间锁**: 内容在指定时间后解锁
4. **钓鱼**: 发现随机公开胶囊
5. **揭示**: 解锁时间后查看内容

## Key Features | 核心特性

### English

- **TEE Encryption**: Content encrypted until unlock
- **Time-Based Unlock**: Automatic unlock at specified time
- **Public Discovery**: Fish for random capsules
- **Privacy Options**: Public or private capsules
- **Permanent Storage**: On-chain message storage

### 中文

- **TEE加密**: 内容加密直到解锁
- **基于时间解锁**: 在指定时间自动解锁
- **公开发现**: 钓取随机胶囊
- **隐私选项**: 公开或私密胶囊
- **永久存储**: 链上消息存储

## Main Functions | 主要函数

### User Functions | 用户函数

#### `Bury(owner, contentHash, unlockTime, isPublic, receiptId)`

**English**: Bury a new time capsule.

- `owner`: Owner address
- `contentHash`: Encrypted content hash
- `unlockTime`: Unix timestamp for unlock
- `isPublic`: true for public, false for private
- `receiptId`: Payment receipt (0.2 GAS)

**中文**: 埋藏新时间胶囊。

- `owner`: 所有者地址
- `contentHash`: 加密内容哈希
- `unlockTime`: 解锁的Unix时间戳
- `isPublic`: true为公开，false为私密
- `receiptId`: 支付收据（0.2 GAS）

#### `Reveal(revealer, capsuleId)`

**English**: Reveal capsule content after unlock time.

- `revealer`: Revealer address
- `capsuleId`: Capsule ID

**中文**: 解锁时间后揭示胶囊内容。

- `revealer`: 揭示者地址
- `capsuleId`: 胶囊ID

#### `Fish(fisher, receiptId)`

**English**: Fish for a random public capsule.

- `fisher`: Fisher address
- `receiptId`: Payment receipt (0.05 GAS)

**中文**: 钓取随机公开胶囊。

- `fisher`: 钓鱼者地址
- `receiptId`: 支付收据（0.05 GAS）

### Query Functions | 查询函数

#### `TotalCapsules()`

**English**: Get total capsules created.

**中文**: 获取创建的胶囊总数。

#### `UnlockTime(capsuleId)`

**English**: Get capsule unlock time.

**中文**: 获取胶囊解锁时间。

#### `IsRevealed(capsuleId)`

**English**: Check if capsule has been revealed.

**中文**: 检查胶囊是否已揭示。

## Events | 事件

### `CapsuleBuried`

**English**: Emitted when capsule is buried.

**中文**: 埋藏胶囊时触发。

### `CapsuleRevealed`

**English**: Emitted when capsule is revealed.

**中文**: 揭示胶囊时触发。

### `CapsuleFished`

**English**: Emitted when capsule is fished.

**中文**: 钓到胶囊时触发。

## Economic Model | 经济模型

### English

- **Bury Fee**: 0.2 GAS per capsule
- **Fish Fee**: 0.05 GAS per attempt
- **No Expiry**: Capsules stored permanently
- **Public Discovery**: Random fishing mechanism

### 中文

- **埋藏费用**: 每个胶囊0.2 GAS
- **钓鱼费用**: 每次尝试0.05 GAS
- **无过期**: 胶囊永久存储
- **公开发现**: 随机钓鱼机制

## Use Cases | 使用场景

### English

1. **Future Messages**: Send messages to future self
2. **Time Capsules**: Store memories for later
3. **Secret Reveals**: Timed secret announcements
4. **Social Discovery**: Find random messages from others

### 中文

1. **未来消息**: 向未来的自己发送消息
2. **时间胶囊**: 存储记忆供以后使用
3. **秘密揭示**: 定时秘密公告
4. **社交发现**: 发现他人的随机消息
