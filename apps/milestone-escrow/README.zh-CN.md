# 里程碑托管

支持里程碑审核与分期释放的托管方案。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-milestone-escrow` |
| **分类** | 金融 |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能

- 锁定 NEO 或 GAS
- 创建者逐项批准里程碑
- 受益人按批准领取
- 创建者可取消并取回剩余资金

## 使用流程

1. **创建托管**：选择 NEO 或 GAS，设定里程碑并锁定资金。
2. **批准里程碑**：创建者确认交付后批准。
3. **领取**：受益人领取已批准金额。
4. **取消（可选）**：创建者取消并取回剩余资金。

## 合约方法

- `CreateEscrow(creator, beneficiary, asset, totalAmount, milestoneAmounts, title, notes)`
- `ApproveMilestone(creator, escrowId, milestoneIndex)`
- `ClaimMilestone(beneficiary, escrowId, milestoneIndex)`
- `CancelEscrow(creator, escrowId)`
- `GetEscrowDetails(escrowId)`

## 权限

| 权限 | 是否需要 |
|------|----------|
| Payments | ❌ 否 |
| Automation | ❌ 否 |
| RNG | ❌ 否 |
| Data Feed | ❌ 否 |

## 网络配置

### Testnet

| 属性 | 值 |
|------|----|
| **合约** | `待部署` |
| **RPC** | `https://n3seed1.ngd.network:20332` |
| **浏览器** | `https://testnet.neotube.io` |

### Mainnet

| 属性 | 值 |
|------|----|
| **合约** | `待部署` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **浏览器** | `https://neotube.io` |

> `neo-manifest.json` 会继续保持空合约地址，直到正式部署完成。前端现在会明确展示“待部署”状态，而不是继续发起无效链上请求。
