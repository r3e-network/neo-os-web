# 灵魂绑定证书

用于课程、活动与成就的 NEP-11 灵魂绑定证书。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-soulbound-certificate` |
| **分类** | nft |
| **版本** | 1.2.0 |
| **框架** | Host-native React playarea |

## 特性

- 创建证书模板并设置发放上限
- 更新既有凭证设计，同时保留模板 ID 与已签发记录
- 向受益人签发灵魂绑定证书
- 证书带可跨设备打开的核验链接二维码
- 发行方可撤销证书；撤销只更新链上状态，不销毁 Token

## 用户流程

1. **创建模板**：设置证书名称、发行方、分类与数量。
2. **管理模板**：在次级模板抽屉中编辑元数据、发放上限或启用状态。
3. **签发证书**：向受益人地址发送证书。
4. **查看证书**：受益人在“我的证书”展示二维码。
5. **核验/撤销**：任何访客都可以先通过 Token ID 核验，无需连接钱包；发行方可撤销。

编辑中的证书始终明确标记为**预览 / 草稿**。只有在规范网络与规范合约上，
请求 Token、NEP-11 持有人和关联模板全部读回一致后，界面才会显示绿色“有效”。
广播后的写操作会保持待确认，直到对应事件与链上状态完全一致。
模板创建、更新与证书签发都只有在完整字段读回一致后才会成功，且发放上限不能低于已签发数量。请求钱包签名前，应用还会验证恢复凭据能够跨刷新保存；若恢复存储不可用，链上写入会保持停用。

## 合约方法

- `CreateTemplate(issuer, name, issuerName, category, maxSupply, description)`
- `UpdateTemplate(issuer, templateId, name, issuerName, category, maxSupply, description)`
- `IssueCertificate(issuer, recipient, templateId, recipientName, achievement, memo)`
- `RevokeCertificate(issuer, tokenId)`
- `Transfer(to, tokenId, data)`（灵魂绑定证书始终拒绝转让）
- `GetTemplateDetails(templateId)`
- `GetCertificateDetails(tokenId)`

## 权限

| 权限 | 是否需要 |
|------|---------|
| 支付 | ❌ 否 |
| 自动化 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |

## 网络配置

### Testnet

| 属性 | 值 |
|------|----|
| **合约** | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` |
| **RPC** | `https://api.n3index.dev/testnet` |
| **浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b) |

### Mainnet

| 属性 | 值 |
|------|----|
| **合约** | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` |
| **RPC** | `https://api.n3index.dev/mainnet` |
| **浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b) |

> 已于 2026-07-12 重新确认主网与测试网合约存在且生产流程 ABI 可读；本地构建新增的基础额度恢复方法不被当前界面调用或依赖。本轮前端收口未发起新的写交易。
> 可信边界与仍需执行的资金化端到端验证见 [TESTNET_STATUS.md](./TESTNET_STATUS.md)。

生产交付资料：

- [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md)
- [NETWORK_STATUS.md](./NETWORK_STATUS.md)
- [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)
