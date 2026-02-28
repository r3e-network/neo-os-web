# ExFiles

Anonymous ex-partner database with encrypted records and privacy-preserving queries.

## 中文说明

前任数据库 - 匿名前任伴侣数据库，加密记录和隐私保护查询

### 功能特点

- 匿名记录关系历史
- 数据哈希加密存储
- 1-5星评分系统
- 隐私保护的模式匹配查询

### 使用方法

1. 支付0.1 GAS创建匿名记录（数据哈希+评分）
2. 支付0.05 GAS通过哈希查询记录
3. 查看评分和查询次数统计
4. 记录创建者可删除自己的记录

### 技术细节

- **费用**: 创建0.1 GAS，查询0.05 GAS
- **存储**: 数据哈希、评分、查询计数、创建时间
- **隐私**: TEE确保隐私的同时支持模式匹配

### 合约方法

#### CreateRecord

```csharp
public static BigInteger CreateRecord(UInt160 creator, ByteString dataHash, BigInteger rating, BigInteger category, BigInteger receiptId)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `creator` | Hash160 | 创建者钱包地址 |
| `dataHash` | ByteString | 数据哈希 |
| `rating` | Integer | 评分 (1-5) |
| `category` | Integer | 类别 (0=默认) |
| `receiptId` | Integer | PaymentHub 支付收据 ID |

## English

### Features

- Anonymously record relationship history
- Encrypted data hash storage
- 1-5 star rating system
- Privacy-preserving pattern matching queries

### Usage

1. Pay 0.1 GAS to create anonymous record (data hash + rating)
2. Pay 0.05 GAS to query records by hash
3. View rating and query count statistics
4. Record creators can delete their own records

### Technical Details

- **Fees**: 0.1 GAS creation, 0.05 GAS query
- **Storage**: Data hash, rating, query count, creation time
- **Privacy**: TEE ensures privacy while enabling pattern matching

### Contract Methods

#### CreateRecord

```csharp
public static BigInteger CreateRecord(UInt160 creator, ByteString dataHash, BigInteger rating, BigInteger category, BigInteger receiptId)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `creator` | Hash160 | Creator wallet address |
| `dataHash` | ByteString | Data hash |
| `rating` | Integer | Rating (1-5) |
| `category` | Integer | Category (0=default) |
| `receiptId` | Integer | PaymentHub payment receipt ID |

## Technical

- **Contract**: MiniAppExFiles
- **Category**: Social/Privacy
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE for privacy-preserving queries
