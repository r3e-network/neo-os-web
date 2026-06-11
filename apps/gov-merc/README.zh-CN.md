# 众筹算力

出租投票权，NEO 版 Curve War，投票权明码标价

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-gov-merc` |
| **分类** | 治理 |
| **版本** | 1.0.0 |
| **框架** | Host-native React playarea |

## 功能特性

- Governance
- Voting
- Marketplace

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ✅ 是 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x140f5faf5692d21421a79278b0e45b9b9bd4bb46` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x140f5faf5692d21421a79278b0e45b9b9bd4bb46) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x140f5faf5692d21421a79278b0e45b9b9bd4bb46` |
| **RPC 节点** | `https://mainnet2.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x140f5faf5692d21421a79278b0e45b9b9bd4bb46) |
| **网络魔数** | `860833102` |

> **迁移说明（v2，2026-06-12）：** MiniAppGovMerc v2 为每个周期引入固定的
> 5 分钟竞价窗口（首笔竞价开启窗口；之后的竞价必须在截止时间前提交，
> 结算只能在截止后进行）。v1 合约
> `0x1eb83eb5d4d3f073112064e8a3825f3b0e5f88e9` 在两个网络上保持在线，
> 仅用于用户退出（提取质押 / 取回竞价 / 提取额度）。

## 平台合约

### 当前集成边界

- 直接预付 GAS 到 MiniApp 合约
- 不再依赖旧版平台收据流程
- 治理逻辑保持链上执行，预言机 / AA 如有需要通过外部系统接入

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
