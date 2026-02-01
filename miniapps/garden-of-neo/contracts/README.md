# MiniAppGardenOfNeo | Neo 花园

## Overview | 概述

**English**: Virtual garden where plants mature by block height and optional care actions. Plant seeds, wait ~100 blocks, then harvest GAS rewards. Seasonal bonuses can boost rewards.

**中文**: 基于区块高度与养护行为生长的虚拟花园。种植种子、等待约 100 个区块成熟后收获 GAS 奖励，季节加成可提升奖励。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppGardenOfNeo`
- **App ID**: `miniapp-garden-of-neo`
- **Version**: 2.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Plant Seeds**: 7 seed types (Fire, Ice, Earth, Wind, Light, Dark, Rare)
2. **Growth**: Plants mature over 100 blocks (watering speeds growth)
3. **Care**: Water for growth bonus, fertilize for reward bonus
4. **Harvest**: Claim GAS when mature (season bonus may apply)
5. **Gardens**: Optional garden creation for organizing plots

### 中文

1. **种植种子**: 7 种类型（火、冰、土、风、光、暗、稀有）
2. **生长**: 100 个区块成熟（浇水可加速）
3. **养护**: 浇水提升生长，施肥提升奖励
4. **收获**: 成熟后领取 GAS（可受季节加成）
5. **花园**: 可创建花园用于管理地块

## Key Features | 核心特性

### English

- **Block-Based Growth**: 100 blocks to mature by default
- **Care Actions**: Water/fertilize bonuses
- **Season Bonus**: Bonus seed type per season
- **Reward Scaling**: Rewards vary by seed type

### 中文

- **区块生长**: 默认 100 个区块成熟
- **养护加成**: 浇水/施肥提升成长与奖励
- **季节加成**: 每季节指定加成种子
- **奖励分级**: 不同种子对应不同奖励

## Seed Types | 种子类型

### English

1. **Fire Seed** (Type 1): 0.15 GAS reward
2. **Ice Seed** (Type 2): 0.15 GAS reward
3. **Earth Seed** (Type 3): 0.20 GAS reward
4. **Wind Seed** (Type 4): 0.20 GAS reward
5. **Light Seed** (Type 5): 0.30 GAS reward
6. **Dark Seed** (Type 6): 0.30 GAS reward
7. **Rare Seed** (Type 7): 1.00 GAS reward

### 中文

1. **火种** (类型1): 0.15 GAS 奖励
2. **冰种** (类型2): 0.15 GAS 奖励
3. **土种** (类型3): 0.20 GAS 奖励
4. **风种** (类型4): 0.20 GAS 奖励
5. **光种** (类型5): 0.30 GAS 奖励
6. **暗种** (类型6): 0.30 GAS 奖励
7. **稀有种** (类型7): 1.00 GAS 奖励

## Main Functions | 主要函数

### User Functions | 用户函数

#### `Plant(owner, seedType, name, receiptId)`

**English**: Plant a new seed.

- `owner`: Owner address
- `seedType`: Seed type (1-7)
- `name`: Optional plant name (max 50 chars)
- `receiptId`: Payment receipt (0.1 GAS)

**中文**: 种植新种子。

- `owner`: 所有者地址
- `seedType`: 种子类型（1-7）
- `name`: 可选名称（最多 50 字符）
- `receiptId`: 支付收据（0.1 GAS）

#### `Harvest(owner, plantId)`

**English**: Harvest a mature plant.

**中文**: 收获成熟植物。

#### `WaterPlant(waterer, plantId, receiptId)`

**English**: Water to boost growth speed (0.05 GAS).

**中文**: 浇水提升生长速度（0.05 GAS）。

#### `FertilizePlant(fertilizer, plantId, receiptId)`

**English**: Fertilize to boost rewards (0.2 GAS).

**中文**: 施肥提升奖励（0.2 GAS）。

#### `CreateGarden(owner, name, receiptId)`

**English**: Create a new garden (1 GAS).

**中文**: 创建新花园（1 GAS）。

### Query Functions | 查询函数

#### `GetPlantStatus(plantId)`

**English**: Returns growthPercent, isMature, blocksRemaining, waterCount, fertilizeCount.

**中文**: 返回 growthPercent、isMature、blocksRemaining、waterCount、fertilizeCount。

#### `GetPlantDetails(plantId)`

**English**: Full plant state including seed type and harvest info.

**中文**: 返回完整植物状态（含种子类型与收获信息）。

## Events | 事件

- `PlantSeeded`
- `PlantHarvested`
- `PlantWatered`
- `PlantFertilized`
- `SeasonChanged`

## Economic Model | 经济模型

### English

- **Planting Fee**: 0.1 GAS per seed
- **Water Fee**: 0.05 GAS per action
- **Fertilize Fee**: 0.2 GAS per action
- **Garden Fee**: 1 GAS per garden
- **Growth Time**: 100 blocks (~25 minutes)
- **Rewards**: 0.15-1.00 GAS based on seed type
- **One-Time Harvest**: Each plant harvested once

### 中文

- **种植费用**: 每个种子 0.1 GAS
- **浇水费用**: 每次 0.05 GAS
- **施肥费用**: 每次 0.2 GAS
- **花园费用**: 每个花园 1 GAS
- **生长时间**: 100 个区块（约 25 分钟）
- **奖励**: 根据种子类型 0.15-1.00 GAS
- **一次性收获**: 每株植物收获一次
