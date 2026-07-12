# Neo 国库

Neo 国库是一个公开余额观察工具，并提供注重安全的原生代币转账界面。它**不控制**观察地址，也不是国库多签合约。

## 产品边界

- 余额场景从 Neo N3 **主网**读取一组由社区归属于 Da Hongfei 与 Erik Zhang 的固定公开地址。
- 这 44 个创始人分组地址已于 2026-07-12 对照 `https://neo-treasury.pages.dev/` 复核；两个指定分组以外的地址不会混入本应用汇总。
- 转账只会花费当前已连接钱包中的资产。
- 本应用没有自有部署合约，而是直接调用原生 NEO 或 GAS 代币合约。
- 观察清单不是官方所有权登记。将其用于治理、会计或合规判断前，应独立核实地址归属。

## 主要流程

1. 查看主网观察清单的 NEO/GAS 原生余额、社区归属分配，以及独立的余额/价格新鲜度信号。
2. 打开支出抽屉，选择 NEO 或 GAS、金额和收款人。
3. 核对精确网络、原生代币合约、来源钱包、收款 Hash160、基础单位金额和可选备注。
4. 在已连接钱包中再次核对相同内容并签名。
5. 广播后同时等待：
   - 与交易 ID、网络、代币合约、发送人、收款人和金额完全匹配的原生 `Transfer` 事件；
   - 与该转账一致的原生代币 `balanceOf` 权威状态回读。

仅获得交易 ID 不会被显示为转账成功。

## 钱包安全与恢复

- 钱包网络必须明确解析为选定的 Neo N3 主网或测试网；未知或不匹配网络会失败关闭。
- NEO 只允许整数金额；GAS 最多支持八位小数。
- 在打开钱包前会阻止自转账、非正数、无效地址、过长备注、余额不足以及花光全部 GAS 的操作。
- 每次写入都会基于当前钱包和网络重新构建钱包审核内容。原生转账没有应用强制或链上到期机制，用户必须检查钱包提示，不能假设存在到期保护。
- 钱包返回交易 ID 时，会立刻按网络持久化精确广播绑定及转账前双方余额。
- 刷新页面或点击“检查转账证明”只会核查已保存的交易 ID，绝不会再次签名或广播。
- 等待、确认服务不可用、余额回读延迟、绑定不匹配与已确认状态会明确区分。
- 只有发送方与收款方原生余额都与已保存的转账前基线一致时才会确认成功；单边余额变化不足以确认。

## 原生合约

主网和测试网使用相同的 Neo 原生合约哈希与 ABI：

| 资产 | 合约 | 转账 ABI | 确认事件 |
| --- | --- | --- | --- |
| NEO | `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5` | `transfer(Hash160 from, Hash160 to, Integer amount, Any data) -> Boolean` | `Transfer(Hash160 from, Hash160 to, Integer amount)` |
| GAS | `0xd2a4cff31913016155e38e474a2c06d08be276cf` | `transfer(Hash160 from, Hash160 to, Integer amount, Any data) -> Boolean` | `Transfer(Hash160 from, Hash160 to, Integer amount)` |

两个合约都提供安全的 `balanceOf(Hash160) -> Integer` 读取，用于可支出余额检查与事件后的状态核验。

## 当前不存在的治理控制

本应用没有国库金库、提案 ID、签名人列表、法定人数、管理员角色、时间锁或链上提案到期机制。把直接转账描述为受治理的国库动作会误导用户；需要这些控制时应使用治理型多签/金库产品。

## 网络

- 默认转账网络：Neo N3 主网。
- 支持转账网络：Neo N3 主网和测试网。
- 公开观察清单：仅主网；即使在测试网打开转账界面也会明确标注。
- 测试网只读核验：见 [TESTNET_STATUS.md](./TESTNET_STATUS.md)。

## 视觉系统

- 国库桌面插画是主要视觉资源，使用干净白色前景、暖金色和 Neo 绿色强调。
- NEO/GAS 通过共享 `CoinArt` 组件渲染，使用 Neo 官方 press-kit 代币资源。
- 生产资源来源、用途与完整性哈希记录在 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。
- 首屏优先展示公开余额与社区归属分配；美元数字明确标记为估值，而不是可支出余额。
- 余额缓存新鲜度与 Morpheus 价格记录新鲜度分开显示；价格延迟不会把新鲜原生余额误标为缓存。
- 只有 NEO 与 GAS 两条价格均为有效正数时才会显示美元估值，避免缺失 GAS 报价时静默低估观察清单。
- 原生代币余额使用 `BigInt` 按最小单位解析与汇总；界面展示的 NEO/GAS 数值不会经过浮点舍入，JavaScript 数字仅用于明确标注为估算值的美元计算。
- 未初始化且数值为零的 Morpheus `AGG:*` 记录会回退到实时提供商记录，不会压制可用报价。
- 转账输入、完整 44 地址清单和执行策略放在抽屉中，让仪表盘与一个主操作保持清晰层级。

## 开发验证

```bash
npm --prefix apps/neo-treasury run dev -- --port 5361
npm --prefix apps/neo-treasury run build
npx tsc --noEmit -p apps/neo-treasury/tsconfig.json
npx eslint apps/neo-treasury/src --ext .ts,.tsx
npx vitest run apps/shared/test/neo-treasury.logic.test.ts apps/shared/test/neo-treasury.playarea.test.tsx apps/shared/test/price-feed-freshness.test.ts apps/shared/test/official-token-assets.test.tsx
```
