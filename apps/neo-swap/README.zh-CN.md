# Neo 兑换

通过 Flamingo DEX 即时兑换 NEO 与 GAS

## 概览

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-neo-swap` |
| **分类** | defi |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

Neo Swap 提供 NEO 与 GAS 的直接兑换，通过 Flamingo 链上路由执行。
价格来自平台数据源，兑换交易由钱包签名提交。

## 功能亮点

- **NEO/GAS 直接兑换**（Flamingo 路由）
- **实时价格**（数据源报价）
- **低滑点**（NEO/GAS 深度池）

## 使用步骤

1. 连接 Neo 钱包并选择兑换方向
2. 输入数量并查看汇率与最少收到
3. 在钱包中确认兑换交易
4. 即时收到代币

## 权限

| 权限 | 是否需要 |
|------|----------|
| 支付 | ❌ 否 |
| 数据源 | ✅ 是 |
| 随机数 | ❌ 否 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |

注意：需要钱包授权以签名兑换交易。

## 链上行为

- 兑换通过 Flamingo 路由合约执行（第三方部署）。
- 价格来自平台数据源。
- 本平台不部署独立兑换合约。

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x77b4349e5a62b3f77390afa50962096d66b0ab99` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x77b4349e5a62b3f77390afa50962096d66b0ab99) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xf970f4ccecd765b63732b821775dc38c25d74f23` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0xf970f4ccecd765b63732b821775dc38c25d74f23) |
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
