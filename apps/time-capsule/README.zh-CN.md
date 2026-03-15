# 时间胶囊

时间锁定的消息哈希，支持公开打捞与本地内容保存

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-time-capsule` |
| **分类** | nft |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- 链上只保存消息哈希与元数据
- 公开/私密可见性选择
- 公开胶囊到期可被打捞
- 私密胶囊可添加收件人
- 可付费延期或赠送胶囊
- 用户与分类统计

## 使用流程

1. 连接 Neo 钱包并进入创建页。
2. 输入消息并设置锁定天数（1-3650 天）。
3. 支付 0.2 GAS 封存胶囊哈希上链。
4. 到期后使用本地备份内容揭示胶囊。
5. 可选：支付费用打捞已解锁的公开胶囊。

## 内容存储

- 合约只保存消息哈希与元数据。
- 完整消息保存在本地设备，请自行备份。

## 费用

- 埋藏胶囊：0.2 GAS
- 打捞胶囊：0.05 GAS
- 延期解锁：0.1 GAS
- 赠送胶囊：0.15 GAS
- 打捞奖励：0.02 GAS（合约余额充足时）

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
| **合约地址** | `0x0108b2d8d020f921d9bdc82ffda5e55f9b749823` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x0108b2d8d020f921d9bdc82ffda5e55f9b749823) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xd853a4ac293ff96e7f70f774c2155d846f91a989` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0xd853a4ac293ff96e7f70f774c2155d846f91a989) |
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
