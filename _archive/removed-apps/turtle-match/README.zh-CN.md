# 乌龟对对碰

购买盲盒，收集乌龟，配对赢取 GAS！

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-turtle-match` |
| **分类** | 游戏 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

盲盒配对赢取 GAS

购买盲盒后自动开盒，在 3x3 网格中完成配对并链上结算奖励。奖励按合约赔率计算，结算后发放。

## 功能亮点

- **链上会话**：会话、配对与奖励均由合约记录。
- **可复现开盒**：乌龟颜色由种子哈希推导，结果透明可验证。
- **即时结算**：完成会话后一次结算即可领取奖励。

## 使用步骤

1. 连接钱包以同步游戏会话与统计数据。
2. 选择 3-20 个盲盒并开始游戏（每个 0.1 GAS）。
3. 观看自动开盒、配对与奖励预览。
4. 链上结算获取 GAS 奖励，然后开始新一局。

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
| **合约地址** | `0x795bb2b8be2ac574d17988937cdd27d12d5950d6` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x795bb2b8be2ac574d17988937cdd27d12d5950d6) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xac10b90f40c015da61c71e30533309760b75fec7` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0xac10b90f40c015da61c71e30533309760b75fec7) |
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
