# 每日签到 — 可验证的 Neo 连续签到仪式

每日签到是一个温暖、明亮、以日常仪式为核心的 Neo 小程序。主界面是阳光签到广场、清晰的七日章节、实时 UTC 窗口与一个随状态变化的主要操作，而不是一页合约参数表单。

> **当前状态：** `MiniAppDailyCheckin` 已部署到 Neo N3 主网和测试网。2026-07-11 已通过只读 N3Index RPC 核验线上 ABI、奖励参数、暂停状态、奖励池与计数。本次产品化没有部署或更新合约，没有提交带资金交易，也没有使用账户或密钥。详见 [NETWORK_STATUS.md](./NETWORK_STATUS.md)。

## 每日流程

1. **打开签到广场**：无需连接钱包即可读取线上奖励参数与合约奖励池。
2. **连接 Neo 钱包**：用户资格与连续记录会绑定到该钱包、网络和规范合约。
3. **核对 UTC 窗口**：签到资格来自 `getCheckinStatus`，前端不会使用本地日期猜测。
4. **完成一次签到**：直连钱包向合约发送当前签到费用，并携带精确 memo `miniapp-dailycheckin:checkin`；这笔 GAS 转账本身就是签到。
5. **守护连续记录**：连续 UTC 日会推进 streak；错过一个 UTC 日后，下一次签到从第 1 天重新开始，但历史最高记录保留。
6. **解锁线上里程碑**：当前部署参数为第 7 天累积 0.01 GAS、第 14 天累积 0.02 GAS。当前没有后续奖励里程碑，但连续天数仍可继续增长。
7. **领取奖励**：`claimRewards` 从合约奖励池把已累积奖励支付到连接的钱包。

## 交易真实性与恢复

钱包弹窗、广播结果或交易 ID 只表示 pending，不代表成功。

每一次确认成功都必须同时具备事件与合约回读证据，任何单一来源都不足以判定成功。

- 签到成功必须同时核对精确的 `CheckedIn(user, streak, reward)`、GAS `Transfer(user, contract, fee)` 与权威用户/平台回读。
- 领取成功必须同时核对精确的 `RewardsClaimed(user, amount)`、GAS `Transfer(contract, user, amount)` 与已领取/全局奖励回读。
- pending 记录绑定操作、交易 ID、钱包、网络、规范合约、GAS 合约与操作前状态。
- `FAULT` 是确定失败；事件缺失、索引延迟、回读延迟、钱包切换或网络不匹配都会保持可见、可恢复的 pending 状态。
- 读取失败或数据畸形不会被渲染成虚假的 0 天、0 奖励、“今日未签到”或成功。

## 当前合约参数

| 参数 | 当前值 |
| --- | ---: |
| 签到转账 | 0.001 GAS |
| 第 7 天奖励 | 0.01 GAS |
| 第 14 天奖励 | 0.02 GAS |
| 断签规则 | 错过 UTC 日后，下一次签到从第 1 天开始 |
| 签到转账之外的平台费 | 无 |

合约所有者可以更新费用与里程碑参数，因此界面会读取并展示实时合约参数，不把当前数值写成永久承诺。

## 规范部署

| 网络 | 合约 | 名称 | NEF checksum |
| --- | --- | --- | ---: |
| Neo N3 主网 | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` |
| Neo N3 测试网 | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` |

## 开发验证

```bash
npx tsc -p apps/daily-checkin/tsconfig.json --noEmit
npm --prefix apps/daily-checkin test
cd apps/shared && npx vitest run test/daily-checkin.integration.test.tsx test/daily-checkin.logic.test.ts test/daily-checkin.playarea.test.tsx test/daily-checkin.production.test.ts
npm --prefix apps/daily-checkin run build
```

## 许可证

MIT License — R3E Network
