# MiniAppGovMerc

## 中文说明

### 概述

众筹算力（治理雇佣兵）是一个投票权租赁市场，NEO 持有者将投票权出租给出价最高的竞标者，实现治理权的市场化交易。

### 核心机制

- **投票权池化**：用户存入 NEO 形成投票权池
- **竞价拍卖**：候选人竞标租用投票权
- **周期结算**：每周结算一次，最高出价者获胜
- **收益分配**：竞标费用分配给 NEO 存款人

### 主要功能

#### 1. 存入 NEO (DepositNeo)

```csharp
public static void DepositNeo(UInt160 depositor, BigInteger amount)
```

- 存入 NEO 到投票权池
- 获得对应份额
- 触发 `MercDeposit` 事件

#### 2. 竞标投票权 (PlaceBid)

```csharp
public static void PlaceBid(UInt160 candidate, BigInteger bidAmount, BigInteger receiptId)
```

- 支付 GAS 竞标当前周期投票权
- 累积竞标金额
- 触发 `BidPlaced` 事件

#### 3. 提取 NEO (WithdrawNeo)

```csharp
public static void WithdrawNeo(UInt160 depositor, BigInteger amount)
```

- 从池中提取 NEO
- 减少投票权份额

### 使用场景

1. **治理市场化**：投票权自由交易
2. **被动收益**：NEO 持有者赚取租金
3. **竞选融资**：候选人租用投票权
4. **流动民主**：灵活的治理参与方式

### 技术特性

- **周期制度**：1 周为一个竞标周期
- **透明竞价**：所有竞标公开可查
- **自动结算**：周期结束自动分配收益
- **灵活存取**：随时存取 NEO

### 参数说明

- **EPOCH_DURATION**: 604800 (1 周)
- **最低存款**: 无限制
- **最低竞标**: 无限制

---

## English Description

### Overview

Governance Mercenary is a voting power rental market where NEO holders rent their voting rights to the highest bidder, enabling marketized governance power trading.

### Core Mechanics

- **Voting Power Pool**: Users deposit NEO to form voting power pool
- **Competitive Auction**: Candidates bid to rent voting power
- **Periodic Settlement**: Settle once per week, highest bidder wins
- **Revenue Distribution**: Bid fees distributed to NEO depositors

### Main Functions

#### 1. Deposit NEO

```csharp
public static void DepositNeo(UInt160 depositor, BigInteger amount)
```

- Deposit NEO into voting power pool
- Receive corresponding shares
- Triggers `MercDeposit` event

#### 2. Place Bid

```csharp
public static void PlaceBid(UInt160 candidate, BigInteger bidAmount, BigInteger receiptId)
```

- Pay GAS to bid for current epoch voting power
- Accumulate bid amount
- Triggers `BidPlaced` event

#### 3. Withdraw NEO

```csharp
public static void WithdrawNeo(UInt160 depositor, BigInteger amount)
```

- Withdraw NEO from pool
- Reduce voting power shares

### Use Cases

1. **Governance Marketization**: Free trading of voting rights
2. **Passive Income**: NEO holders earn rental fees
3. **Campaign Financing**: Candidates rent voting power
4. **Liquid Democracy**: Flexible governance participation

### Technical Features

- **Epoch System**: 1 week per bidding epoch
- **Transparent Bidding**: All bids publicly queryable
- **Auto Settlement**: Automatic revenue distribution at epoch end
- **Flexible Access**: Deposit/withdraw NEO anytime

### Parameters

- **EPOCH_DURATION**: 604800 (1 week)
- **Minimum Deposit**: No limit
- **Minimum Bid**: No limit

### Contract Information

- **App ID**: `miniapp-gov-merc`
- **Version**: 1.0.0
- **Author**: R3E Network
