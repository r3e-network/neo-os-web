# 二次方资助小程序

二次方资助支持社区发起公共资助轮次。捐助者在轮次期间向项目捐助，匹配资金通过链下计算后上链确认，
项目方即可领取捐助与匹配资金。

## 功能
- 创建 GAS 匹配资金轮次
- 注册轮次项目
- 记录捐助与唯一捐助者数
- 结算匹配分配并领取资金
- 内置完整文档说明

## 使用流程
1. 创建轮次，设置匹配池、开始/结束时间、说明。
2. 项目方在轮次期间注册项目。
3. 捐助者为项目捐助。
4. 链下计算匹配金额（可用 `node scripts/quadratic-funding-matching.js --input data.json --decimals 8`）。
5. 项目方领取捐助与匹配资金。

## 开发说明
- 入口：`src/pages/index/index.vue`
- 文档：`src/pages/docs/index.vue`
- i18n：`src/locale/messages.ts`
- 资源：`src/static/logo.jpg`、`src/static/banner.jpg`

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
