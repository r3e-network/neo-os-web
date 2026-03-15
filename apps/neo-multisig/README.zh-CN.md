# Neo 多重签名

创建多签转账请求并安全收集签名。

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-neo-multisig` |
| **分类** | utilities |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

安全的多签转账

创建多签交易、收集批准，达到阈值后广播。

## 功能亮点

- **链上安全**：使用 Neo N3 多签见证完成执行。
- **签名人控制**：仅列表中的公钥可签名。

## 使用步骤

1. 填写签名人公钥并设置阈值。
2. 准备转账并确认手续费。
3. 将请求 ID 分享给其他签名人。
4. 签名满足阈值后广播交易。

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ✅ 是 |
| 支付 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |
| 机密 | ✅ 是 |

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

- **允许资产**：NEO, GAS

## 开发

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
