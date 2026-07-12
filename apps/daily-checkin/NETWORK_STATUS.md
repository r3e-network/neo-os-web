# Daily Check-in Network Status

Read-only verification date: **2026-07-11**

| Network | Canonical contract | Contract name | NEF checksum | Paused | Check-in fee | Day 7 | Day 14 | Reward pool | Protected unclaimed |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Neo N3 Mainnet | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` | `false` | 0.001 GAS | 0.01 GAS | 0.02 GAS | 1.002 GAS | 0 GAS |
| Neo N3 Testnet | `0x25db219a701a2b23130788723fcf9a2e76857235` | `MiniAppDailyCheckin` | `170189676` | `false` | 0.001 GAS | 0.01 GAS | 0.02 GAS | 1.001 GAS | 0 GAS |

The live deployments expose the same MiniApp-facing business ABI and events:

- Reads: `getCheckInStateForFrontend`, `getCheckinStatus`, `getUserStatsDetails`, `getPlatformStats`, `isPaused`, `rewardPool`, `totalUnclaimed`, `checkInFee`
- User writes: memo-bound GAS transfer for check-in; `claimRewards`
- Confirmation events: `CheckedIn(user, streak, reward)`, `RewardsClaimed(user, amount)`, plus the corresponding GAS `Transfer`

The dated platform snapshot was:

- Mainnet: 2 users, 2 check-ins, 0 GAS claimed
- Testnet: 1 user, 1 check-in, 0 GAS claimed
- Both networks: current UTC-day/time fields returned `HALT`; the next-midnight value was a millisecond wall-clock timestamp

Production confirmation rules:

1. Every read and write is pinned to the canonical contract, GAS contract, detected network, and connected actor.
2. Eligibility and the reset boundary come from contract reads, not local calendar arithmetic.
3. GAS values remain decimal integer base units through validation, pending storage, events, and readback.
4. Broadcast creates a durable pending operation, not success.
5. Check-in requires exact `CheckedIn` and GAS payment events plus advancing user/global readback.
6. Claim requires exact `RewardsClaimed` and GAS payout events plus claimed/global reward readback.
7. `FAULT` is terminal failure; incomplete or lagging evidence remains pending for recovery.
8. Failed authoritative reads remain unavailable and are never replaced by trusted zero values.

No deployment, contract update, funded transaction, account, or secret was used during this verification pass.

## 双网状态

核验日期：**2026-07-11**。主网和测试网均部署同一业务版本的 `MiniAppDailyCheckin`，线上签到费用为 0.001 GAS，第 7/14 天奖励为 0.01/0.02 GAS，合约均未暂停且奖励池覆盖当前已累积义务。本次只进行了只读 RPC 核验，没有部署、更新或提交交易，也没有使用任何账户或密钥。
