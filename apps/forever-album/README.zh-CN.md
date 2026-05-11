# 永久相册

通过平台存储与 NFT 服务代理创建钱包级照片保险箱，支持可选 AES-GCM 加密。

## 概述

| 属性 | 值 |
|------|-----|
| **应用 ID** | `miniapp-forever-album` |
| **分类** | social |
| **版本** | 1.1.0 |
| **框架** | Host-native React playarea |

## 功能特性

- 按钱包地址索引相册（每个地址独立相册）
- 每笔交易最多上传 5 张照片（总大小 < 60KB）
- 可选 AES-GCM 客户端加密
- 通过平台存储服务生成 Neo 合约调用 intent，再由钱包签名提交，保留钱包级时间戳

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
| **合约地址** | 无独立合约；存储通过平台服务代理路由 |
| **RPC 节点** | `https://testnet1.neo.coz.io:443` |
| **区块浏览器** | N/A |
| **网络魔数** | `894710606` |

### 主网 (Mainnet)

| 属性 | 值 |
|------|-----|
| **合约地址** | 无独立合约；存储通过平台服务代理路由 |
| **RPC 节点** | `https://mainnet2.neo.coz.io:443` |
| **区块浏览器** | N/A |
| **网络魔数** | `860833102` |

## 使用流程

1. 选择最多五张照片，确保总大小低于 60KB。
2. 可选开启 AES-GCM 加密并设置密码。
3. 通过平台存储服务代理生成合约 intent，并用连接的钱包签名提交。
4. 重新打开应用即可查看已保存相册；加密照片查看时在本地解密。

## 存储说明

- 照片通过共享存储代理以 base64 data URL 形式存储在 `photos:<wallet>:<photoId>` 前缀下。
- 加密照片仅存储密文，密码仅保存在本地。
- 每条记录包含所有者、加密标记与时间戳。
- 限制：每次最多 5 张，单张 45KB，总计 60KB。

## 服务接口

- `storage.list("photos:<wallet>:", 50)` — 构建/读取钱包级相册查询
- `storage.set("photos:<wallet>:<photoId>", photo)` — 构建持久化照片写入 intent
- `chain.invoke(intent.operation, intent.args, { scriptHash: intent.contract })` — 通过钱包提交 OS storage 写入
- `nft.mint({ type: "album-upload", photoIds, count, encrypted })` — 写入成功后的可选轻量标记
- `badge.award("album-creator")` — 上传成功后授予创作者徽章

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
