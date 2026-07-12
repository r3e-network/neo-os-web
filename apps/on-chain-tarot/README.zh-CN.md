# 链上塔罗牌

一款已进行生产级打磨的 Phaser 3 三张牌塔罗仪式。当前发布版本只开放本地游客玩法；在钱包付费的 GameFi 合约完成 Oracle/VRF 路径重建和验证之前，不会向用户展示未验证的链上流程。

## 当前版本

- **应用 ID：** `miniapp-onchaintarot`
- **界面：** Phaser 3 仪式桌、发牌与翻牌动画、三枚意图令牌、键盘操作、减少动态效果支持、无障碍解读抽屉
- **模式：** 仅本地游客解读
- **随机性：** Web Crypto + 拒绝采样；没有可预测的 `Math.random()` 降级路径
- **钱包 / GAS：** 不请求、不使用
- **本地保存：** 只保存解读次数；问题和牌面结果不会发布

目录 manifest 已主动移除合约操作、支付权限和随机数权限。GameFi 入口保持关闭，避免把未经验证的链上路径包装成生产功能。

## 为什么暂时关闭 GameFi

测试网上存在两套部署，但都不符合当前产品承诺所要求的合约/API。新的本地替代合约与异步前端流程已经完成，但尚未发布：

| 合约 | 测试网哈希 | 实时 ABI 状态 | 发布判断 |
|---|---|---|---|
| 旧版 `MiniAppOnChainTarot` | `0x5cdf29c30727ce06696736ae0fb49abd9fd79730` | Oracle 风格的 `requestReading` / `onOracleResult`；历史目录和域名曾指向此哈希 | 与当前 `ReadingDrawn` 客户端流程不兼容 |
| 独立 `MiniAppTarot` | `0xb680225a1be276b03ecd7de82ea985dcc7435cec` | 预存、`draw`、`ReadingDrawn`、退款和读回接口 | 使用同交易 `Runtime.GetRandom`，不是 Oracle VRF |

新的 `MiniAppTarotVrf` 已实现可复用额度、Morpheus 请求/回调结算、三张不重复卡牌、待处理状态持久化、最终状态读回、失败/超时完整退回读牌费用，以及只统计成功牌阵的 HUD 计数。预言机等待期间，Phaser 牌桌会保留真实牌背并提供“检查结果”；超时后主操作会切换为“取回读牌费用”，不会把请求已提交误报成抽牌成功。部署、预言机白名单、储备金、真实钱包测试以及 manifest/域名绑定完成前，`supportsGameFi` 仍保持关闭。

上述 ABI 已于 2026-07-11 从 Neo N3 测试网实时读取。完整启用条件见 [TESTNET-STATUS.md](./TESTNET-STATUS.md)。

只有同时满足以下条件，才能重新开启 GameFi：

1. Oracle/VRF 请求与异步结算，并严格绑定请求和解读记录。
2. 三张牌互不重复、索引在 0–77 范围内，并可链上读回。
3. 预存、抽牌、取消/退款、重放保护、事件与状态读回全部正确。
4. 合约注册表、miniapp manifest 和 `.miniapp.neo` 域名指向同一个已验证哈希。
5. 在测试网钱包完成拒签、超时、重试、结算、恢复和未用余额提现的端到端验证。

## 开发

```bash
npm test
npm run build
npm run dev
```

牌面来源与生成牌组的溯源记录见 [public/cards/ATTRIBUTION.md](./public/cards/ATTRIBUTION.md)。

## 许可证

MIT License — R3E Network。第三方牌面来源仍遵循溯源记录中的原始条款。
