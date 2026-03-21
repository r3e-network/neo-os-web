# 分手合约

恋爱承诺合约，质押 GAS

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-breakupcontract` |
| **分类** | 社交 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- Relationship
- Commitment
- Stake

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
| **合约地址** | `0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xf7e2a2681e66aa5e0379bd2f4590c5a0ff0ad8d8) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x7742a80565ef04c0b7487d1679e6efbeb2d0c6a9` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x7742a80565ef04c0b7487d1679e6efbeb2d0c6a9) |
| **网络魔数** | `860833102` |

## 平台合约

### 当前集成边界

- create / sign 主路径使用直接预付 GAS 到 MiniApp 合约
- 不再依赖旧版平台收据流程
- 预言机 / AA 如有需要，仍通过外部系统接入

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
