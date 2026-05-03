# TrustAnchor MiniApp

TrustAnchor 是面向治理的 NEO 质押 anchor 小程序。它使用共享
`PlatformAnchor` 合约，并用 AA 生成的 agent 账户作为投票身份。

| 属性 | 值 |
| --- | --- |
| App ID | `miniapp-trustanchor` |
| 分类 | Governance |
| 合约 | `PlatformAnchor`，模式 `1` |
| 管理员权限 | 注册 agent、更新候选人、同步投票 |

## 安全模型

- 用户 NEO 在 `PlatformAnchor` 中记账，只能由该用户本人签名赎回。
- NEO 转账 data 为 `miniapp-trustanchor` 时，合约会在同一回执中先记账再质押；
  未质押余额可通过 `withdrawCredit` 由用户本人取回。
- 用户奖励 GAS 只能由该用户本人签名领取。
- 管理员不能把用户质押 NEO 或奖励 GAS 转给任意地址。
- AA agent 账户提供投票身份；`voteAgent` 还要求 agent 账户签名，因此只有管理员权限不能移动 AA agent。

## 产品模型

- TrustAnchor 通过已注册的 AA agent 账户显式管理治理敞口。
- 每个 agent 记录账户哈希、候选人公钥、verification-script 哈希和展示权重。
- 管理员操作仅限路由配置和仅投票同步。
- GAS 奖励使用共享的 reward-per-NEO 累加器记账。

## 投票收益路由边界

TrustAnchor 支持池化 NEO 投票和候选人路由以提升 GAS 收益，但不提供管理员托管用户质押或已记账 GAS 的路径。

## 部署

前端和合约源码已面向共享 `PlatformAnchor` 部署准备完成。网络哈希保持为空，
直到共享合约部署且完成 `registerAnchorApp("miniapp-trustanchor", 1, appAdmin)`。
