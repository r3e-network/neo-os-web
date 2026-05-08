# TrustAnchor MiniApp

TrustAnchor 是面向信任策略的手动 AA agent 路由台。它用 21 个 AA agent 表示 21 个 council candidate，运营方明确调仓并同步投票，不做自动轮换。

| 字段 | 值 |
| --- | --- |
| App ID | `miniapp-trustanchor` |
| 合约 | `PlatformAnchor` 共享合约，模式 `1` |
| 资产 | NEO |
| Agent 集合 | 21 个 AA 账户 |

## 模型

- 每个注册的 anchor 都有自己的 21 个 AA agent，对应 21 个 council candidate。
- AA accountId 派生参数应包含 `anchor + appId + agentId + nonce`，避免被提前恶意注册。
- 调仓就是从候选人 A 的 agent 向候选人 B 的 agent 转移 NEO。
- 候选人列表变化时，先更新 agent 的 candidate 公钥，再同步该 agent 投票。
- `transferAgentNeo` 和 `voteAgent` 需要对应 agent AA witness；只有管理员权限不能移动 agent 资金。
