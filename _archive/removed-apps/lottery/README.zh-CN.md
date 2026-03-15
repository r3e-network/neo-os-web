# Neo 彩票

去中心化彩票，采用 TEE VRF 可验证公平随机数

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-lottery` |
| **分类** | 游戏 |
| **版本** | 2.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- **可证明公平**: TEE VRF 随机性确保透明的获胜者选择
- **玩家统计**: 跟踪彩票、获胜、消费和连胜
- **成就系统**: 6 个可解锁的里程碑成就
- **奖池滚存**: 未领取的奖金滚存到下一轮
- **轮次历史**: 所有彩票轮次的完整历史数据
- **最低参与者**: 需要 3+ 参与者才能开奖

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 随机数 | ✅ 是 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x3e330b4c396b40aa08d49912c0179319831b3a6e` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x3e330b4c396b40aa08d49912c0179319831b3a6e) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xb3c0ca9950885c5bf4d0556e84bc367473c3475e` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0xb3c0ca9950885c5bf4d0556e84bc367473c3475e) |
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
- **彩票价格**: 0.1 GAS
- **每次最多彩票数**: 100 张
- **最低参与者**: 3 人
- **奖金分配**: 90% 给获胜者，10% 平台费用

## 合约方法

### 用户方法

#### `BuyTickets(player, ticketCount, receiptId)`

购买当前轮次的彩票。

| 参数 | 类型 | 描述 |
|------|------|------|
| `player` | Hash160 | 玩家钱包地址 |
| `ticketCount` | Integer | 彩票数量 (1-100) |
| `receiptId` | Integer | PaymentHub 支付收据 ID |

**注意**: 总费用计算为 `ticketCount × 0.1 GAS`。

### 查询方法

| 方法 | 参数 | 描述 |
|------|------|------|
| `GetCurrentRoundInfo` | - | 获取当前轮次状态 |
| `GetPlayerStatsDetails` | `player` | 获取玩家统计 |
| `GetPlatformStats` | - | 获取平台统计 |
| `GetRoundDetails` | `roundId` | 获取轮次历史 |

## 成就系统

| ID | 名称 | 要求 |
|----|------|------|
| 1 | 首张彩票 | 购买 1 张彩票 |
| 2 | 十张彩票 | 累计购买 10 张彩票 |
| 3 | 百张彩票 | 累计购买 100 张彩票 |
| 4 | 首次获胜 | 赢得 1 次彩票 |
| 5 | 大赢家 | 单次赢得 10+ GAS |
| 6 | 幸运连胜 | 连续赢得 3 轮 |

## 许可证

MIT License - R3E Network
