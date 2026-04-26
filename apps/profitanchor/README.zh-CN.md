# ProfitAnchor MiniApp

ProfitAnchor 是 TrustAnchor 的收益优化版本。它使用共享的 `PlatformAnchor`
合约，模式为 `2`，专注于为质押 NEO 选择预期 GAS 收益最高的投票候选人。

| 字段 | 值 |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| 合约 | `PlatformAnchor` 共享合约，模式 `2` |
| 用户资产 | NEO |
| 奖励资产 | GAS |

## 模型

- 用户保留质押 NEO 的记账所有权。
- NEO 转账 data 为 `miniapp-profitanchor` 时，合约会在同一回执中先记账再质押；
  未质押余额可通过 `withdrawCredit` 由用户本人取回。
- 管理员可以注册 AA 生成的 agent 账户并更新候选人收益分。
- ProfitAnchor 只暴露最高收益候选人用于池化 NEO 投票。
- 管理员方法不能转走用户质押的 NEO，也不能触碰用户奖励 GAS。
- SelfLoan 可以读取 ProfitAnchor 的最佳候选人，并由 SelfLoan 合约自己使用抵押 NEO 投票，不转移抵押资产托管权。
