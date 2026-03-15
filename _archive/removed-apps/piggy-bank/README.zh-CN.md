# 零知识存钱罐

基于零知识证明的隐私储蓄账户。支持任意NEP-17代币。

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-piggy-bank` |
| **分类** | 金融 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

Neo N3 链上的隐私目标存钱罐

零知识存钱罐允许您为目标存入任意 NEP-17 代币，并锁定至指定日期。零知识证明可在您砸碎存钱罐前隐藏余额。使用前请连接 Neo N3 钱包并配置 RPC RPC。

## 功能亮点

- **零知识隐私**：余额在提取前保持隐藏。
- **支持任意 NEP-17**：支持 ETH、稳定币或任意代币合约。
- **时间锁定**：资金在指定日期前无法提取。
- **多链兼容**：支持主流 Neo N3 网络并可配置 RPC。
- **本地密钥**：存款密钥保存在本地设备以确保安全。
- **目标验证**：在不暴露金额的情况下验证目标进度。

## 使用步骤

1. 连接 Neo N3 钱包并选择网络。
2. 创建存钱罐，设置代币、目标金额与解锁日期。
3. 存入 NEP-17 代币（可选常用或自定义合约地址）。
4. 使用 ZK 验证在不暴露余额的情况下检查目标进度。
5. 到期后砸碎存钱罐并提取资金。

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ✅ 是 |
| 支付 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
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

- **允许资产**：全部（任意代币）

## 开发

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
