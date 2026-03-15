# Neo 转换工具

转换 Neo 地址、私钥和脚本哈希

## 概览

| 属性 | 值 |
|------|-----|
| **App ID** | `miniapp-neo-convert` |
| **分类** | utilities |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 摘要

Neo N3 离线密钥工具

在本地生成 Neo N3 账户，支持 WIF/私钥/公钥互转、地址派生与脚本反汇编。所有操作在设备本地完成，无需服务器请求，适用于冷存储准备与格式校验。

## 功能亮点

- **本地密钥生成**：密钥在设备本地生成，不经网络传输。
- **格式自动识别**：自动识别 WIF/私钥/公钥/脚本并完成转换。
- **脚本反汇编**：将 NeoVM 脚本 Hex 转为可读指令列表，便于调试。
- **纸钱包导出**：生成带二维码的 PDF 便于安全离线保存。

## 使用步骤

1. 打开生成页创建新账户，并将私钥/WIF 离线保存。
2. 导出纸钱包 PDF 作为离线备份，必要时可打印保存。
3. 切换到转换页，粘贴 WIF、私钥、公钥或脚本 Hex。
4. 核对派生结果（地址、公钥、WIF），复制确认后的格式。

## 权限

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ❌ 否 |
| 支付 | ❌ 否 |
| 随机数 | ❌ 否 |
| 数据源 | ❌ 否 |
| 治理 | ❌ 否 |
| 自动化 | ❌ 否 |

## 链上行为

- 无链上合约部署，主要使用链下 API 或钱包签名流程。

## 网络配置

无链上合约部署。

## 平台合约

### 测试网 (Testnet)

| 合约 | 地址 |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### 主网 (Mainnet)

| 合约 | 地址 |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

## 资产

- **允许资产**：无

## 开发

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```
