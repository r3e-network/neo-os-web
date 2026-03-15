# MiniAppGardenOfNeo | Neo 花园

## Overview | 概述

**English**: Virtual garden where plants grow based on blockchain metrics. Plant seeds that grow according to network activity (TPS, block height, GAS burned), then harvest for rewards.

**中文**: 基于区块链指标生长的虚拟花园。种植种子，根据网络活动（TPS、区块高度、GAS燃烧）生长，然后收获奖励。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppGardenOfNeo`
- **App ID**: `miniapp-garden-of-neo`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Plant Seeds**: Choose from 5 seed types (Fire, Ice, Earth, Wind, Light)
2. **Growth**: Plants mature over 100 blocks based on blockchain data
3. **Appearance**: Plant color and size change with network activity
4. **Harvest**: Collect rewards when plant reaches maturity
5. **Rewards**: Higher seed types yield better rewards

### 中文

1. **种植种子**: 从5种种子类型中选择（火、冰、土、风、光）
2. **生长**: 植物根据区块链数据在100个区块内成熟
3. **外观**: 植物颜色和大小随网络活动变化
4. **收获**: 植物成熟时收集奖励
5. **奖励**: 更高级别的种子产生更好的奖励

## Key Features | 核心特性

### English

- **Blockchain-Driven Growth**: Plant appearance tied to chain metrics
- **5 Seed Types**: Different rarities and rewards
- **Dynamic Visuals**: Color changes based on block hash
- **Maturity System**: 100 blocks to full growth
- **Reward Scaling**: Better seeds = better rewards

### 中文

- **区块链驱动生长**: 植物外观与链指标绑定
- **5种种子类型**: 不同稀有度和奖励
- **动态视觉**: 颜色根据区块哈希变化
- **成熟系统**: 100个区块完全生长
- **奖励缩放**: 更好的种子 = 更好的奖励

## Seed Types | 种子类型

### English

1. **Fire Seed** (Type 1): 0.05 GAS reward
2. **Ice Seed** (Type 2): 0.10 GAS reward
3. **Earth Seed** (Type 3): 0.15 GAS reward
4. **Wind Seed** (Type 4): 0.20 GAS reward
5. **Light Seed** (Type 5): 0.25 GAS reward

### 中文

1. **火种** (类型1): 0.05 GAS奖励
2. **冰种** (类型2): 0.10 GAS奖励
3. **土种** (类型3): 0.15 GAS奖励
4. **风种** (类型4): 0.20 GAS奖励
5. **光种** (类型5): 0.25 GAS奖励

## Main Functions | 主要函数

### User Functions | 用户函数

#### `Plant(owner, seedType, receiptId)`

**English**: Plant a new seed.

- `owner`: Owner address
- `seedType`: Seed type (1-5)
- `receiptId`: Payment receipt (0.1 GAS)

**中文**: 种植新种子。

- `owner`: 所有者地址
- `seedType`: 种子类型（1-5）
- `receiptId`: 支付收据（0.1 GAS）

#### `Harvest(owner, plantId)`

**English**: Harvest a mature plant.

- `owner`: Owner address
- `plantId`: Plant ID

**中文**: 收获成熟植物。

- `owner`: 所有者地址
- `plantId`: 植物ID

### Query Functions | 查询函数

#### `GetPlantStatus(plantId)`

**English**: Get plant growth status.
Returns: [size, color, isMature]

**中文**: 获取植物生长状态。
返回: [大小, 颜色, 是否成熟]

#### `TotalPlants()`

**English**: Get total plants created.

**中文**: 获取创建的植物总数。

## Events | 事件

### `PlantSeeded`

**English**: Emitted when seed is planted.

**中文**: 种植种子时触发。

### `PlantHarvested`

**English**: Emitted when plant is harvested.

**中文**: 收获植物时触发。

## Economic Model | 经济模型

### English

- **Planting Fee**: 0.1 GAS per seed
- **Growth Time**: 100 blocks (~25 minutes)
- **Rewards**: 0.05-0.25 GAS based on seed type
- **One-Time Harvest**: Each plant harvested once

### 中文

- **种植费用**: 每个种子0.1 GAS
- **生长时间**: 100个区块（约25分钟）
- **奖励**: 根据种子类型0.05-0.25 GAS
- **一次性收获**: 每株植物收获一次
