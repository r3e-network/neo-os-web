# 活动门票通行证

基于 NEP-11 的活动门票与二维码核验。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-event-ticket-pass` |
| **分类** | 社交 |
| **版本** | 1.0.0 |
| **框架** | Host-native React playarea |

## 特性

- 创建活动并设置票量上限
- 向参与者签发 NEP-11 门票
- 门票二维码展示用于入场核验
- 创建者/网关核销门票并标记已使用

## 用户流程

1. **创建活动**：填写标题、场地、时间与票量。
2. **签发门票**：向参与者地址发放门票。
3. **展示二维码**：参与者在“我的门票”中展示二维码。
4. **核验入场**：主办方扫描 tokenId 并标记已使用。

## 合约方法

- `CreateEvent(creator, name, venue, startTime, endTime, maxSupply, notes)`
- `UpdateEvent(creator, eventId, name, venue, startTime, endTime, maxSupply, notes)`
- `IssueTicket(creator, recipient, eventId, seat, memo)`
- `CheckIn(creator, tokenId)`
- `Transfer(from, to, tokenId, data)`
- `GetEventDetails(eventId)`
- `GetTicketDetails(tokenId)`

## 权限

| 权限 | 是否需要 |
|------|---------|
| 支付 | ❌ 否 |
| 自动化 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |

## 网络配置

### Testnet

| 属性 | 值 |
|------|----|
| **合约** | `0x90bad472146aab97de71498e8d736c3124e7c82b` |
| **RPC** | `https://n3seed1.ngd.network:20332` |
| **浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x90bad472146aab97de71498e8d736c3124e7c82b) |

### Mainnet

| 属性 | 值 |
|------|----|
| **合约** | `0x90bad472146aab97de71498e8d736c3124e7c82b` |
| **RPC** | `https://mainnet2.neo.coz.io:443` |
| **浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x90bad472146aab97de71498e8d736c3124e7c82b) |

> 测试网和主网均已部署并验证通过。
