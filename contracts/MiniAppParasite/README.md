# MiniAppParasite

## Overview

MiniAppParasite is a DeFi staking contract with PvP attack mechanics. Players stake GAS to earn yields, but can also attack other players to steal their accumulated rewards. This creates a high-risk, high-reward competitive staking environment.

## 中文说明

寄生虫 - PvP 攻击质押系统

### 功能特点

- 质押 GAS 赚取收益（50% APY）
- 攻击其他玩家窃取奖励
- 攻击成功率：40%
- 攻击成本：2 GAS
- 成功窃取目标 50% 奖励

### 使用方法

1. 质押 GAS 开始赚取收益
2. 选择目标玩家发起攻击
3. 支付 2 GAS 攻击费用
4. VRF 决定攻击是否成功
5. 成功则窃取目标 50% 奖励
6. 随时提取本金和奖励

### 攻击机制

- **攻击成本**：2 GAS 固定费用
- **成功率**：40%（VRF 随机）
- **窃取比例**：目标奖励的 50%
- **防御**：无主动防御机制
- **策略**：频繁提现 vs 积累奖励

## English

### Features

- Stake GAS to earn yields (50% APY)
- Attack other players to steal rewards
- Attack success rate: 40%
- Attack cost: 2 GAS
- Steal 50% of target's rewards on success

### Usage

1. Stake GAS to start earning yields
2. Select target player to attack
3. Pay 2 GAS attack fee
4. VRF determines attack success
5. Steal 50% of target's rewards if successful
6. Withdraw principal and rewards anytime

### Attack Mechanics

- **Attack Cost**: 2 GAS fixed fee
- **Success Rate**: 40% (VRF random)
- **Steal Ratio**: 50% of target's rewards
- **Defense**: No active defense mechanism
- **Strategy**: Frequent withdrawal vs reward accumulation

## Technical Details

### Contract Information

- **Contract**: MiniAppParasite
- **Category**: DeFi / PvP
- **Permissions**: Gateway integration
- **Assets**: GAS
- **APY**: 50%
- **Platform Fee**: 5%

### Key Methods

#### User Methods

**Stake(player, amount, receiptId)**

- Stakes GAS to earn yields
- Updates stake balance
- Records last update timestamp
- Emits: ParasiteStaked

**Withdraw(player)**

- Withdraws all stake and rewards
- Returns total balance to player
- Resets stake and rewards to zero
- Emits: ParasiteWithdrawn

**Attack(attacker, target, receiptId)**

- Initiates attack on target player
- Cost: 2 GAS
- Requests VRF for outcome
- Emits: ParasiteAttack (via callback)

### Data Storage

```
PREFIX_STAKE: player → staked amount
PREFIX_REWARDS: player → accumulated rewards
PREFIX_LAST_UPDATE: player → last update timestamp
```

### Events

**ParasiteStaked(player, amount)**

- Emitted when player stakes

**ParasiteWithdrawn(player, amount)**

- Emitted when player withdraws

**ParasiteAttack(attacker, target, stolen, success)**

- Emitted when attack completes
- `stolen`: amount stolen (0 if failed)
- `success`: true if attack succeeded

## Game Mechanics

### Yield Calculation

```
Yield = StakedAmount * APY * TimeElapsed / Year
Yield = StakedAmount * 0.50 * TimeElapsed / 31536000000
```

### Attack Outcome

VRF determines success:

- Random byte % 100 < 40 → Success
- Success: Steal 50% of target's rewards
- Failure: Lose 2 GAS attack fee

### Risk-Reward Balance

**High Stake Strategy**

- Pros: Higher yields
- Cons: Bigger target for attacks

**Frequent Withdrawal**

- Pros: Minimize attack losses
- Cons: Lower compound growth

**Active Attacker**

- Pros: Steal others' rewards
- Cons: 2 GAS cost per attempt, 60% failure rate

## Strategy Guide

### Defensive Play

- Withdraw rewards frequently
- Keep low visible balance
- Minimize attack surface

### Aggressive Play

- Target high-reward players
- Multiple attacks for expected value
- Balance attack costs vs potential gains

### Balanced Play

- Moderate staking periods
- Selective attacks on high-value targets
- Regular but not excessive withdrawals

## Use Cases

### Competitive DeFi

- PvP element in yield farming
- Strategic gameplay beyond passive staking
- Risk management challenges

### Game Theory Experiments

- Prisoner's dilemma scenarios
- Nash equilibrium exploration
- Behavioral economics research

## Integration

### VRF Service

Attack resolution:

- Player initiates attack
- VRF generates random bytes
- Callback determines success
- Rewards transferred if successful

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Access control enforcement
- VRF request routing
- Event monitoring

## Security Considerations

- VRF ensures unpredictable attack outcomes
- Cannot attack yourself
- Attack cost prevents spam
- Rewards protected until withdrawal
- No admin control over attack results

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
