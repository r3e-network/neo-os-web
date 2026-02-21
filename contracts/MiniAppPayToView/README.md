# MiniAppPayToView

## Overview

MiniAppPayToView is a content monetization smart contract that enables creators to publish premium content and charge users for access. Users pay GAS to unlock content, with 90% going to creators and 10% as platform fee.

## 中文说明

付费查看 - 内容付费解锁系统

### 功能特点

- 创作者发布付费内容
- 用户支付 GAS 解锁访问权
- 创作者获得 90% 收益
- 平台收取 10% 手续费
- 最低定价：0.01 GAS

### 使用方法

1. 创作者发布内容并设置价格
2. 用户浏览内容列表
3. 支付 GAS 购买访问权
4. 永久解锁该内容
5. 创作者提取收益

### 收益分配

- **创作者**：90% 销售收入
- **平台**：10% 手续费
- **最低价格**：0.01 GAS
- **购买次数**：无限制

## English

### Features

- Creators publish premium content
- Users pay GAS to unlock access
- Creators receive 90% revenue
- Platform takes 10% fee
- Minimum price: 0.01 GAS

### Usage

1. Creator publishes content with price
2. Users browse content list
3. Pay GAS to purchase access
4. Permanently unlock content
5. Creator withdraws earnings

### Revenue Split

- **Creator**: 90% of sales
- **Platform**: 10% fee
- **Min Price**: 0.01 GAS
- **Purchase Limit**: Unlimited

## Technical Details

### Contract Information

- **Contract**: MiniAppPayToView
- **Category**: Content / Monetization
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Platform Fee**: 10%

### Key Methods

#### Creator Methods

**CreateContent(creator, price, contentHash)**

- Publishes new premium content
- Sets access price (min 0.01 GAS)
- Stores content hash for verification
- Creator gets automatic access
- Returns: Content ID

**WithdrawEarnings(creator)**

- Withdraws accumulated earnings
- Transfers balance to creator
- Resets balance to zero
- Emits: CreatorWithdrawn

#### User Methods

**PurchaseAccess(buyer, contentId, receiptId)**

- Purchases access to content
- Validates payment via receipt
- Grants permanent access
- Updates creator balance
- Emits: ContentPurchased

#### Query Methods

**GetContent(contentId)**

- Returns content metadata
- Includes creator, price, hash
- Shows purchase count

**HasAccess(user, contentId)**

- Checks if user has access
- Returns true/false

**GetCreatorBalance(creator)**

- Returns withdrawable balance

### Data Structure

```csharp
struct Content {
    UInt160 Creator;
    BigInteger Price;
    string ContentHash;
    BigInteger PurchaseCount;
    bool Active;
}
```

### Events

**ContentCreated(contentId, creator, price)**

- Emitted when content is published

**ContentPurchased(buyer, contentId, price)**

- Emitted when user purchases access

**CreatorWithdrawn(creator, amount)**

- Emitted when creator withdraws earnings

## Use Cases

### Digital Content

- Articles, tutorials, guides
- Research papers, reports
- Exclusive interviews
- Premium newsletters

### Media Files

- Photos, videos, audio
- Digital art, designs
- Music, podcasts
- Educational materials

### Data Access

- API access tokens
- Database queries
- Analytics reports
- Market research

## Integration

### Content Storage

Content hash stored on-chain:

- IPFS hash for decentralized storage
- SHA256 hash for verification
- Off-chain storage for actual content
- On-chain access control

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Access control enforcement
- Creator authentication
- Event monitoring

## Security Considerations

- Content hash prevents tampering
- One-time purchase per user
- Creator cannot change price after creation
- Admin can deactivate inappropriate content
- Earnings protected until withdrawal

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
