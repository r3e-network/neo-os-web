# SelfLoan（自我借贷）

SelfLoan 是一个独立的 Neo N3 抵押借贷台：存入整数 NEO，选择 20%、30% 或 40% LTV 档位，并从运营方注资的资金池借出 GAS。债务不计利息，已部署合约没有清算方法；借款人全额偿还 GAS 债务后，合约才会释放全部抵押 NEO。

它不是自动还款或生息贷款。已部署合约不会使用抵押品投票、不会收取 NEO 收益、没有 Keeper，也没有实时市场预言机。新债务依据运营方写入链上的 `neoPrice` 配置值计算。

## 产品流程

1. 连接 Neo N3 钱包；应用读取 NEO/GAS 余额、活跃仓位、恢复额度、LTV 档位、手续费、配置报价与资金池流动性。
2. 选择整数 NEO 抵押数量和一个 LTV 档位。
3. 预览借款本金、0.5% 发放手续费、实际到账 GAS、配置报价，以及需要两次钱包确认的交易路径。
4. 先确认 NEO 存入（`selfloan:collateral`），再确认 `borrow(borrower, tier)`。
5. 每个钱包只能有一个活跃仓位；可以部分/全额偿还 GAS，或追加 NEO 抵押品。
6. 全额还款会释放全部 NEO；部分还款仅降低债务，抵押品继续锁定。

原生 NEO/GAS 转账不使用 ERC-20 式 allowance。借款/追加抵押最多需要两次钱包确认；还款会把 GAS 转账与 `repay` 原子打包在一笔交易中，第二个脚本失败不会留下新的独立还款额度。

## 失败即关闭（Fail-closed）

- 报价、手续费、资金池、钱包余额、仓位与恢复额度都会严格验证；读取失败或格式异常不会伪装成真实的 0，而是直接禁用写操作。
- 每个资金操作都会在首次转账前重新读取关键状态。
- 借款预览会携带精确的报价、手续费、LTV 和到账金额；签名前如有变化，操作会停止并要求重新预览。
- 应用精确读取现有抵押/还款额度，只补充差额，绝不会把失败的额度读取当作 0。
- 存入交易已广播但未确认时，不会发送第二步合约调用。
- 已广播但未确认的调用只显示“等待确认”，不会显示成功。
- 每次请求钱包前，应用都会核对所选网络、合约哈希、在线 NEF 校验和 `927006627`、更新计数 `0`、合约名称、ABI 与事件；同地址部署发生漂移时会关闭写入。
- 每笔广播交易都会立即持久化 txid；刷新恢复只有在精确事件与合约状态读回同时匹配后，才会清除日志并允许下一笔写入。
- 借款/追加的第二步失败时会留下可恢复的 NEO 额度，`withdraw(account)` 可取回。在线 v1 ABI 虽有 `withdrawRepayCredit`，但缺少其确认事件，因此旧 GAS 额度取回控件会失败即关闭；新的原子还款不会再产生该风险。

## 已部署合约模型

当前 manifest 的主网和测试网均指向：

`0x87f94598c78cb954ca8200d3964ded9b584d7250`

2026-07-11 已从 Neo 主网与测试网读取并核对在线 ABI：

| 类型 | 方法 |
| --- | --- |
| 读取 | `neoPrice`、`pool`、`collateralCreditOf`、`repayCreditOf`、`getLoan`、`ltvTierBps`、`feeBps`、`totalLoans`、`totalBorrowed`、`totalRepaid` |
| 借款人写操作 | `borrow(borrower, tier)`、`addCollateral(borrower)`、`repay(borrower)`、`withdraw(account)`、`withdrawRepayCredit(account)` |
| 代币回调 | `onNEP17Payment(from, amount, data)` |
| 运营方写操作 | `setNeoPrice(gasPerNeo)`、`withdrawPool(to, amount)` |

在线 LTV 档位为 2000/3000/4000 bps，发放手续费为 50 bps。`neoPrice` 的单位是“每个整数 NEO 对应的 GAS 基础单位”；GAS 有 8 位小数，NEO 不可分割。

当前主网配置报价为 `3 GAS / NEO`，资金池为 `5 GAS`；测试网配置报价为 `5 GAS / NEO`，资金池为 `2 GAS`。详见 [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) 与 [TESTNET_STATUS.md](./TESTNET_STATUS.md)。当前本地 NEF 校验和与在线版本不同，文档不会把本地产物描述为已部署。

## 恢复语义

- NEO 存入 memo：`selfloan:collateral`
- GAS 还款 memo：`selfloan:repay`（与 `repay` 在同一笔交易中执行）
- 借款/追加抵押会消费该借款人的全部 NEO 抵押额度。
- 还款会消费全部 GAS 还款额度；合约按未偿债务封顶应用，并自动退回超额部分。
- 每个借款人地址只能存在一个活跃贷款。

## 本地开发

```bash
cd apps/self-loan
npm run test
npm run build
npm run dev -- --port 5346
```

界面统一使用共享的 Neo Press Kit 官方 NEO/GAS 代币资源。`public/` 中旧的生成式场景图片包含非官方代币图形，因此不会用于运行时界面。

## 许可证

MIT — R3E Network
