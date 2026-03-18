# 链上塔罗牌

区块链算命，可验证随机性

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-onchaintarot` |
| **分类** | 游戏 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- Tarot
- Fortune
- Divination

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 随机数 | ✅ 是 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xfff9616dd3d9e863bc72bf26ff0a0da2d698e767` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xfff9616dd3d9e863bc72bf26ff0a0da2d698e767) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xfb5d6b25c974a301e34c570dd038de8c25f3ae56` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xfb5d6b25c974a301e34c570dd038de8c25f3ae56) |
| **网络魔数** | `860833102` |

## 集成说明

- **支付模式**：直接预付 GAS 到 MiniApp 合约
- **随机数 / 解读结果**：Morpheus Oracle
- **当前钱包路径**：直接钱包调用；后续可以叠加 AA / session key 优化

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
