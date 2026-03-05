# 遗产信托 DAO

锁定 NEO/GAS，享受奖励，在不活跃后按月释放继承资产

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-heritage-trust` |
| **分类** | nft |
| **版本** | 2.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- 锁定 NEO 与/或 GAS 作为本金，并设定按月释放计划
- NEO 通过 NeoBurger 转换为 bNEO 获取 GAS 奖励
- 三种释放模式：NEO + GAS、本金 NEO + 奖励、仅奖励
- 支持仅 GAS 本金，按月释放 GAS 本金
- 不活跃触发后，受益人按月领取释放资产
- 信托未触发期间，所有者可领取累计 GAS 奖励

## 释放模式

| 模式 | 本金锁定 | 每月释放 |
|------|----------|----------|
| 固定 NEO + GAS | NEO + GAS | NEO + GAS 本金 |
| NEO + GAS 奖励 | NEO | NEO 本金 + GAS 奖励 |
| 仅奖励 | NEO | 仅 GAS 奖励 |

## 释放机制

- 锁定的 NEO 会在合约内通过 NeoBurger 兑换为 bNEO。
- GAS 奖励在链上累计，信托触发前所有者可领取。
- 信托触发后，受益人通过 `claimReleasedAssets` 按月领取。
- 仅奖励模式下，本金持续锁定，仅释放 GAS 奖励。

## 生命周期

1. **创建信托**：锁定 NEO/GAS，设置受益人和按月释放计划。
2. **心跳维持**：所有者提交心跳保持信托有效。
3. **触发执行**：心跳超时后进入可执行状态。
4. **按月领取**：受益人按月领取释放的 NEO/GAS。

## 用户流程

- **所有者**
  - 创建信托并选择释放模式 + 周期。
  - 在信托未触发期间领取 GAS 奖励。
  - 定期发送心跳避免触发。
- **受益人**
  - 心跳超时后执行信托。
  - 按月领取释放资产。

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ❌ 否 |
| 自动化 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xd59eea851cd8e5dd57efe80646ff53fa274600f8` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0xd59eea851cd8e5dd57efe80646ff53fa274600f8) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xd260b66f646a49c15f572aa827e5eb36f7756563` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0xd260b66f646a49c15f572aa827e5eb36f7756563) |
| **网络魔数** | `860833102` |

## 平台合约

### 测试网 (Testnet)

| 合约 | 地址 |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### 主网 (Mainnet)

| 合约 | 地址 |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

## 开发指南

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 构建 H5 版本
npm run build
```

## 资产配置

- **允许的资产**: NEO、GAS（内部使用 bNEO 获取奖励）
  - NEO 会转换为 bNEO，通过 NeoBurger 产生 GAS 奖励。
  - GAS 本金仅在固定模式下按月释放。

## 合约接口（测试网）

- `createTrust(owner, heir, neoAmount, gasAmount, heartbeatIntervalDays, monthlyNeo, monthlyGas, onlyRewards, trustName, notes, receiptId)`
- `heartbeat(trustId)` — 重置不活跃计时
- `executeTrust(trustId)` — 触发按月释放
- `claimReleasedAssets(trustId)` — 受益人领取释放资产
- `claimYield(trustId)` — 所有者领取奖励


## 许可证

MIT License - R3E Network
