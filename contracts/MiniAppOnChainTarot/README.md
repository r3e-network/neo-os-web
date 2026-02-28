# On-Chain Tarot

Blockchain fortune telling with verifiable randomness and transparent interpretations.

## 中文说明

链上塔罗牌 - 区块链占卜，具有可验证的随机性和透明的解读

### 功能特点

- 基于区块链的塔罗牌占卜
- TEE生成可验证的随机抽牌
- 3张牌的标准塔罗牌阵
- 解读结果链上存储，完全透明

### 使用方法

1. 支付0.05 GAS请求塔罗牌占卜（提交问题）
2. TEE生成随机数抽取3张牌
3. 查看抽到的牌和解读结果
4. 所有占卜记录永久保存在链上

### 技术细节

- **费用**: 每次占卜0.05 GAS
- **牌组**: 78张塔罗牌
- **牌阵**: 每次抽3张牌
- **存储**: 问题、抽到的牌、时间戳
- **RNG服务**: TEE提供可验证的随机数

### 合约方法

#### RequestReading

```csharp
public static BigInteger RequestReading(UInt160 user, string question, BigInteger spreadType, BigInteger category, BigInteger receiptId)
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `user` | Hash160 | 用户钱包地址 |
| `question` | String | 占卜问题 (最多200字符) |
| `spreadType` | Integer | 牌阵类型 (0=单牌) |
| `category` | Integer | 问题类别 (0=通用) |
| `receiptId` | Integer | PaymentHub 支付收据 ID |

## English

### Features

- Blockchain-based tarot card readings
- TEE-generated verifiable random card draws
- Standard 3-card tarot spread
- Interpretations stored on-chain for transparency

### Usage

1. Pay 0.05 GAS to request tarot reading (submit question)
2. TEE generates random numbers to draw 3 cards
3. View drawn cards and interpretation results
4. All readings permanently recorded on-chain

### Technical Details

- **Fee**: 0.05 GAS per reading
- **Deck**: 78 tarot cards
- **Spread**: 3 cards per reading
- **Storage**: Question, drawn cards, timestamp
- **RNG Service**: TEE provides verifiable randomness

### Contract Methods

#### RequestReading

```csharp
public static BigInteger RequestReading(UInt160 user, string question, BigInteger spreadType, BigInteger category, BigInteger receiptId)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `user` | Hash160 | User wallet address |
| `question` | String | Reading question (max 200 chars) |
| `spreadType` | Integer | Spread type (0=single card) |
| `category` | Integer | Question category (0=general) |
| `receiptId` | Integer | PaymentHub payment receipt ID |

## Technical

- **Contract**: MiniAppOnChainTarot
- **Category**: Entertainment/Mystical
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE RNG for card selection
