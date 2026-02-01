# 坚不可摧保险库

基于 SHA-256 哈希的悬赏保险库挑战

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-unbreakablevault` |
| **分类** | utility |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- 用密钥哈希创建悬赏保险库
- 按难度分级的尝试费用
- 每次失败都会增加奖池
- 破解者获得悬赏（扣除 2% 平台费）
- 保险库 30 天到期，创建者可取回退款
- 密钥在本地哈希，链上仅保存哈希

## 使用流程

1. 创建者选择密钥、悬赏金额与难度。
2. 创建保险库并公开保险库编号。
3. 挑战者支付尝试费用进行破解。
4. 密钥正确可获得悬赏；过期后创建者可取回资金。

## 费用

- 最低悬赏：1 GAS
- 尝试费用：0.1 / 0.5 / 1 GAS（简单 / 中等 / 困难）
- 平台费：2%（从奖金与退款中扣除）

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
| **合约地址** | `0xcf4c6eb16baad22292fb3ced6e570c31fadddd4e` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0xcf4c6eb16baad22292fb3ced6e570c31fadddd4e) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa) |
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
