# 里程碑托管

一个面向 Neo N3 项目付款的真实托管工作台：一次锁定 NEO 或 GAS，按里程碑逐笔验收和释放。

## 生产流程

1. 创建者选择 NEO 或 GAS，填写通过校验和验证的受益人地址，并配置 1–12 个正数批次。
2. 创建需要两次钱包签名：先存入代币，待存入确认后再调用 `createEscrow`。
3. 创建者通过 `approveMilestone` 在链上验收某一个明确的里程碑。
4. 受益人通过 `claimMilestone` 领取该笔已批准资金。
5. 只有不存在“已批准但未领取”的里程碑时，创建者才能取消；退款仅包含当前剩余余额。
6. 每次写操作前，前端都会核验准确合约地址、业务限制与暂停状态；新的存入还必须通过“预付额度可取回”能力检查。

每次写操作仅在核验到匹配的合约事件、托管编号和里程碑编号后才标记成功。只有交易哈希但没有精确事件时，界面保持待确认且不会伪造成功状态。

## 重要产品边界

- 已部署合约记录批次金额、批准、领取、双方地址、标题和备注。
- 合约**不存储交付文件或证明，也不提供争议仲裁**。双方必须在线下交换证据，并在批准前解决争议。
- 托管创建后不能修改里程碑。
- NEO 不可分割；GAS 使用 8 位小数。最低总额为 1 NEO 或 0.1 GAS。
- 平台不收取费用，但链上网络费仍然存在。
- 当前主网/测试网的 28 方法部署没有提供预付额度取回接口，因此前端会拒绝新建托管；核心能力核验通过后，现有托管的批准、领取和取消仍可使用。
- 本地恢复版合约构建已增加 `directAssetCreditOf`、`reclaimDirectAssetCredit` 和 30 天后的 `reclaimApprovedMilestone`，但在完成部署更新与实时验证前，界面不得把这些路径宣传为已上线。
- 已广播写操作会保存在本地，并持续显示为待确认，直到精确事件或合约状态回读证明结果。

## 前端使用的合约接口

- `createEscrow(creator, beneficiary, asset, totalAmount, milestoneAmounts, title, notes)`
- `approveMilestone(creator, escrowId, milestoneIndex)`
- `claimMilestone(beneficiary, escrowId, milestoneIndex)`
- `cancelEscrow(creator, escrowId)`
- `getEscrowDetails(escrowId)`
- `getCreatorEscrows(creator, offset, limit)`
- `getBeneficiaryEscrows(beneficiary, offset, limit)`

界面使用从 0 开始的里程碑序号，并在调用合约前转换为合约要求的从 1 开始的序号。

## 网络状态

| 网络 | 合约 | 状态 |
|---|---|---|
| Neo N3 主网 | `0x442162de25008ac78d4cce62ed8d8a64401b7ece` | 已部署 |
| Neo N3 测试网 | `0x442162de25008ac78d4cce62ed8d8a64401b7ece` | 已部署 |

2026-07-11 的只读 RPC 验证确认：两个网络的 `getPlatformStats` 都返回 `HALT`，并返回预期限制（`1 NEO`、`0.1 GAS`、`1–12` 个里程碑）；实时部署公开 28 方法的创建、批准、领取和取消 ABI。通过 `testnet1`、`testnet2`、`mainnet1`、`mainnet2` 的多次复核均未发现 `directAssetCreditOf`、`reclaimDirectAssetCredit` 或 `reclaimApprovedMilestone`，直接恢复探针返回 `FAULT`。两个部署的 NEF checksum 都是 `447355561`。

由于实时版本无法取回两步存入中未消费的额度，前端把它视为 legacy 部署：现有托管的批准、领取和取消继续开放，但不会请求新的存入签名。必须先更新到恢复版合约并完成新的实时全流程测试，才能重新开放创建。

本地恢复版构建 checksum 当前为 `1925478399`，与两个实时合约都不相同。本次前端生产化收口未部署或更新任何合约。

## 权限

- `invoke:primary`：合约写操作
- `read:blockchain`：读取托管账本
- NEP-17 支付：首次存入 NEO 或 GAS

## 验证命令

```bash
npx tsc -p apps/milestone-escrow/tsconfig.json --noEmit
cd apps/shared && npx vitest run test/milestone-escrow.logic.test.ts test/milestone-escrow.playarea.test.tsx test/milestone-escrow.setup.test.ts
npm --prefix apps/milestone-escrow run build
```
