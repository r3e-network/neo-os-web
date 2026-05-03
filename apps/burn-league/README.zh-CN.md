# GAS 燃烧排位赛

通缩挖矿，烧掉 GAS 换取更值钱的平台权益

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-burn-league` |
| **分类** | 去中心化金融 |
| **版本** | 1.0.0 |
| **框架** | Host-native React playarea |

## 功能特性

- Burn
- Deflationary
- Rewards

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 支付 | ✅ 是 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x0946e3c3db8abdd2fa14bbae4978992015473c09` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x0946e3c3db8abdd2fa14bbae4978992015473c09) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0xd829b7a8c0d9fa3c67a29c703a277de3f922f173` |
| **RPC 节点** | `https://mainnet2.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xd829b7a8c0d9fa3c67a29c703a277de3f922f173) |
| **网络魔数** | `860833102` |

## 平台合约

### 测试网 (Testnet)

| 合约 | 地址 |
| --- | --- |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| Morpheus Oracle | `0x4b882e94ed766807c4fd728768f972e13008ad52` |

### 主网 (Mainnet)

| 合约 | 地址 |
| --- | --- |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| Morpheus Oracle | `0x017520f068fd602082fe5572596185e62a4ad991` |

## 开发指南

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 构建 H5 版本
npm run build
```

## 资产配置

- **允许的资产**: GAS

## 资金路径

- 直接预付 GAS 到 MiniApp 合约
- 不再依赖旧版平台收据流程
- 钱包先签转账，再签 `burnGas`


## 许可证

MIT License - R3E Network
