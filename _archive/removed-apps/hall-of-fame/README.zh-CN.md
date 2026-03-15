# Neo 名人堂

使用 GAS 交易量为 Neo 传奇人物、社区和开发者投票。通过付费赢得排名的系统。

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-hall-of-fame` |
| **分类** | 社交 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

通过 GAS 投票进行社区认可

Neo 名人堂是一个社区驱动的排行榜，您可以通过 GAS 投票来支持 Neo 生态系统中您喜爱的人物、社区和开发者。

## 功能亮点

- **GAS 投票**：使用真实 GAS 代币投票提升排名。
- **多种分类**：认可人物、社区和开发者。

## 使用步骤

1. 连接您的 Neo 钱包
2. 浏览分类：人物、社区、开发者
3. 点击助力用 GAS 投票
4. 观看您喜爱的对象攀升排行榜

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ❌ 否 |
| 支付 | ✅ 是 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |

## 链上行为

- 链上支付验证（必要时使用 PaymentHub 收据）。

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xfdfd94a2a0819d97c0c681ddef4dbcad25973940` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0xfdfd94a2a0819d97c0c681ddef4dbcad25973940) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x3c00cbea1c4e502bafae4c6ce7a56237a7d71ded` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x3c00cbea1c4e502bafae4c6ce7a56237a7d71ded) |
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
