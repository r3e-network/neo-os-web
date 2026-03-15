# Neo 浏览器

探索 Neo N3 区块链 - 交易、地址、合约

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-explorer` |
| **分类** | tools |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

实时浏览 Neo N3 区块链数据

Explorer 提供 Neo N3 区块链的全面视图。搜索交易、检查地址并分析智能合约。

## 功能亮点

- **实时数据**：实时区块链数据，随新区块确认而更新。
- **深度分析**：详细的交易追踪和合约状态检查。

## 使用步骤

1. 输入交易哈希、地址或合约哈希
2. 查看搜索项目的详细信息
3. 探索相关交易和合约交互
4. 收藏您想监控的地址

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ❌ 否 |
| 支付 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ✅ 是 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |

## 链上行为

- 无链上合约部署，主要使用链下 API 或钱包签名流程。

## 网络配置

无链上合约部署。

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

## 资产

- **允许资产**：无

## 开发

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
