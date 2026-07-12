# ProfitAnchor 小程序

ProfitAnchor 是 `PlatformAnchor` 模式 `2` 的 DeFi 用户端。用户可以质押整数
NEO、赎回实时仓位并领取真实累计的 GAS；Agent 注册、AA 路由调仓、候选人
更新与投票同步仍留在独立管理端，不在用户界面暴露。

## 产品界面

- 使用现有储备场景资源作为主画面，只保留一个主质押 CTA。
- 赎回、领取、余额恢复、活动历史、规则和原始诊断全部收进次级抽屉。
- 链上读取失败或格式错误时显示不可用，不把失败伪装成 `0`。
- 不展示预测 APY；“储备覆盖”只是当前每个已质押 NEO 对应的已注资 GAS，
  不是承诺收益。

## 精确绑定与恢复

| 项目 | 值 |
| --- | --- |
| App ID | `miniapp-profitanchor` |
| 模式 | `2` |
| Mainnet | `0x02beeef6f65c6989a121c0a0e6b23190333edb98` |
| Testnet | `0xab079b4f9a0a2471d136392e25eb8e99898dcad0` |

每次写操作前都会重新核对 network、contract、appId、mode、wallet 与实时
余额，并先验证本地恢复存储。交易广播后立即持久化完整 intent 与 txid；刷新
只核对已保存交易，不会重复发送。只有 VM `HALT`、精确 Anchor 事件和权威
回读同时匹配才显示成功。

详情见 `PRODUCTION_STATUS.md`、`NETWORK_STATUS.md` 和
`ASSET_PROVENANCE.md`。
