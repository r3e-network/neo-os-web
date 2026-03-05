# 抛硬币

50/50 抛硬币游戏 - 带奖池和成就系统

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-coinflip` |
| **分类** | 游戏 |
| **版本** | 2.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- **可证明公平**: TEE VRF 随机性确保透明结果
- **累积奖池**: 每注 1% 贡献到奖池
- **玩家统计**: 跟踪下注、获胜、连胜和消费
- **成就系统**: 10 个可解锁成就
- **连胜奖励**: 连胜奖励最高 5% 额外支付
- **下注历史**: 每个玩家的完整下注历史

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
| **合约地址** | `0xbd4c9203495048900e34cd9c4618c05994e86cc0` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0xbd4c9203495048900e34cd9c4618c05994e86cc0) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1) |
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
- **最低下注**: 0.1 GAS
- **最高下注**: 50 GAS
- **平台费用**: 3%
- **奖池贡献**: 每注 1%
- **奖池中奖概率**: 0.5%

## 合约方法

### 用户方法

#### `PlaceBet(player, amount, choice, receiptId) → betId`

下注抛硬币。

| 参数 | 类型 | 描述 |
|------|------|------|
| `player` | Hash160 | 玩家钱包地址 |
| `amount` | Integer | 下注金额（GAS 基础单位，1e8） |
| `choice` | Boolean | `true` = 正面, `false` = 反面 |
| `receiptId` | Integer | PaymentHub 支付收据 ID |

**注意**: 下注金额会与支付收据校验。

### 查询方法

| 方法 | 参数 | 描述 |
|------|------|------|
| `GetBetDetails` | `betId` | 获取下注信息 |
| `GetPlayerStatsDetails` | `player` | 获取玩家统计 |
| `GetPlatformStats` | - | 获取平台统计 |
| `GetUserBets` | `player, offset, limit` | 获取玩家下注历史 |
| `GetUserBetCount` | `player` | 获取下注总数 |

## 成就系统

| ID | 名称 | 要求 |
|----|------|------|
| 1 | 首胜 | 赢得 1 次 |
| 2 | 十胜 | 赢得 10 次 |
| 3 | 百胜 | 赢得 100 次 |
| 4 | 豪赌客 | 单次下注 >= 10 GAS |
| 5 | 幸运连胜 | 连续赢 5 次 |
| 6 | 奖池赢家 | 赢得奖池 |
| 7 | 老手 | 累计下注 100 次 |
| 8 | 大手笔 | 累计下注 100 GAS |
| 9 | 逆转王 | 连输 5 次后获胜 |
| 10 | 巨鲸 | 单次下注 >= 50 GAS |

## 许可证

MIT License - R3E Network
