# MiniAppCandleWars | 蜡烛战争

## Overview | 概述

**English**: Binary options game where players bet on whether the next price candle will be green (up) or red (down). Players pool their bets, and winners split the losing side's pool proportionally.

**中文**: 二元期权游戏，玩家押注下一根K线是绿色（上涨）还是红色（下跌）。玩家汇集赌注，获胜方按比例分配失败方的奖池。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppCandleWars`
- **App ID**: `miniapp-candle-wars`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Betting Phase**: Players place bets on green (bullish) or red (bearish) outcome
2. **Minimum Bet**: 0.05 GAS per bet
3. **Pool Accumulation**: All bets accumulate in separate green and red pools
4. **Round Resolution**: Admin closes betting and resolves based on actual price movement
5. **Winner Distribution**: Winning side splits the total pool (minus 5% platform fee)

### 中文

1. **下注阶段**: 玩家押注绿色（看涨）或红色（看跌）结果
2. **最低赌注**: 每次下注 0.05 GAS
3. **奖池累积**: 所有赌注累积到独立的绿色和红色奖池
4. **回合结算**: 管理员关闭下注并根据实际价格走势结算
5. **赢家分配**: 获胜方分配总奖池（扣除5%平台费）

## Key Features | 核心特性

### English

- **Binary Options**: Simple up/down prediction game
- **Pool-Based Betting**: All bets pooled together for fair distribution
- **Round System**: Discrete betting rounds with clear start/end
- **Platform Fee**: 5% fee on total pool
- **Real-Time Pools**: Track green and red pool sizes in real-time

### 中文

- **二元期权**: 简单的涨跌预测游戏
- **奖池制下注**: 所有赌注汇集以公平分配
- **回合系统**: 明确开始/结束的离散下注回合
- **平台费用**: 总奖池的5%费用
- **实时奖池**: 实时追踪绿色和红色奖池大小

## Main Functions | 主要函数

### User Functions | 用户函数

#### `PlaceBet(player, amount, isGreen, receiptId)`

**English**: Place a bet on green (bullish) or red (bearish) outcome.

- `player`: Player address
- `amount`: Bet amount (minimum 0.05 GAS)
- `isGreen`: true for green/up, false for red/down
- `receiptId`: Payment receipt ID

**中文**: 押注绿色（看涨）或红色（看跌）结果。

- `player`: 玩家地址
- `amount`: 下注金额（最低 0.05 GAS）
- `isGreen`: true表示绿色/上涨，false表示红色/下跌
- `receiptId`: 支付收据ID

### Admin Functions | 管理员函数

#### `CloseBetting()`

**English**: Close betting for current round (admin only).

**中文**: 关闭当前回合的下注（仅管理员）。

#### `ResolveRound(isGreen)`

**English**: Resolve the round with actual outcome (gateway only).

- `isGreen`: true if candle was green, false if red

**中文**: 用实际结果结算回合（仅网关）。

- `isGreen`: 如果K线为绿色则为true，红色则为false

### Query Functions | 查询函数

#### `CurrentRound()`

**English**: Get current round number.

**中文**: 获取当前回合编号。

#### `GreenPool()`

**English**: Get total amount in green pool.

**中文**: 获取绿色奖池总金额。

#### `RedPool()`

**English**: Get total amount in red pool.

**中文**: 获取红色奖池总金额。

#### `IsBettingOpen()`

**English**: Check if betting is currently open.

**中文**: 检查当前是否开放下注。

## Events | 事件

### `CandleBetPlaced`

**English**: Emitted when a player places a bet.

- `player`: Player address
- `amount`: Bet amount
- `isGreen`: Bet direction
- `roundId`: Round number

**中文**: 玩家下注时触发。

- `player`: 玩家地址
- `amount`: 下注金额
- `isGreen`: 下注方向
- `roundId`: 回合编号

### `CandleRoundResolved`

**English**: Emitted when a round is resolved.

- `isGreen`: Winning outcome
- `greenPool`: Total green pool
- `redPool`: Total red pool
- `roundId`: Round number

**中文**: 回合结算时触发。

- `isGreen`: 获胜结果
- `greenPool`: 绿色奖池总额
- `redPool`: 红色奖池总额
- `roundId`: 回合编号

## Economic Model | 经济模型

### English

- **Minimum Bet**: 0.05 GAS
- **Platform Fee**: 5% of total pool
- **Payout**: Proportional to bet size within winning pool
- **Round-Based**: Each round is independent

### 中文

- **最低赌注**: 0.05 GAS
- **平台费用**: 总奖池的5%
- **支付**: 按获胜奖池内的赌注大小比例分配
- **基于回合**: 每个回合独立

## Security Features | 安全特性

### English

- Gateway-only round resolution
- Betting lock mechanism
- Payment receipt validation
- Global pause support

### 中文

- 仅网关可结算回合
- 下注锁定机制
- 支付收据验证
- 全局暂停支持

## Use Cases | 使用场景

### English

1. **Price Prediction**: Short-term price movement speculation
2. **Trading Game**: Gamified trading experience
3. **Community Events**: Organized prediction competitions
4. **Market Sentiment**: Gauge community bullish/bearish sentiment

### 中文

1. **价格预测**: 短期价格走势投机
2. **交易游戏**: 游戏化交易体验
3. **社区活动**: 组织预测竞赛
4. **市场情绪**: 衡量社区看涨/看跌情绪
