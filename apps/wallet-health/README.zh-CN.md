# 钱包检查 MiniApp

钱包检查是一个 Neo N3 只读余额检查与设备本地安全自检工具。它只陈述能够证明的事实：连接状态、NEO/GAS 余额和 `0.1 GAS` 预留；它不能审计私钥、助记词保存、已连接应用授权、设备安全、恶意软件或交易意图。

## 功能

- 通过宿主钱包接口连接钱包。
- 对固定的钱包地址独立读取 NEO 与 GAS 余额，并核验已连接钱包网络。
- 检查读取到的 GAS 是否达到 `0.1 GAS`。
- 将人工确认的自检项保存在浏览器本地。
- 导出包含只读观察与自行确认答案的文本报告。
- 账户切换或断开后立即清除旧证据并丢弃迟到响应；刷新失败时，仅会在明确标注“上次值”的前提下保留历史值。
- 钱包连接请求超过 12 秒后恢复为可重试状态。
- NEO、GAS 或钱包网络读取分别超过 15 秒后超时，避免界面永久卡住。

## 明确边界

- 不调用合约，不发送交易。
- 不申请支付、随机数、预言机或 TEE 权限。
- 不读取或索要私钥、助记词。
- 不读取或撤销钱包授权。
- 清单百分比只表示自检进度，不是安全评分或安全保证。

## 隐私

清单继续使用兼容旧版本的本地键 `miniapp-wallet-health:checklist`，不会发送到后端。钱包地址和余额仅在连接后读取。复制报告属于明确的用户操作，会把报告内容写入剪贴板。

## 开发验证

```bash
npm run dev
npx tsc --noEmit -p apps/wallet-health/tsconfig.json
npx vitest run test/wallet-health.playarea.test.tsx test/wallet-health.logic.test.ts test/wallet-health.integration.test.tsx test/wallet-health.analysis.test.ts test/wallet-health.production-safety.test.ts
npm run build
```

完整证据状态矩阵与发布门禁见 `PRODUCTION_STATUS.md`。本应用不需要也没有部署小程序合约。
