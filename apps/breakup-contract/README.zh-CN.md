# 分手合约

Neo N3 上由双方等额质押支持的承诺约定。

## 产品逻辑

1. 创建者预存至少 1 GAS，指定唯一伴侣和期限后创建约定。
2. 约定进入待签状态；只有被指定的伴侣可以补足完全相同的质押并激活。
3. 到期前，任一参与方都可以违约；两份质押会记入另一方的合约可提取额度。
4. 到期后，任何人都可触发结算；双方各自的质押分别进入自己的可提取额度。
5. 待签约定只能由创建者取消，创建者质押会进入其可提取额度。
6. 所有退款和赔付都采用 pull payment；必须再执行一次见证校验的 `withdraw`，GAS 才会回到钱包。

已部署合约不包含里程碑奖励、修改条款、双方协商分配、收益、预言机或自动钱包退款。

## 链上数据与本地数据

约定 ID、参与方、质押、到期时间、签署状态、生命周期、违约方和可提取额度均以链上为准。标题与备注只保存在当前设备，并按网络与合约隔离；旧版主网本地元数据仍可读取。若链上创建成功但本地保存失败，界面会明确报告部分成功，不会伪装成完整成功。

## 交易恢复

- 发起充值前先读取 `creditOf`，优先复用已有额度，只充值差额。
- 只有 txid 代表已广播，不代表成功；界面会保持 pending。
- 唤起钱包前会先核验恢复存储，以及钱包网络与合约的精确绑定。
- `onTransactionSent` 会立即保存精确意图、网络、合约、钱包与 txid。
- pending 只会在权威 VM `FAULT`，或 `HALT` + 精确事件 + 最新权威回读三者同时成立时结束；未知结果不会按时长删除。
- 刷新只恢复并核验，不会重播原操作。
- 无法读取的额度或 `lastPactId` 会保持 unavailable，不会被当作 0。

## 部署绑定

| 网络 | 合约 | 2026-07-12 只读核验 |
|---|---|---|
| Neo N3 主网 | `0xf6769c080395f15c28013108b7af7631e1665336` | `MiniAppBreakupPact`、NEF checksum `2044887039`、完整约定/额度 ABI 与事件、`lastPactId` HALT |
| Neo N3 测试网 | `0xf6769c080395f15c28013108b7af7631e1665336` | 独立返回相同名称、checksum、ABI/事件和 HALT 读取结果 |

仓库当前构建产物还包含线上部署中不存在的管理员/升级方法。前端只使用两网均已核验的约定生命周期与额度 ABI。本轮前端收口没有部署合约，也没有执行有资金的写入测试。

证据与发布边界见 [NETWORK_STATUS.md](./NETWORK_STATUS.md)、[PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) 与 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。

## 开发

```bash
npm --prefix apps/breakup-contract run dev
npm --prefix apps/breakup-contract run build
```

宿主 operation panel 特意保持为空；完整流程和恢复保护均由嵌入式约定工作台负责。

## 许可证

MIT License - R3E Network
