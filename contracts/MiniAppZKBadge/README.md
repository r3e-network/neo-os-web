# MiniAppZKBadge | 匿名证明者

## Overview | 概述

**English**: Zero-knowledge badge system. Prove wealth or holdings without revealing your wallet address. TEE verifies balance and issues SBT (Soulbound Token) to a new address.

**中文**: 零知识徽章系统。在不透露钱包地址的情况下证明财富或持有量。TEE验证余额并向新地址发行SBT（灵魂绑定代币）。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppZKBadge`
- **App ID**: `miniapp-zk-badge`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Request Badge**: Submit proof hash and threshold amount
2. **TEE Verification**: Gateway verifies balance via TEE
3. **Badge Issuance**: SBT issued to recipient address if verified
4. **Privacy Preserved**: Original wallet never revealed
5. **Threshold Tiers**: Different badge types for different amounts

### 中文

1. **请求徽章**: 提交证明哈希和阈值金额
2. **TEE验证**: 网关通过TEE验证余额
3. **徽章发行**: 验证通过后向接收地址发行SBT
4. **隐私保护**: 原始钱包永不透露
5. **阈值等级**: 不同金额对应不同徽章类型

## Key Features | 核心特性

### English

- **Zero-Knowledge Proof**: Prove holdings without revealing wallet
- **TEE Verification**: Secure off-chain verification
- **Soulbound Tokens**: Non-transferable badges
- **Privacy First**: Original address never exposed
- **Threshold-Based**: Different tiers for different amounts

### 中文

- **零知识证明**: 在不透露钱包的情况下证明持有量
- **TEE验证**: 安全的链下验证
- **灵魂绑定代币**: 不可转让的徽章
- **隐私优先**: 原始地址永不暴露
- **基于阈值**: 不同金额对应不同等级

## Main Functions | 主要函数

### User Functions | 用户函数

#### `RequestBadge(recipient, proofHash, threshold, receiptId)`

**English**: Request a ZK badge.

- `recipient`: New address to receive badge
- `proofHash`: Zero-knowledge proof hash
- `threshold`: Minimum balance to prove
- `receiptId`: Payment receipt (0.5 GAS)

**中文**: 请求ZK徽章。

- `recipient`: 接收徽章的新地址
- `proofHash`: 零知识证明哈希
- `threshold`: 要证明的最低余额
- `receiptId`: 支付收据（0.5 GAS）

### Query Functions | 查询函数

#### `TotalBadges()`

**English**: Get total badges issued.

**中文**: 获取发行的徽章总数。

#### `GetBadgeType(badgeId)`

**English**: Get badge type/tier.

**中文**: 获取徽章类型/等级。

## Events | 事件

### `BadgeIssued`

**English**: Emitted when badge is issued.

**中文**: 发行徽章时触发。

## Economic Model | 经济模型

### English

- **Verification Fee**: 0.5 GAS per request
- **TEE Processing**: Off-chain verification
- **Soulbound**: Badges non-transferable
- **Privacy**: Original wallet never revealed

### 中文

- **验证费用**: 每次请求0.5 GAS
- **TEE处理**: 链下验证
- **灵魂绑定**: 徽章不可转让
- **隐私**: 原始钱包永不透露

## Use Cases | 使用场景

### English

1. **Anonymous Wealth Proof**: Prove holdings without doxxing
2. **Private Credentials**: Verify status anonymously
3. **Whale Badges**: Exclusive badges for large holders
4. **Privacy-First Identity**: Build reputation without exposure

### 中文

1. **匿名财富证明**: 在不暴露身份的情况下证明持有量
2. **私密凭证**: 匿名验证状态
3. **巨鲸徽章**: 大户专属徽章
4. **隐私优先身份**: 在不暴露的情况下建立声誉
