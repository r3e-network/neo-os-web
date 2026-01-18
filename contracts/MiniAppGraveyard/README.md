# MiniAppGraveyard

## 中文说明

### 概述

数字遗忘墓地是一个付费数据删除服务，用户支付 GAS 永久删除加密数据，实现真正的"被遗忘权"。

### 核心机制

- **付费埋葬**：支付 0.1 GAS 存储加密数据哈希
- **付费遗忘**：支付 1 GAS 永久删除数据
- **TEE 销毁**：删除时 TEE 同步销毁加密密钥
- **不可恢复**：删除后数据无法恢复

### 主要功能

#### 1. 埋葬记忆 (BuryMemory)

```csharp
public static BigInteger BuryMemory(UInt160 owner, string contentHash, BigInteger memoryType, BigInteger receiptId)
```

- 支付 0.1 GAS 存储数据哈希
- `memoryType`: 记忆类型 (0=默认)
- 创建唯一记忆 ID
- 触发 `MemoryBuried` 事件

#### 2. 遗忘记忆 (ForgetMemory)

```csharp
public static void ForgetMemory(UInt160 owner, BigInteger memoryId, BigInteger receiptId)
```

- 支付 1 GAS 永久删除
- TEE 销毁加密密钥
- 触发 `MemoryForgotten` 事件

#### 3. 查询信息

```csharp
public static BigInteger TotalMemories()
public static bool IsForgotten(BigInteger memoryId)
```

- 查询总记忆数量
- 检查是否已被遗忘

### 使用场景

1. **隐私保护**：永久删除敏感数据
2. **被遗忘权**：行使数据删除权利
3. **数据清理**：清除历史记录
4. **合规要求**：满足 GDPR 等法规

### 技术特性

- **埋葬费用**：0.1 GAS
- **遗忘费用**：1 GAS
- **TEE 保障**：密钥同步销毁
- **不可逆转**：删除后无法恢复

### 参数说明

- **BURY_FEE**: 10000000 (0.1 GAS)
- **FORGET_FEE**: 100000000 (1 GAS)

---

## English Description

### Overview

Digital Graveyard is a paid data deletion service where users pay GAS to permanently delete encrypted data, achieving true "right to be forgotten".

### Core Mechanics

- **Paid Burial**: Pay 0.1 GAS to store encrypted data hash
- **Paid Forgetting**: Pay 1 GAS to permanently delete data
- **TEE Destruction**: TEE synchronously destroys encryption keys upon deletion
- **Irrecoverable**: Data cannot be recovered after deletion

### Main Functions

#### 1. Bury Memory

```csharp
public static BigInteger BuryMemory(UInt160 owner, string contentHash, BigInteger memoryType, BigInteger receiptId)
```

- Pay 0.1 GAS to store data hash
- `memoryType`: Memory type (0=default)
- Create unique memory ID
- Triggers `MemoryBuried` event

#### 2. Forget Memory

```csharp
public static void ForgetMemory(UInt160 owner, BigInteger memoryId, BigInteger receiptId)
```

- Pay 1 GAS to permanently delete
- TEE destroys encryption key
- Triggers `MemoryForgotten` event

#### 3. Query Information

```csharp
public static BigInteger TotalMemories()
public static bool IsForgotten(BigInteger memoryId)
```

- Query total memory count
- Check if already forgotten

### Use Cases

1. **Privacy Protection**: Permanently delete sensitive data
2. **Right to be Forgotten**: Exercise data deletion rights
3. **Data Cleanup**: Clear historical records
4. **Compliance**: Meet GDPR and other regulations

### Technical Features

- **Burial Fee**: 0.1 GAS
- **Forgetting Fee**: 1 GAS
- **TEE Guarantee**: Key synchronously destroyed
- **Irreversible**: Cannot recover after deletion

### Parameters

- **BURY_FEE**: 10000000 (0.1 GAS)
- **FORGET_FEE**: 100000000 (1 GAS)

### Contract Information

- **App ID**: `miniapp-graveyard`
- **Version**: 1.0.0
- **Author**: R3E Network
