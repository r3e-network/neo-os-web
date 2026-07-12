# Neo 兑换

Neo Swap 是面向生产环境设计的 NEO/GAS 报价工作台。它从 Morpheus 数据源读取两条价格记录，计算交叉汇率和最少收到数量，并以清晰的兑换终端呈现。

目前 `neo-manifest.json` **没有部署兑换路由**。因此小程序保持在规划模式：可以刷新公开报价，也可以选择连接钱包读取余额，但不能提交兑换，更不会声称交易已经成功。

## 当前产品行为

- 刷新公开 NEO/GAS 报价不要求连接钱包。
- NEO 与 GAS 统一使用仓库内 Neo Press Kit 官方资产。
- 只有两条价格记录均为有限正数时才接受报价，并会立即把 Morpheus 固定六位价格还原为整数。
- 聚合记录若尚未初始化（`HALT` 但价格/时间均为零），会回退到同一合约的显式 `TWELVEDATA:*` 记录；来源记录仍为零时继续关闭报价。
- 新鲜度以较旧的链上 `recordTimestamp` 为准；缺失或超过 10 分钟即视为过期。
- RPC/数据源失败时清除旧报价并提供重试，不显示虚构的兜底价格。
- 报价响应绑定具体交易对，切换代币后，较早的异步响应不能覆盖新方向。
- NEO 小数和超出代币精度的输入会明确报错，不再静默截断。
- 输出与最少收到值直接使用代币最小单位和 `BigInt` 计算；界面展示的六位汇率不会反向参与交易计算。
- 滑点设置只影响整数最少收到下限，不会改变报价结果。
- GAS“最大”会预留 0.1 GAS 网络费；NEO“最大”始终为整数。
- 钱包余额通过 `app.wallet.raw()` 读取；只有钱包网络与报价网络完全一致时才接受结果，网络不明确、不匹配或账户已切换时保持不可用。

## 结算边界

`contracts` 目前为空。平台出现非空合约地址并不足以启用结算；它还必须与 `src/settlement.ts` 中已复核的网络、Hash160、操作、确认事件和 ABI 版本完全一致。当前激活绑定为 `null`，因此主操作只负责刷新报价，`canSwap` 始终为 false。

代码中保留了兼容既有 API 的结算适配器，但只有满足以下条件才能启用：

1. 已完成生产复核并实现 `swapTokenInForTokenOut` 的路由部署到目标网络；
2. 地址写入平台 manifest/合约注册表；
3. `SwapExecuted` 事件格式与确认语义通过集成测试；
4. 路由输出、费用、截止时间和最少输出保护在测试网完成实测；
5. 重新完成业务逻辑、钱包路径与错误恢复验收后，才启用 `payments` 权限。

未来满足这些门槛后，交易适配器会在广播时立即持久化精确 txid、阻止重复提交、等待该交易对应的 `SwapExecuted` 事件，并要求路由绑定的验证器把事件与钱包、资产对和整数金额意图逐项对应；刷新页面后仍会保留尚未核验的交易供用户恢复检查。仅广播或仅出现同名事件都绝不会被显示为兑换成功。

在这些门槛完成前，界面和文档都只能把它描述为报价/规划工具，不能声称存在流动性池或可执行 DEX。

## 数据与钱包

- 报价来源：Morpheus 针对 NEO/GAS 的 `getPriceWithMeta()`。
- 展示时间：两条数据中较旧的上游 `dataTimestamp`。
- 新鲜度判定时间：两条数据中较旧的链上 `recordTimestamp`。
- 钱包数据：只有当前地址的原始 NEO/GAS 最小单位读取成功核验后才显示数值；未连接、读取失败或切换账户时显示“不可用”，不会伪装成 0 余额。
- 托管：无。
- 独立小程序合约：无。

## 开发与验证

```bash
npm --prefix apps/neo-swap run dev
npm --prefix apps/neo-swap run build
npx tsc -p apps/neo-swap/tsconfig.json --noEmit
cd apps/shared
npx vitest run test/neo-swap.logic.test.ts test/neo-swap.playarea.test.tsx test/neo-swap.integration.test.tsx test/neo-swap.production.test.ts test/official-token-assets.test.tsx
```

Vite 会输出本地开发地址；视觉与钱包验收需在后续使用用户选择的浏览器完成。

资产来源见 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)，当前网络启用状态见 [TESTNET-STATUS.md](./TESTNET-STATUS.md)。
