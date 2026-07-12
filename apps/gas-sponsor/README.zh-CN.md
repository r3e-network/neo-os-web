# GAS 社区赞助池

Gas Sponsor 是面向已部署 `MiniAppGasSponsor` v2 合约的社区补给站。它是链上赞助池应用，不再依赖已经失效的平台水龙头 API，也不会把转账到硬编码运营钱包描述成“赞助池”。

## 产品流程

1. 无需连接钱包即可浏览运行中和历史赞助池。
2. 选择公开池，查看准确的剩余 GAS、单钱包上限、领取次数和到期时间。
3. 仅在领取或创建赞助池时连接钱包。
4. 通过可视化 GAS 规格创建公开赞助池；精确参数放在次级抽屉。
5. 赞助者可在管理抽屉中补充、延期或收回自己的赞助池。

主界面始终突出“赞助池本体”；合约哈希、精确数值和生命周期控制位于次级层级。

## 链上行为

| 操作 | 合约流程 | 确认条件 |
| --- | --- | --- |
| 创建公开池 | 预付 GAS，再调用 `createPool(sponsor, amount, maxClaimPerUser, 1, description)` | `SponsorshipCreated` + `getPoolDetails` 读回 |
| 领取 | `claimSponsorship(beneficiary, poolId, amount)` | `SponsorshipClaimed` + 赞助池/用户领取读回 |
| 补充 | 预付 GAS，再调用 `topUpPool(sponsor, poolId, amount)` | HALT 回执 + 精确池余额读回 |
| 延期 | `extendPoolExpiry(poolId, newExpiry)` | `PoolExtended` + 到期时间读回 |
| 收回 | `withdrawPool(sponsor, poolId)` | `PoolRefunded` + 非活动/零余额读回 |

预付款交易和目标调用交易会分别持久保存。如果预付款已经确认、目标调用延迟，恢复流程只会继续目标调用，不会重复转账。

## 已部署合约

| 网络 | 合约 |
| --- | --- |
| Neo N3 主网 | `0x80ea8435a88334b9b80077220097d88c440615f1` |
| Neo N3 测试网 | `0x31888679572bf2de61462ff9934b6265d60284f2` |

两个部署都包含应用使用的赞助池生命周期方法和事件；网络特有的管理集成不会被当作通用产品功能。

## 当前合约事实

- 新建赞助池最少 `1 GAS`。
- 单笔最多领取 `0.1 GAS`。
- 最少补充 `0.5 GAS`。
- 应用使用池类型 `1` 的公开社区池路径。
- 合约报告 `defaultExpirySeconds = 2592000`，但现有池的时间戳差值为 `2,592,000 毫秒`（约 43.2 分钟）。应用只展示实际链上到期时间，不会把它错误描述成“30 天”。

当前只读部署快照见 `NETWORK_STATUS.md`。

## 开发

```bash
npm run build --workspace=miniapp-gas-sponsor
```

定向逻辑与 PlayArea 测试位于 `apps/shared/test/gas-sponsor.*.test.*`。
