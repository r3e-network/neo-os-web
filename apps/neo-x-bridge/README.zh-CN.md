# Neo X 跨链桥

Neo X 跨链桥是一个以路径为主的钱包准备、交接与源链核验界面，覆盖 Neo N3 与 Neo X 之间的 GAS、NEO 双向跨链。

## 本小程序会做什么

- 支持官方跨链桥当前开放的 GAS 与 NEO 双向路径。GAS 输入最多 8 位小数，NEO 只能输入整数。
- 连接源钱包并重新核验网络、账户；在存在可信读取器时，以 bigint 精确读取余额（Neo N3 的 NEO/GAS 与 Neo X 的原生 GAS）。
- 把环境、方向、源/目标链 ID、资产精度、源账户、数量、需匹配的目标钱包、本地有效期和本地票据引用绑定为同一份核对快照。
- 跳转到与网络匹配的官方跨链桥，由官方界面提供可信报价、费用与钱包签名。
- 本地票据与源链检查请求必须通过存储写入/读回校验；刷新后仅在环境、方向、账户、资产、哈希、请求 ID 与摘要完全匹配时恢复。
- 在正确的源链上读取用户提供的源交易。
- 把源交易、源链桥事件、目标链事件和目标链状态读回划分为独立证据边界。

## 本小程序刻意不做什么

- 不转移资金，也不签名交易。
- 不能预填或提交官方跨链桥；用户需要在那里重新连接两端钱包，并再次核对路径、数量、目标钱包、实时限额、报价、费用与必要授权。
- 不伪造桥接报价。在官方跨链桥提供前，输出数量、桥接费、网络费和官方报价有效期都保持未知。
- 官方文档给出的常见跨链时间约为 1–2 分钟，但拥堵会改变时间；本小程序不会把估算时间当成完成证明。
- Neo X 上的 NEO 是已注册桥接代币；在仓库提供权威 token registry 绑定前，本小程序不伪造其 EVM 余额，而由官方跨链桥重新核对。
- 源链回执已确认，绝不等于目标链已经交付。
- 即使回执或日志来自已知桥地址，在缺少权威 ABI/topic，以及方向、token、数量、接收地址、请求和摘要的解码匹配前，也不会被当作精确事件证据。
- 不再暴露旧的通用 MessageBridge 载荷表单。生产 MessageBridge 流程还需要 ABI 编码、费用、nonce 跟踪、中继、目标链执行及可选结果回传；本小程序只链接官方开发文档。

## 用户流程

1. 选择 GAS 或 NEO，以及跨链方向。
2. 连接源钱包；小程序重新核验账户与网络，并在可用时显示精确余额。
3. 连接目标钱包自动绑定地址，或输入有效的目标链地址。
4. 生成有效期 10 分钟的本地交接快照。
5. 前往官方跨链桥，重新连接两端钱包，并在签名前再次确认路径、数量、目标钱包、实时限额、报价、费用与授权。
6. 在“检查源链回执”中粘贴源交易哈希；重复检查保持幂等且可安全重试。
7. 只有获得可信的目标链事件和状态读回后，才能认定交付完成。

切换路径或修改交易哈希会立即清除旧证据。对于 Neo X，回执与交易查询都找不到的哈希显示为“未知”；能够查到交易但尚无回执时才显示“待确认”。

## 验证

```bash
cd apps/neo-x-bridge
npx vitest run test --environment node
npx tsc -p tsconfig.json --noEmit
npx eslint src test
npm run build

cd ../shared
npx vitest run test/neo-x-bridge.playarea.test.tsx
npx vitest run test/neo-x-bridge.integration.test.tsx
```

当前服务边界见 [NETWORK_STATUS.md](./NETWORK_STATUS.md)，资源来源见 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。

## 事实来源

- 当前官方跨链桥：<https://xbridge.neo.org/>
- 官方资产跨链指南：<https://xdocs.ngd.network/bridge/quick-start-bridging-assets>
- 官方 TokenBridge 架构：<https://xdocs.ngd.network/bridge/token-bridge>
