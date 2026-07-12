# FogPlay（迷雾对决）— Neo N3 上的 Phaser 抛硬币游戏

FogPlay 当前提供生产可用的本地玩法，并保留一套暂时关闭的 GameFi 实现：

- **本地游玩**：不连接钱包，不使用 GAS，不请求预言机，也不上链。选择正反面，操作真实设计资源，冲击连胜。
- **GameFi**：使用独立的 `MiniAppCoinFlipV2` 提交/揭晓合约；由于公开部署与当前审计产物不一致，付费入口保持安全关闭。

主界面是 Phaser 3 游戏桌，而不是交易表单。正反面硬币资源、动态底座、抛起/翻面/落地动画、音效、简洁结果与局内恢复抽屉共同组成完整游戏流程。

## 保留的付费抛掷设计

1. 选择正面或反面，再选择桌面筹码。
2. `commit(player, choice, amount)` 托管预付 GAS，并预留庄家赔付敞口。
3. 等待完整的三块信标窗口；提交交易发生时，结果尚不可知。
4. 窗口完成后，任何人都可以调用 `settle(betId)`。合约使用之后三块区块哈希生成固定结果，胜者获得 2 倍赔付。
5. 如果索引或结算中断，前端会持久化精确交易、玩家、合约、网络、选择和金额，用于安全重试。
6. 未使用的预付余额可通过 `withdraw(account)` 退回。

多块信标关闭了旧版“同一交易内预知输局并中止”的漏洞，也比单块随机源提高了操纵成本。它面向低额玩法，并不等同于 VRF 级随机性。

以上架构为下一次兼容部署保留，并不表示当前已开放钱包付费产品。

## 生产安全边界

- `supportsGameFi`、支付/随机数权限、host 操作及运行时付费开关均已关闭。
- 错误网络、旧 host 或旧合约都不会触发新下注的钱包签名请求。
- `Committed` 事件只可用于恢复精确 bet id；`Settled` 事件或交易广播不能单独确认结果。
- 只有 `getPendingBet` 精确回读验证 id、玩家、选择、下注金额、终态、结果、胜负关系与赔付后，UI 才会显示胜负。
- 结算必须与 pending 的 bet id、玩家、选择、结果、胜负标记及精确的 0/2 倍赔付一致。
- 已存在的 pending 下注与预付余额仍保留揭晓和提取恢复路径。
- 对外 manifest 不暴露通用操作表单。

## 合约

| 项目 | 值 |
| --- | --- |
| 合约 | `MiniAppCoinFlipV2` |
| 已发布绑定 | Neo N3 测试网（只读兼容参考） |
| Script Hash | `0x611c3d97dd98792a3c31a0e695704c657f143cda` |
| 下注范围 | 0.05–100 GAS，同时受 `freeBankroll / 2` 上限约束 |
| 随机性 | 提交后的固定三块原生信标 |
| 写操作 | `commit`、`settle`、`withdraw` |
| 读操作 | `bankroll`、`reservedBankroll`、`freeBankroll`、`creditOf`、`getStats`、`getPendingBet`、`playerBetCount`、`getPlayerBets` |

7 月 10 日的真实流程验证覆盖了当时部署的产物。当前只读核验显示，测试网和主网公开部署 checksum 均为 `2385475183`，而当前审计的本地产物为 `4009970425`，ABI 也不一致。因此历史写入报告不能证明当前构建已部署。详见 `TESTNET_STATUS.md` 与仓库根目录的 `docs/reports/fogplay-v2-testnet-live-2026-07-10.md`。

本次前端工作没有发送交易、使用密钥、部署或更新合约。

## 开发

```bash
cd apps/fogplay
npm install
npm run dev
npm test -- --run
npx tsc --noEmit
npx eslint src
npm run build
```

合约测试：

```bash
cd contracts/__tests__
dotnet test NeoContracts.Tests.csproj \
  --filter FullyQualifiedName~MiniAppCoinFlipV2Tests
```

## 技术栈

- React + TypeScript 小程序壳层
- Phaser 3 可玩场景
- Neo N3 C# 智能合约
- N3Index / RPC 读取
- 浏览器 Web Crypto（本地玩法随机数）

## 许可证

MIT License — R3E Network
