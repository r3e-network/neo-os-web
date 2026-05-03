# 数字遗忘墓地

加密记忆埋葬与付费遗忘

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-graveyard` |
| **分类** | 工具 |
| **版本** | 1.0.0 |
| **框架** | Host-native React playarea |

## 功能特性

- 加密哈希上链
- 付费遗忘
- TEE 密钥销毁

## 使用流程

1. 输入加密内容哈希并选择记忆类型。
2. 先向 MiniApp 合约直接预付埋葬费用，再将哈希写入链上。
3. 可选：先向 MiniApp 合约直接预付遗忘费用，再清除哈希并触发 TEE 销毁密钥。

## 费用

- 埋葬费用：0.1 GAS
- 遗忘费用：1 GAS

## 记忆类型

- 秘密、遗憾、愿望、告白、其他

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
| **合约地址** | `0xb55aa635b10a5abb5cbac169db26a38df739778e` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0xb55aa635b10a5abb5cbac169db26a38df739778e) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x0195e668f7a2a41ef4a0200c5b9c2cc1c02e24d1` |
| **RPC 节点** | `https://mainnet2.neo.coz.io:443` |
| **区块浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x0195e668f7a2a41ef4a0200c5b9c2cc1c02e24d1) |
| **网络魔数** | `860833102` |

## 平台合约

### 当前集成边界

- 直接预付 GAS 到 MiniApp 合约
- 不再依赖旧版平台收据流程
- 如需预言机 / AA 能力，仍通过外部系统接入

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
- 钱包先签转账，再签业务调用


## 许可证

MIT License - R3E Network
