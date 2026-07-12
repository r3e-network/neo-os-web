# Neo 多重签名

Neo 多重签名是已部署 `MiniAppMultisig` 托管合约的生产化阈值批准界面。

> 该应用**不会**构造 Neo 原生多签地址，也不会拼接原生多签见证。资金由一个规范合约地址托管，不同金库由链上金库 ID 隔离；签名人使用各自钱包调用合约来批准请求。

## 使用流程

1. 连接 Neo N3 钱包，使用 2–16 个互不重复的签名人地址和 1-of-N 至 N-of-N 阈值创建金库；创建者必须在签名人列表中。
2. 向已加载金库存入整数 NEO 或最多 8 位小数的 GAS。
3. 填写接收地址、资产、金额和可选的 160 字符备注，创建支出请求。
4. 分享请求 ID。每位签名人只能批准一次；任一签名人都可取消待处理请求。
5. 达到阈值时合约自动转账。待处理请求不会预留余额；如果另一请求先行支出，当前请求会因余额不足自动取消。

首屏是有主次关系的共管金库工作台，而不是大面积参数表单：使用真实金库/提案资源、官方 NEO/GAS 图标、签名人名单、已验证余额、批准进度和单一上下文主操作；详细输入收纳在次级工具抽屉。

## 交易正确性

- 所有读写都绑定当前网络的规范合约哈希。
- 钱包网络与启动网络不一致时阻止访问合约。
- 不会仅凭交易 ID 或 relay 返回值宣告成功。
- 每个写操作都等待精确合约事件，并回读受影响的金库/请求。
- 超时或刷新后可使用本地保存的交易上下文恢复确认。
- 应用日志为 `FAULT` 时清理待处理状态，且不会写入成功结果。
- 批准前重新读取 `hasApproved`，阻止重复批准。
- ID、余额和 token 基础单位使用整数安全路径，展示转换不经过 JavaScript 浮点数。

## 已部署合约

| 网络 | 合约 |
| --- | --- |
| Neo N3 主网 | `0xa361cdc792e97c4d8ddf42048cf48f3283ea7178` |
| Neo N3 测试网 | `0xa361cdc792e97c4d8ddf42048cf48f3283ea7178` |

线上 ABI 包含 `createVault`、`createRequest`、`approve`、`cancel`、`balanceOf`、`getVault`、`getRequest`、`hasApproved`、`lastVaultId`、`lastRequestId` 与 `onNEP17Payment`。界面会核验金库创建、存入、请求创建、批准、执行、取消和余额不足事件。

当前测试边界见 [TESTNET_STATUS.md](./TESTNET_STATUS.md)。

## 开发

```bash
npm run test --workspace apps/neo-multisig
npm run build --workspace apps/neo-multisig
```

该应用使用 Vite、React 和平台共享小程序设计系统实现。
