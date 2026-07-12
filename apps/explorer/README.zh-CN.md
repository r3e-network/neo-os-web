# Neo 浏览器

Neo 浏览器是一个面向 Neo N3 主网和测试网的只读链上工作台。它可以搜索真实区块高度、交易或区块哈希、Neo 地址与合约哈希，并明确展示返回对象所属网络和数据来源。

## 产品边界

- 不需要连接钱包、签名、支付，也没有小程序自有合约。
- 主网和测试网是彼此独立的查询通道。切换网络会清除旧结果并重新加载该网络的最近交易。
- 界面不会根据输入伪造结果，而是明确区分：找到记录、标识符有效但所选网络没有记录、标识符无效、Explorer 服务不可用。
- 搜索、网络遥测、最近交易、缓存快照和原始 API 记录具有独立状态与展示层级。

## 支持的标识符

| 标识符 | 接受格式 | 解析路径 |
| --- | --- | --- |
| 区块高度 | 1–10 位十进制数字 | Neo N3 RPC `getblock` |
| 交易或区块哈希 | `0x` 加 64 位十六进制字符 | 先查索引器交易，再回退 RPC 交易/区块查询 |
| Neo 地址 | 有效的 34 字符 Neo N3 地址 | 已索引地址活动 |
| 合约哈希 | `0x` 加 40 位十六进制字符 | 已索引调用，并可回退 RPC `getcontractstate` |

客户端校验与生产 Explorer API 保持一致。完整记录不会缩短哈希；只有最近交易栏使用紧凑显示。

## 数据来源语义

- 区块高度通过平台 Explorer API 从 Neo N3 RPC 读取。
- 交易总量来自索引器同步状态；索引器未提供有效数字时显示不可用。
- 交易详情、地址活动、执行轨迹和合约调用优先使用索引器；API 支持的交易与合约查询可回退 Neo RPC。
- 最近交易优先使用索引器，并可回退扫描最近 RPC 区块。
- 页面可见时，网络统计每 15 秒刷新，最近交易每 30 秒刷新。
- 缓存数据会明确标记为缓存快照；实时请求失败时不会把缓存误标为实时数据。

## 界面层级

1. 一个紧凑搜索命令栏，同时选择网络。流程完全由内嵌工作区负责；发布清单不会再生成一套重复的宿主参数表单。
2. 主结果区直接渲染真实交易、区块、地址或合约字段。
3. 次级遥测栏展示所选网络及最近交易。
4. 抽屉中放置完整最近交易、原始 API 记录和数据来源说明。

空状态使用仓库现有 WebP 浏览器资源；找到记录后，真实链对象会替换插画，而不是继续叠加装饰卡片。资源来源和完整性记录在 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。

## 恢复行为

- 无效输入在本地处理，并说明支持的 Neo N3 格式。
- 有效标识符在所选网络没有记录时，保留原查询并显示准确的未命中状态。
- API、RPC 或索引器失败保持可重试，不会变成空白成功状态。
- 切换网络或发起更新搜索后，旧请求的迟到响应不会覆盖当前界面。
- 最近交易加载期间切换网络时，新网络请求会排队执行，不会等待下一轮轮询。

## 开发与验证

```bash
npm --prefix apps/explorer run dev -- --port 5362
npm --prefix apps/explorer run build
npx tsc --noEmit -p apps/explorer/tsconfig.json
npx eslint apps/explorer/src --ext .ts,.tsx
cd apps/shared && npx vitest run test/explorer.logic.test.ts test/explorer.playarea.test.tsx test/explorer.integration.test.tsx test/explorer.test.tsx test/explorer.production.test.ts
```

只读网络证据和剩余限制记录在 [NETWORK_STATUS.md](./NETWORK_STATUS.md) 与 [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md)。
