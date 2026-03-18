# Gas 代付

为低余额新用户提供免费 Gas 代付服务

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-gas-sponsor` |
| **分类** | 工具 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

为新用户提供免费 GAS 开始交易

Gas Sponsor 为低余额的 Neo 新用户提供免费 GAS。每天可请求最多 0.1 GAS 来支付交易费用，开始使用 Neo 网络。

## 功能亮点

- **每日配额**：当余额较低时，每天可请求最多 0.1 GAS。
- **自动重置**：配额每天 UTC 午夜自动重置，持续可用。

## 使用步骤

1. 余额少于 0.1 GAS 的新用户符合资格
2. 每天可免费请求最多 0.1 GAS
3. 使用赞助的 gas 支付交易费用
4. 当您有足够的 GAS 后，帮助其他人！

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ✅ 是 |
| 支付 | ✅ 是 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |

## 链上行为

- 当前请求路径通过钱包 SDK 暴露的平台赞助 API 完成。
- 赞助池捐赠和转账仍然是普通钱包签名转账。
- 当前运行时不依赖 PaymentHub 收据。

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xae47f11a368ceb778839e80e3ad0ecb952e9c058` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0xae47f11a368ceb778839e80e3ad0ecb952e9c058) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x80ea8435a88334b9b80077220097d88c440615f1` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x80ea8435a88334b9b80077220097d88c440615f1) |
| **网络魔数** | `860833102` |

## 资产

- **允许资产**：GAS

## 开发

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
