# 永久相册

按钱包地址将照片存储在 Neo 上，支持可选 AES-GCM 加密。

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-forever-album` |
| **分类** | social |
| **版本** | 1.1.0 |
| **框架** | Vue 3 (uni-app) |

## 功能特性

- 按钱包地址索引相册（每个地址独立相册）
- 每笔交易最多上传 5 张照片（总大小 < 60KB）
- 可选 AES-GCM 客户端加密
- 钱包签名上传，链上记录时间戳

## 权限要求

| 权限 | 是否需要 |
|------|----------|
| 钱包 | ✅ 是 |
| 支付 | ❌ 否 |
| 自动化 | ❌ 否 |

## 网络配置

### 测试网 (Testnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x74dc4a954e6bccfd66500b8124e4c404154b9fb9` |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://testnet.neotube.io/contract/0x74dc4a954e6bccfd66500b8124e4c404154b9fb9) |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | `0x254421a4aeb4e731f89182776b7bc6042c40c797` |
| **RPC 节点** | `https://mainnet1.neo.coz.io:443` |
| **区块浏览器** | [在 NeoTube 查看](https://neotube.io/contract/0x254421a4aeb4e731f89182776b7bc6042c40c797) |
| **网络魔数** | `860833102` |

## 使用流程

1. 选择最多五张照片，确保总大小低于 60KB。
2. 可选开启 AES-GCM 加密并设置密码。
3. 使用钱包签名上传交易。
4. 查看时在本地解密加密照片。

## 存储说明

- 照片以 base64 data URL 形式按钱包地址存储。
- 加密照片仅存储密文，密码仅保存在本地。
- 每条记录包含所有者、加密标记与时间戳。
- 限制：每次最多 5 张，单张 45KB，总计 60KB。

## 合约接口（测试网）

- `uploadPhotos(string[] photoData, bool[] encryptedFlags)` — 每次最多上传 5 张
- `getUserPhotoCount(UInt160 user)` — 获取钱包照片总数
- `getUserPhotoIds(UInt160 user, int start, int limit)` — 分页获取照片 ID
- `getPhoto(ByteString photoId)` — 返回 `PhotoId, Owner, Encrypted, Data, CreatedAt`

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

- **允许的资产**: 无（照片以数据方式存储）

## 许可证

MIT License - R3E Network
