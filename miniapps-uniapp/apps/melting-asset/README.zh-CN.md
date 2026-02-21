# 正在融化的 NFT

随时间贬值的 NFT，需要维护

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-meltingasset` |
| **分类** | 去中心化金融 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- Nft
- Decay
- Maintenance

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x964994b4ce9d77c7af303c6c762192d4184313ee` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x964994b4ce9d77c7af303c6c762192d4184313ee) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | 未部署 |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [NeoTube](https://neotube.io) |
| **网络魔数** | `860833102` |

## 平台合约

| 合约 | 测试网哈希 |
|------|------------|
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |

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


## 许可证

MIT License - R3E Network
