# MiniAppNeoCrash

## Overview

MiniAppNeoCrash is a multiplier crash game smart contract inspired by popular crypto gambling games. Players place bets before each round, watch a multiplier increase from 1.00x, and must cash out before the crash point to win. The crash point is determined by VRF for provable fairness.

## 中文说明

Neo 崩盘游戏 - 倍数崩盘博弈

### 功能特点

- 回合制投注系统
- 倍数从 1.00x 开始增长直到崩盘
- 玩家必须在崩盘前提现才能获胜
- 支持自动提现设置
- VRF 可证明公平的崩盘点
- 平台费用：5%

### 使用方法

1. 等待新一轮开始（投注阶段）
2. 下注并设置自动提现倍数
3. 管理员启动回合，倍数开始增长
4. 手动提现或等待自动提现触发
5. VRF 决定崩盘点，结算所有投注

### 投注限制

- **最小投注**：0.05 GAS
- **最大投注**：1000 GAS
- **最小倍数**：1.00x
- **最大倍数**：1000.00x
- **即时崩盘概率**：1%（庄家优势）

## English

### Features

- Round-based betting system
- Multiplier grows from 1.00x until crash
- Players must cash out before crash to win
- Auto-cashout option supported
- VRF provably fair crash point
- Platform fee: 5%

### Usage

1. Wait for new round to start (betting phase)
2. Place bet and set auto-cashout multiplier
3. Admin starts round, multiplier begins growing
4. Manually cash out or wait for auto-cashout
5. VRF determines crash point, settles all bets

### Betting Limits

- **Min Bet**: 0.05 GAS
- **Max Bet**: 1000 GAS
- **Min Multiplier**: 1.00x
- **Max Multiplier**: 1000.00x
- **Instant Crash**: 1% probability (house edge)

## Technical Details

### Contract Information

- **Contract**: MiniAppNeoCrash
- **Category**: Gaming / Gambling
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Platform Fee**: 5%

### Key Methods

#### User Methods

**PlaceBet(player, amount, autoCashout, receiptId)**

- Places bet for current round
- Must be in betting state
- Auto-cashout: target multiplier (e.g., 200 = 2.00x)
- Emits: CrashBetPlaced

**CashOut(player, currentMultiplier)**

- Player cashes out at current multiplier
- Must be in running state
- Cannot cash out if already cashed out
- Payout = amount _ multiplier _ 0.95
- Emits: CrashCashedOut

#### Admin Methods

**StartRound()**

- Starts the round (admin only)
- Changes state from BETTING to RUNNING
- Requests VRF for crash point
- Emits: CrashRoundStarted

### Data Structure

```csharp
struct CrashBet {
    UInt160 Player;
    BigInteger Amount;
    BigInteger AutoCashout;     // Multiplier * 100
    bool CashedOut;
    BigInteger CashoutMultiplier;
}
```

### Round States

- **STATE_BETTING (0)**: Players can place bets
- **STATE_RUNNING (1)**: Multiplier is increasing
- **STATE_CRASHED (2)**: Round ended, crash occurred

### Events

**CrashBetPlaced(player, amount, autoCashout, roundId)**

- Emitted when player places bet

**CrashCashedOut(player, payout, multiplier, roundId)**

- Emitted when player cashes out

**CrashRoundStarted(roundId, requestId)**

- Emitted when round starts and VRF requested

**CrashRoundEnded(crashPoint, roundId)**

- Emitted when crash point determined

## Game Mechanics

### Crash Point Calculation

The crash point uses exponential distribution:

- 1% chance of instant crash (1.00x)
- Formula: `99 / (100 - random % 100)`
- Range: 1.00x to 1000.00x
- House edge built into distribution

### Payout Calculation

```
Payout = BetAmount * Multiplier * (100 - PlatformFee) / 100
Payout = BetAmount * Multiplier * 0.95
```

### Auto-Cashout

Players can set auto-cashout multiplier:

- Automatically exits when multiplier reaches target
- Prevents missing the cash-out window
- Still subject to crash point (may crash before target)

## Strategy Guide

### Conservative Strategy

- Low auto-cashout (1.2x - 1.5x)
- High win rate, low profit per win
- Steady accumulation

### Aggressive Strategy

- High auto-cashout (5x - 10x+)
- Low win rate, high profit per win
- High risk, high reward

### Balanced Strategy

- Medium auto-cashout (2x - 3x)
- Moderate win rate and profit
- Risk-reward balance

## Integration

### VRF Service

Crash point determination:

- Admin starts round → VRF request
- VRF generates random bytes
- Callback calculates crash point
- Round ends, new round begins

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Access control enforcement
- VRF request routing
- Event monitoring for UI updates

## Security Considerations

- VRF ensures unpredictable crash points
- Bets locked once round starts
- Cannot cash out twice
- Admin cannot manipulate crash point
- House edge ensures long-term profitability

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
