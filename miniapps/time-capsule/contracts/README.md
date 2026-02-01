# MiniAppTimeCapsule | 时间胶囊

## Overview | 概述

**English**: Time-locked hash vault. The contract stores message hashes and metadata on-chain while the full message stays off-chain (client-local storage). Public capsules can be fished after unlock.

**中文**: 时间锁定哈希存储。合约只保存消息哈希与元数据，完整消息保存在客户端本地。公开胶囊到期后可被打捞。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppTimeCapsule`
- **App ID**: `miniapp-time-capsule`
- **Version**: 3.0.0
- **Author**: R3E Network

## Core Mechanics | 核心机制

### English

1. **Bury Capsule**: Store content hash, title, category, and unlock time.
2. **Public / Private**: Public capsules can be fished; private capsules can add recipients.
3. **Time Lock**: Capsules unlock after the specified timestamp.
4. **Reveal**: Owner, recipient, or public (if public) can reveal after unlock.
5. **Fishing**: Pay to discover a random unlocked public capsule. Reward is paid only if contract balance allows.
6. **Gift / Extend**: Pay to gift a capsule or extend its unlock time.

### 中文

1. **埋藏胶囊**: 存储内容哈希、标题、类别与解锁时间。
2. **公开 / 私密**: 公开胶囊可被打捞；私密胶囊可添加收件人。
3. **时间锁**: 到指定时间解锁。
4. **揭示**: 解锁后由所有者、收件人或公开用户揭示。
5. **打捞**: 付费随机打捞已解锁的公开胶囊，奖励在合约余额充足时发放。
6. **赠送 / 延期**: 付费赠送胶囊或延长解锁时间。

## Key Features | 核心特性

### English

- **Hash-only storage**: Only hashes and metadata on-chain.
- **Local content**: Full messages remain on the client.
- **Public fishing**: Discover public capsules after unlock.
- **Recipients**: Add recipients to private capsules.
- **User stats**: Track activity and spending/earning.

### 中文

- **仅存哈希**: 链上保存哈希与元数据。
- **本地内容**: 完整消息保留在客户端。
- **公开打捞**: 解锁后可发现公开胶囊。
- **收件人**: 私密胶囊可添加收件人。
- **用户统计**: 统计活动与支出/收益。

## Main Functions | 主要函数

### User Functions | 用户函数

#### `Bury(owner, contentHash, title, unlockTime, isPublic, category, receiptId)`

- **Fee**: 0.2 GAS
- **Category**: 1=personal, 2=gift, 3=memorial, 4=announcement, 5=secret
- **Lock Duration**: 1 day to 10 years (min/max enforced)

#### `Reveal(revealer, capsuleId)`

Reveal a capsule after unlock time. Allowed for owner, recipients, or anyone if public.

#### `Fish(fisher, receiptId)`

- **Fee**: 0.05 GAS
- **Reward**: 0.02 GAS if contract balance allows

#### `AddRecipient(capsuleId, recipient)`

Add a recipient to a private capsule.

#### `ExtendUnlockTime(capsuleId, newUnlockTime, receiptId)`

- **Fee**: 0.1 GAS
- Extends the unlock time up to the max duration.

#### `GiftCapsule(capsuleId, newOwner, receiptId)`

- **Fee**: 0.15 GAS
- Transfers ownership to a new address.

### Admin Functions | 管理函数

#### `WithdrawFees(recipient, amount)`

Withdraw collected GAS fees.

#### `Update(nef, manifest, data)`

Upgrade contract code (admin only).

### Query Functions | 查询函数

- `GetCapsuleDetails(capsuleId)`
- `GetUserStatsDetails(user)`
- `GetPlatformStats()`
- `GetCategoryStats()`
- `TotalCapsules()`, `TotalPublicCapsules()`, `TotalRevealed()`, `TotalFished()`, `TotalGifted()`

## Events | 事件

- `CapsuleBuried`
- `CapsuleRevealed`
- `CapsuleFished`
- `CapsuleGifted`
- `CapsuleExtended`
- `RecipientAdded`

## Economic Model | 经济模型

### English

- **Bury Fee**: 0.2 GAS
- **Fish Fee**: 0.05 GAS
- **Extend Fee**: 0.1 GAS
- **Gift Fee**: 0.15 GAS
- **Fish Reward**: 0.02 GAS if contract balance allows
- **Permanent Records**: Hashes stored on-chain indefinitely

### 中文

- **埋藏费用**: 0.2 GAS
- **打捞费用**: 0.05 GAS
- **延期费用**: 0.1 GAS
- **赠送费用**: 0.15 GAS
- **打捞奖励**: 0.02 GAS（合约余额充足时）
- **永久记录**: 哈希永久保存在链上

## Privacy Notes | 隐私说明

### English

- The contract does **not** store full message content.
- Clients should store and optionally encrypt the full message off-chain.

### 中文

- 合约**不**保存完整消息内容。
- 客户端需离线保存，并可自行加密完整消息。

## Use Cases | 使用场景

### English

1. Future messages to yourself
2. Time-locked announcements
3. Public discovery through fishing

### 中文

1. 给未来自己的留言
2. 定时公开或私密揭示
3. 公开胶囊的随机发现
