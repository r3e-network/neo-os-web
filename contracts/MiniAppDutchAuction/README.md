# MiniAppDutchAuction | 荷兰拍卖

## Overview | 概述

**English**: Dutch auction system where price drops over time until someone purchases. Price starts high and decreases linearly until the end price or until someone buys.

**中文**: 荷兰拍卖系统，价格随时间下降直到有人购买。价格从高位开始线性下降至底价或直到有人购买。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppDutchAuction`
- **App ID**: `miniapp-dutch-auction`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Auction Creation**: Admin creates auction with start price, end price, and duration
2. **Price Decay**: Price drops linearly from start to end over duration
3. **First Come First Served**: First buyer at current price wins
4. **Platform Fee**: 5% fee on final sale price

### 中文

1. **拍卖创建**: 管理员创建拍卖，设置起始价、底价和持续时间
2. **价格衰减**: 价格在持续时间内从起始价线性下降至底价
3. **先到先得**: 第一个按当前价格购买的买家获胜
4. **平台费用**: 最终成交价的5%费用

## Key Features | 核心特性

### English

- **Reverse Auction**: Price decreases over time
- **Linear Decay**: Predictable price drop formula
- **Instant Settlement**: Purchase completes immediately
- **Time-Based**: Duration-controlled auctions

### 中文

- **反向拍卖**: 价格随时间递减
- **线性衰减**: 可预测的价格下降公式
- **即时结算**: 购买立即完成
- **基于时间**: 持续时间控制的拍卖

## Main Functions | 主要函数

### Admin Functions | 管理员函数

#### `CreateAuction(startPrice, endPrice, duration)`

**English**: Create a new Dutch auction.

- `startPrice`: Starting price (must be > endPrice)
- `endPrice`: Minimum price
- `duration`: Auction duration in seconds

**中文**: 创建新的荷兰拍卖。

- `startPrice`: 起始价格（必须 > 底价）
- `endPrice`: 最低价格
- `duration`: 拍卖持续时间（秒）

### User Functions | 用户函数

#### `Purchase(buyer, auctionId, receiptId)`

**English**: Purchase item at current price.

- `buyer`: Buyer address
- `auctionId`: Auction ID
- `receiptId`: Payment receipt ID

**中文**: 按当前价格购买物品。

- `buyer`: 买家地址
- `auctionId`: 拍卖ID
- `receiptId`: 支付收据ID

### Query Functions | 查询函数

#### `GetCurrentPrice(auctionId)`

**English**: Calculate current price based on elapsed time.

**中文**: 根据已过时间计算当前价格。

#### `GetAuction(auctionId)`

**English**: Get auction details.

**中文**: 获取拍卖详情。

## Events | 事件

### `AuctionCreated`

**English**: Emitted when auction is created.

**中文**: 创建拍卖时触发。

### `AuctionPurchased`

**English**: Emitted when item is purchased.

**中文**: 购买物品时触发。

## Economic Model | 经济模型

### English

- **Price Formula**: `currentPrice = startPrice - (startPrice - endPrice) * elapsed / duration`
- **Platform Fee**: 5% of final price
- **Single Winner**: Only one buyer per auction

### 中文

- **价格公式**: `当前价格 = 起始价 - (起始价 - 底价) * 已过时间 / 持续时间`
- **平台费用**: 最终价格的5%
- **单一赢家**: 每次拍卖只有一个买家

## Use Cases | 使用场景

### English

1. **NFT Sales**: Sell NFTs with declining price
2. **Token Distribution**: Fair price discovery
3. **Limited Items**: Sell scarce items efficiently
4. **Price Discovery**: Market-driven pricing

### 中文

1. **NFT销售**: 以递减价格出售NFT
2. **代币分发**: 公平价格发现
3. **限量物品**: 高效出售稀缺物品
4. **价格发现**: 市场驱动定价
