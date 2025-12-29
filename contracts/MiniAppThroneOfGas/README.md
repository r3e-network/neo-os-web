# MiniAppThroneOfGas | GAS 王座

## Overview | 概述

**English**: King of the hill game where players compete to claim the throne by paying more than the current king. The king earns taxes from each new claim.

**中文**: 山丘之王游戏，玩家通过支付比当前国王更多的金额来竞争王座。国王从每次新的王位争夺中赚取税收。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppThroneOfGas`
- **App ID**: `miniapp-throne-of-gas`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Claim Throne**: Pay 110% of current price to become king
2. **Tax Collection**: Current king earns 10% tax on new claims
3. **Price Escalation**: Price increases with each claim
4. **Continuous Game**: No rounds, ongoing competition

### 中文

1. **夺取王座**: 支付当前价格的110%成为国王
2. **税收征收**: 当前国王从新的王位争夺中赚取10%税收
3. **价格上涨**: 价格随每次争夺而增加
4. **持续游戏**: 无回合，持续竞争

## Key Features | 核心特性

### English

- **King of the Hill**: Competitive throne claiming
- **Tax Earnings**: Kings earn from challengers
- **Price Escalation**: 110% minimum increase
- **Public Leaderboard**: Track current king

### 中文

- **山丘之王**: 竞争性王座争夺
- **税收收入**: 国王从挑战者处赚取
- **价格上涨**: 最低110%增幅
- **公开排行榜**: 追踪当前国王

## Main Functions | 主要函数

### User Functions | 用户函数

#### `ClaimThrone(player, bid, receiptId)`

**English**: Claim the throne by paying more than current price.

- `player`: Player address
- `bid`: Bid amount (must be >= 110% of current price)
- `receiptId`: Payment receipt ID

**中文**: 通过支付高于当前价格来夺取王座。

- `player`: 玩家地址
- `bid`: 出价金额（必须 >= 当前价格的110%）
- `receiptId`: 支付收据ID

### Query Functions | 查询函数

#### `CurrentKing()`

**English**: Get current king's address.

**中文**: 获取当前国王地址。

#### `ThronePrice()`

**English**: Get current throne price.

**中文**: 获取当前王座价格。

#### `KingEarnings()`

**English**: Get current king's accumulated earnings.

**中文**: 获取当前国王的累积收入。

## Events | 事件

### `ThroneClaimed`

**English**: Emitted when throne is claimed.

**中文**: 夺取王座时触发。

### `TaxCollected`

**English**: Emitted when king collects tax.

**中文**: 国王征收税收时触发。

## Economic Model | 经济模型

### English

- **Initial Price**: 1 GAS
- **Minimum Increase**: 110% of current price
- **Tax Rate**: 10% to current king
- **No Time Limit**: Throne held until claimed

### 中文

- **初始价格**: 1 GAS
- **最低增幅**: 当前价格的110%
- **税率**: 10%归当前国王
- **无时间限制**: 王座持有直到被夺取
