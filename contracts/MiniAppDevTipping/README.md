# MiniAppDevTipping | 开发者打赏

## Overview | 概述

**English**: EcoBoost - CoreDev Tipping Station. A platform for supporting ecosystem developers through direct GAS tips. Admin registers developers, users send tips with messages, and developers can withdraw accumulated funds.

**中文**: EcoBoost - 核心开发者打赏站。通过直接GAS打赏支持生态系统开发者的平台。管理员注册开发者，用户发送带消息的打赏，开发者可以提取累积资金。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppDevTipping`
- **App ID**: `miniapp-dev-tipping`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Developer Registration**: Admin registers developers with wallet, name, and role
2. **Tipping**: Users send GAS tips to registered developers with optional messages
3. **Tipper Ranking**: Track top tippers by name and total contributions
4. **Withdrawal**: Developers withdraw accumulated tips to their registered wallet
5. **Statistics**: Track total donations, tip counts, and developer rankings

### 中文

1. **开发者注册**: 管理员用钱包、姓名和角色注册开发者
2. **打赏**: 用户向注册开发者发送GAS打赏，可附带消息
3. **打赏者排名**: 按姓名和总贡献追踪顶级打赏者
4. **提现**: 开发者将累积打赏提取到注册钱包
5. **统计**: 追踪总捐赠、打赏次数和开发者排名

## Key Features | 核心特性

### English

- **Direct Support**: Send GAS directly to ecosystem builders
- **Developer Profiles**: Name, role, and wallet information
- **Tipper Recognition**: Public leaderboard of top supporters
- **Message System**: Attach messages to tips
- **Transparent Stats**: Track all donations and tip counts
- **Minimum Tip**: 0.001 GAS minimum to prevent spam

### 中文

- **直接支持**: 直接向生态系统建设者发送GAS
- **开发者档案**: 姓名、角色和钱包信息
- **打赏者认可**: 顶级支持者公开排行榜
- **消息系统**: 在打赏中附加消息
- **透明统计**: 追踪所有捐赠和打赏次数
- **最低打赏**: 0.001 GAS最低额度防止垃圾信息

## Main Functions | 主要函数

### Admin Functions | 管理员函数

#### `RegisterDeveloper(wallet, name, role)`

**English**: Register a new developer (admin only).

- `wallet`: Developer's wallet address
- `name`: Developer name (max 64 chars)
- `role`: Developer role/title (max 64 chars)

**中文**: 注册新开发者（仅管理员）。

- `wallet`: 开发者钱包地址
- `name`: 开发者姓名（最多64字符）
- `role`: 开发者角色/职位（最多64字符）

### User Functions | 用户函数

#### `Tip(tipper, devId, amount, message, tipperName, anonymous, receiptId)`

**English**: Send a tip to a developer.

- `tipper`: Tipper address
- `devId`: Developer ID
- `amount`: Tip amount (minimum 0.001 GAS)
- `message`: Optional message (max 256 chars)
- `tipperName`: Display name (max 64 chars, uses address if empty)
- `anonymous`: Whether to hide tipper identity
- `receiptId`: Payment receipt ID

**中文**: 向开发者发送打赏。

- `tipper`: 打赏者地址
- `devId`: 开发者ID
- `amount`: 打赏金额（最低0.001 GAS）
- `message`: 可选消息（最多256字符）
- `tipperName`: 显示名称（最多64字符，为空则使用地址）
- `anonymous`: 是否匿名打赏
- `receiptId`: 支付收据ID

#### `Withdraw(devId)`

**English**: Withdraw accumulated tips (developer only).

- `devId`: Developer ID

**中文**: 提取累积打赏（仅开发者）。

- `devId`: 开发者ID

### Query Functions | 查询函数

#### `TotalDevelopers()`

**English**: Get total number of registered developers.

**中文**: 获取注册开发者总数。

#### `TotalDonated()`

**English**: Get total amount donated across all developers.

**中文**: 获取所有开发者的总捐赠金额。

#### `GetDeveloperDetails(devId)`

**English**: Get developer profile + tip stats in one call.

- `name`, `role`, `wallet`
- `balance`, `totalReceived`, `tipCount`
- `active`, `bio`, `link`

**中文**: 一次获取开发者资料与打赏统计。

#### `GetTipperTotal(tipperName)`

**English**: Get total amount tipped by a specific tipper.

**中文**: 获取特定打赏者的总打赏金额。

## Events | 事件

### `DeveloperRegistered`

**English**: Emitted when a new developer is registered.

**中文**: 注册新开发者时触发。

### `TipSent`

**English**: Emitted when a tip is sent.

**中文**: 发送打赏时触发。

### `TipWithdrawn`

**English**: Emitted when a developer withdraws tips.

**中文**: 开发者提取打赏时触发。

## Economic Model | 经济模型

### English

- **Minimum Tip**: 0.001 GAS
- **No Platform Fee**: 100% goes to developers
- **Instant Accumulation**: Tips immediately added to developer balance
- **On-Demand Withdrawal**: Developers withdraw anytime

### 中文

- **最低打赏**: 0.001 GAS
- **无平台费用**: 100%归开发者
- **即时累积**: 打赏立即添加到开发者余额
- **按需提现**: 开发者随时提现

## Use Cases | 使用场景

### English

1. **Ecosystem Support**: Fund core developers and contributors
2. **Appreciation**: Thank developers for specific features
3. **Community Building**: Foster developer-community relationships
4. **Transparent Funding**: Public record of all contributions

### 中文

1. **生态系统支持**: 资助核心开发者和贡献者
2. **感谢**: 感谢开发者的特定功能
3. **社区建设**: 培养开发者-社区关系
4. **透明资金**: 所有贡献的公开记录
