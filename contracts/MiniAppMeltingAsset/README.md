# MiniAppMeltingAsset

## Overview

MiniAppMeltingAsset is a time-decaying NFT smart contract that creates digital assets which lose value over time unless actively maintained. This contract implements a unique "melting" mechanism where NFT value decreases at a constant rate, requiring owners to add value to preserve their assets.

## 中文说明

正在融化的 NFT - 时间衰减资产系统

### 功能特点

- 创建会随时间贬值的 NFT 资产
- 融化速率：每小时损失 0.01 GAS
- 支付 GAS 延缓融化进程
- 实时计算当前资产价值
- 创建费用：1 GAS

### 使用方法

1. 用户支付 1 GAS 创建融化资产
2. 资产价值以每小时 0.01 GAS 的速率递减
3. 所有者可随时添加 GAS 增加资产价值
4. 查询接口实时显示剩余价值
5. 价值归零后资产失效

### 游戏机制

- **初始价值**：创建时投入的 1 GAS
- **融化速率**：0.01 GAS/小时（固定）
- **维护成本**：任意金额 GAS 可延长寿命
- **生命周期**：初始可存活约 100 小时
- **策略选择**：持续维护 vs 让其自然消亡

## English

### Features

- Create NFTs that lose value over time
- Melt rate: 0.01 GAS per hour
- Pay GAS to slow down melting
- Real-time value calculation
- Creation fee: 1 GAS

### Usage

1. User pays 1 GAS to create melting asset
2. Asset value decreases at 0.01 GAS/hour
3. Owner can add GAS anytime to increase value
4. Query interface shows real-time remaining value
5. Asset becomes inactive when value reaches zero

### Game Mechanics

- **Initial Value**: 1 GAS at creation
- **Melt Rate**: 0.01 GAS/hour (constant)
- **Maintenance**: Any amount of GAS extends lifespan
- **Lifecycle**: Initially survives ~100 hours
- **Strategy**: Continuous maintenance vs natural decay

## Technical Details

### Contract Information

- **Contract**: MiniAppMeltingAsset
- **Category**: NFT / Time-based
- **Permissions**: Gateway integration
- **Assets**: GAS

### Key Methods

#### User Methods

**CreateAsset(owner, receiptId)**

- Creates a new melting NFT
- Cost: 1 GAS
- Returns: Asset ID
- Initial value equals creation fee

**AddValue(assetId, saver, amount, receiptId)**

- Adds value to existing asset
- Applies accumulated melting before adding
- Updates last update timestamp
- Any user can save any asset

**GetCurrentValue(assetId)**

- Calculates real-time asset value
- Accounts for time elapsed since last update
- Returns 0 if fully melted

### Data Structure

```csharp
struct MeltingNFT {
    UInt160 Owner;
    BigInteger Value;
    BigInteger LastUpdate;
    bool Active;
}
```

### Events

**AssetCreated(assetId, owner, initialValue)**

- Emitted when new asset is created

**AssetMelted(assetId, remainingValue)**

- Emitted when asset value decreases

**AssetSaved(assetId, saver, addedValue)**

- Emitted when value is added to asset

### Constants

- **CREATE_FEE**: 1 GAS (100000000)
- **MELT_RATE**: 0.01 GAS per hour (1000000)
- **Time Unit**: Milliseconds (3600000 = 1 hour)

## Use Cases

### Art Installation

- Digital art that requires community support
- Collective effort to preserve cultural artifacts
- Social experiment on value and maintenance

### Gaming Mechanics

- Time-pressure resource management
- Strategic decision making
- Community coordination challenges

### Economic Experiments

- Study of depreciation models
- Value preservation behaviors
- Tragedy of the commons scenarios

## Integration

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Access control enforcement
- Event monitoring for off-chain services

### Automation Support

The contract supports automated melting checks:

- Periodic value updates
- Notification triggers when value is low
- Automatic deactivation when fully melted

## Security Considerations

- Value calculation is deterministic and verifiable
- Anyone can add value to any asset (by design)
- Owner cannot prevent melting without adding value
- No withdrawal mechanism (value is consumed)

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
