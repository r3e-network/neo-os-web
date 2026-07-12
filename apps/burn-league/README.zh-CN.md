# GAS 燃烧排位赛

基于 Phaser 3 竞技场与链上 GAS 奖池的赢者通吃 GameFi 联赛。

> 产品语义说明：“燃烧”是游戏动作名称。GAS 会进入赛季奖池并分配给榜首，
> 并不会被销毁，也不会减少 GAS 流通量。

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-burn-league` |
| **分类** | GameFi 游戏 |
| **版本** | 1.1.0 |
| **框架** | Phaser 3 + React 宿主桥接 |

## 功能特性

- 无需钱包、可主动收火记分的本地 push-your-luck 热度模式
- 链上赢者通吃赛季
- 基于 `Burned` 事件的实时排行榜
- 不可撤销燃烧的明确二次确认
- 按精确交易 ID 恢复广播中的充值与燃烧
- 可提取的未用充值与赛季奖金

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
| **合约地址** | `0x21a527b50b839efeb73721a886c9b5994a206316` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x21a527b50b839efeb73721a886c9b5994a206316) |
| **网络魔数** | `894710606` |

### 主网旧部署（不再属于应用的活动绑定）

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f` |
| **RPC 节点** | `https://mainnet2.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f) |
| **网络魔数** | `860833102` |

## 平台合约

### 测试网 (Testnet)

| 合约 | 地址 |
| --- | --- |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

### 主网 (Mainnet)

| 合约 | 地址 |
| --- | --- |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| Morpheus Oracle | `0x5b492098fc094c760402e01f7e0b631b939d2bea` |

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

## 资金路径

- 先消耗已有可提取额度，只从钱包充值差额。
- 钱包先签 GAS 转账并等待 `Credited`，再调用 `burn`。
- 刷新后即使确认充值成功，也不会自动燃烧；玩家必须重新检查确认。
- 只有精确匹配交易 ID、玩家和数量的 `Burned` 事件才显示成功。

## 游戏流程

1. 进入竞技场，选择 GameFi 或无需钱包的本地热度模式。
2. 钱包连接是独立操作，连接按钮不会同时燃烧 GAS。
3. 在 Phaser 竞技场选择燃料胶囊。
4. 第一次点击只显示不可撤销、赢者通吃的风险确认。
5. 12 秒内再次点击，再批准钱包交易。
6. 索引超时时使用“检查交易”，不要重复提交。

本地模式采用独立玩法：添柴累积未锁定热度，并在后续爆燃熄灭前主动“收火记分”。
安全随机数不可用时会保持本轮进度不变并直接报错，不会降级到弱随机数。

赛季结束后任何人都可调用 `settle()`。奖池会记入榜首的“可提取额度”，
并非直接转入钱包；榜首随后通过 `withdraw(account)` 提取。相同总量时，
先成为榜首的玩家保持领先。

## 生产注意事项

v1.1 合约采用 24 小时日赛（`seasonDuration() = 86400000`），并已部署到测试网。
主网地址仍是两分钟演示赛季，已从应用活动绑定中移除。必须先部署并审计 v1.1+
主网合约，之后才能重新开放。


## 许可证

MIT License - R3E Network
