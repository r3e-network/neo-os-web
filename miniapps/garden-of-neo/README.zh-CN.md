# Neo花园

100 区块成熟的链上花园与 GAS 收获奖励

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-garden-of-neo` |
| **分类** | nft |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- 种植火、冰、土、风、光 5 种元素种子
- 植物 100 个区块成熟
- 成熟后一次性收获 GAS 奖励（0.15-0.30）
- 链上记录种植与收获事件

## 使用流程

1. 连接 Neo 钱包。
2. 每次花费 0.1 GAS 种植种子。
3. 等待约 100 个区块成熟。
4. 收获领取 GAS 奖励并继续种植。

## 种子奖励（当前界面）

| 种子 | 奖励 |
|------|------|
| 火种 | 0.15 GAS |
| 冰种 | 0.15 GAS |
| 土种 | 0.20 GAS |
| 风种 | 0.20 GAS |
| 光种 | 0.30 GAS |

## 费用

- 种植费用：每个种子 0.1 GAS
- 收获：无额外费用

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 数据源 | ✅ 是 |
| 随机数 | ❌ 否 |
| 治理 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x192e2a0a1e050440b97d449b7905f37516042faa` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x192e2a0a1e050440b97d449b7905f37516042faa) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x72aa16fd44305eabe8b85ca397b9bfcdc718dce8` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x72aa16fd44305eabe8b85ca397b9bfcdc718dce8) |
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

- **允许的资产**: GAS

## 说明

- 当前界面仅提供种植与收获功能。

## 许可证

MIT License - R3E Network
