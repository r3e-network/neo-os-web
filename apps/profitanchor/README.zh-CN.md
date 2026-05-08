# ProfitAnchor MiniApp

ProfitAnchor 是面向收益策略的手动 AA agent 路由台。它不是自动寻找最高收益的机器人；运营方明确决定路由，然后在 21 个候选人 agent 之间调仓并同步投票。

| 字段 | 值 |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| 合约 | `PlatformAnchor` 共享合约，模式 `2` |
| 资产 | NEO |
| Agent 集合 | 21 个 AA 账户 |

## 模型

- 每个注册的 anchor 都有自己的 21 个 AA agent，对应 21 个 council candidate。
- AA accountId 派生参数应包含 `anchor + appId + agentId + nonce`，避免被提前恶意注册。
- 调仓就是从候选人 A 的 agent 向候选人 B 的 agent 转移 NEO。
- 候选人列表变化时，先更新 agent 的 candidate 公钥，再同步该 agent 投票。
- SelfLoan 可以读取 ProfitAnchor 当前人工选择的路由，但不转移抵押资产托管权。
