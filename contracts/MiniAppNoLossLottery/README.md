# MiniAppNoLossLottery

## Overview

MiniAppNoLossLottery is a no-loss lottery smart contract where players stake GAS to enter, winners receive yield rewards, and everyone keeps their principal. This implements a PoolTogether-style lottery mechanism where the risk is eliminated.

## 中文说明

无损彩票 - 零风险收益抽奖

### 功能特点

- 质押 GAS 参与抽奖
- 赢家获得收益奖励
- 所有人保留本金
- 收益率：5% APY
- VRF 公平抽奖

### 使用方法

1. 质押任意数量 GAS 进入奖池
2. 等待管理员发起抽奖
3. VRF 随机选择赢家
4. 赢家获得总质押的 5% 作为奖励
5. 随时可以提取本金

### 经济模型

- **质押收益**：5% 年化收益
- **奖池分配**：赢家获得所有收益
- **本金保护**：100% 可提取
- **无损失**：未中奖者不损失任何资金

## English

### Features

- Stake GAS to enter lottery
- Winners receive yield rewards
- Everyone keeps principal
- Yield rate: 5% APY
- VRF fair drawing

### Usage

1. Stake any amount of GAS to enter pool
2. Wait for admin to initiate draw
3. VRF randomly selects winner
4. Winner receives 5% of total staked as prize
5. Withdraw principal anytime

### Economic Model

- **Staking Yield**: 5% APY
- **Prize Distribution**: Winner takes all yield
- **Principal Protection**: 100% withdrawable
- **No Loss**: Non-winners lose nothing

## Technical Details

### Contract Information

- **Contract**: MiniAppNoLossLottery
- **Category**: DeFi / Lottery
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Yield Rate**: 5%

### Key Methods

#### User Methods

**Stake(player, amount, receiptId)**

- Stakes GAS to enter lottery
- Increases player's stake balance
- Updates total staked amount
- Emits: LotteryStaked

**Withdraw(player)**

- Withdraws all staked GAS
- Returns principal to player
- Decreases total staked amount
- Emits: LotteryWithdrawn

#### Admin Methods

**InitiateDraw()**

- Starts lottery draw (admin only)
- Requires total staked > 0
- Requests VRF for winner selection
- Emits: LotteryWinner (via callback)

### Events

**LotteryStaked(player, amount, roundId)**

- Emitted when player stakes

**LotteryWithdrawn(player, amount)**

- Emitted when player withdraws

**LotteryWinner(winner, prize, roundId)**

- Emitted when winner is selected

## Game Mechanics

### Prize Calculation

```
Prize = TotalStaked * YieldRate / 100
Prize = TotalStaked * 0.05
```

### Winner Selection

- VRF generates random number
- Winner selected from stakers (weighted by stake)
- Higher stake = higher chance to win
- Prize paid from yield, not principal

### Withdrawal Rules

- Can withdraw anytime
- No lock-up period
- No penalty for withdrawal
- Withdrawing removes from next draw

## Use Cases

### Risk-Free Savings

- Earn chance at rewards without risk
- Alternative to traditional savings
- Gamification of DeFi yields

### Community Pools

- Group savings with lottery element
- Social DeFi experience
- Collective yield generation

## Integration

### VRF Service

Winner selection process:

- Admin initiates draw
- VRF generates random bytes
- Callback selects winner
- Prize distributed automatically

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Access control enforcement
- VRF request routing
- Event monitoring

## Security Considerations

- Principal always protected
- VRF ensures fair winner selection
- No admin control over winner
- Yield calculation transparent
- Withdrawal always available

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
