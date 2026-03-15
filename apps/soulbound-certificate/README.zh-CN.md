# 灵魂绑定证书

用于课程、活动与成就的 NEP-11 灵魂绑定证书。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-soulbound-certificate` |
| **分类** | utility |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 特性

- 创建证书模板并设置发放上限
- 向受益人签发灵魂绑定证书
- 证书带二维码用于核验
- 发行方可撤销证书

## 用户流程

1. **创建模板**：设置证书名称、发行方、分类与数量。
2. **签发证书**：向受益人地址发送证书。
3. **查看证书**：受益人在“我的证书”展示二维码。
4. **核验/撤销**：发行方通过 Token ID 核验或撤销。

## 合约方法

- `CreateTemplate(issuer, name, issuerName, category, maxSupply, description)`
- `UpdateTemplate(issuer, templateId, name, issuerName, category, maxSupply, description)`
- `IssueCertificate(issuer, recipient, templateId, recipientName, achievement, memo)`
- `RevokeCertificate(issuer, tokenId)`
- `Transfer(from, to, tokenId, data)`
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
