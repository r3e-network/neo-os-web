# 流式金库

用于工资、订阅和定期支付的按时释放金库。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-stream-vault` |
| **分类** | defi |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 功能

- 锁定 GAS
- 按固定周期向受益人释放
- 受益人按期领取
- 创建者可取消并取回剩余资产

## 使用流程

1. **创建流**：选择资产、总金额、每期释放金额与周期。
2. **金库生效**：资金锁定，按周期解锁释放。
3. **领取**：受益人按期领取释放的资产。
4. **取消（可选）**：创建者取消并取回剩余资金。

## 合约方法

- `CreateStream(creator, beneficiary, asset, totalAmount, rateAmount, intervalSeconds, title, notes)`
- `ClaimStream(beneficiary, streamId)`
- `CancelStream(creator, streamId)`
- `GetStreamDetails(streamId)`
- `GetUserStreams(user, offset, limit)`
- `GetBeneficiaryStreams(beneficiary, offset, limit)`

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
| **合约** | `未部署` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **浏览器** | `https://testnet.neotube.io` |

### Mainnet

| 属性 | 值 |
|------|----|
| **合约** | `未部署` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **浏览器** | `https://neotube.io` |

> 合约部署尚未完成，`neo-manifest.json` 将保持空地址直到部署完成。
