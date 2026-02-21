# Breakup Contract

Smart contract for relationship commitments with financial stakes and penalties.

## 中文说明

分手合约 - 关系承诺智能合约，带有财务抵押和违约惩罚

### 功能特点

- 双方抵押GAS作为承诺
- 提前分手触发惩罚分配
- 最短承诺期30天
- 基于时间的惩罚计算

### 使用方法

1. 一方创建合约，设定抵押金额和期限（最少1 GAS，30天）
2. 另一方签署合约并支付相同金额
3. 合约激活，开始计时
4. 任一方可触发分手，根据剩余时间计算惩罚

### 技术细节

- **最低抵押**: 1 GAS
- **最短期限**: 30天
- **惩罚计算**: 惩罚 = 抵押 × (剩余时间 / 总时长)
- **存储**: 双方地址、抵押金额、签署状态、时间信息

## English

### Features

- Both parties stake GAS as commitment
- Early breakup triggers penalty distribution
- Minimum commitment period of 30 days
- Time-based penalty calculation

### Usage

1. One party creates contract with stake amount and duration (min 1 GAS, 30 days)
2. Other party signs contract and pays matching stake
3. Contract activates and timer starts
4. Either party can trigger breakup with time-based penalty

### Technical Details

- **Minimum Stake**: 1 GAS
- **Minimum Duration**: 30 days
- **Penalty Formula**: Penalty = Stake × (Remaining Time / Total Duration)
- **Storage**: Party addresses, stake amount, signature status, time data

## Technical

- **Contract**: MiniAppBreakupContract
- **Category**: Social/Finance
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: None (pure on-chain logic)
