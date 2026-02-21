# MiniAppNFTChimera

## Overview

MiniAppNFTChimera is an NFT fusion and breeding smart contract that enables users to combine two NFTs to create hybrid offspring with inherited traits. The contract uses VRF randomness to determine rarity and characteristics of the newly created chimera NFTs.

## 中文说明

NFT 融合进化论 - NFT 杂交育种系统

### 功能特点

- 铸造创世 NFT（Generation 0）
- 融合两个 NFT 创建混血后代
- VRF 随机决定稀有度（1-5 星）
- 追踪父代和世代信息
- 融合费用：0.5 GAS

### 使用方法

1. 用户铸造创世 NFT 作为起点
2. 选择两个自己拥有的 NFT 发起融合
3. 支付 0.5 GAS 融合费用
4. VRF 随机生成新 NFT 的稀有度
5. 新 NFT 世代 = max(父代世代) + 1

### 稀有度系统

- **1 星**：普通（基础属性）
- **2 星**：稀有（增强属性）
- **3 星**：史诗（强力属性）
- **4 星**：传说（顶级属性）
- **5 星**：神话（极致属性）

## English

### Features

- Mint genesis NFTs (Generation 0)
- Fuse two NFTs to create hybrid offspring
- VRF randomness determines rarity (1-5 stars)
- Track parent and generation information
- Fusion fee: 0.5 GAS

### Usage

1. User mints genesis NFT as starting point
2. Select two owned NFTs to initiate fusion
3. Pay 0.5 GAS fusion fee
4. VRF randomly generates new NFT rarity
5. New NFT generation = max(parent generation) + 1

### Rarity System

- **1 Star**: Common (basic attributes)
- **2 Star**: Rare (enhanced attributes)
- **3 Star**: Epic (powerful attributes)
- **4 Star**: Legendary (top-tier attributes)
- **5 Star**: Mythic (ultimate attributes)

## Technical Details

### Contract Information

- **Contract**: MiniAppNFTChimera
- **Category**: NFT / Breeding
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Fusion Fee**: 0.5 GAS

### Key Methods

#### User Methods

**MintGenesis(owner, receiptId)**

- Creates a Generation 0 NFT
- Cost: 0.5 GAS
- Returns: NFT ID
- Rarity: 1 (Common)

**RequestFusion(owner, nft1, nft2, receiptId)**

- Initiates fusion of two NFTs
- Validates ownership of both NFTs
- Cost: 0.5 GAS
- Returns: Fusion ID
- Triggers VRF request for rarity

**GetNFT(nftId)**

- Returns NFT data structure
- Includes owner, parents, rarity, generation

### Data Structures

```csharp
struct ChimeraNFT {
    UInt160 Owner;
    BigInteger Parent1;
    BigInteger Parent2;
    BigInteger Rarity;      // 1-5
    BigInteger Generation;
    BigInteger CreateTime;
}

struct FusionRequest {
    UInt160 Owner;
    BigInteger NFT1;
    BigInteger NFT2;
    bool Completed;
}
```

### Events

**ChimeraCreated(nftId, owner, traits)**

- Emitted when genesis NFT is minted

**FusionRequested(fusionId, owner, nft1, nft2)**

- Emitted when fusion is initiated

**FusionCompleted(fusionId, newNftId, rarity)**

- Emitted when fusion completes with VRF result

## Game Mechanics

### Breeding Strategy

**Generation Progression**

- Gen 0: Genesis NFTs (manually minted)
- Gen 1: Fusion of two Gen 0 NFTs
- Gen N: Fusion of any two NFTs (max parent gen + 1)

**Rarity Inheritance**

- Parent rarity does NOT guarantee offspring rarity
- Each fusion has independent random roll
- Distribution: 40% common, 30% rare, 20% epic, 10% legendary/mythic

### Economic Model

- **Genesis Cost**: 0.5 GAS per NFT
- **Fusion Cost**: 0.5 GAS per attempt
- **No Burning**: Parent NFTs remain after fusion
- **Unlimited Breeding**: Same NFT can be used multiple times

## Use Cases

### Collectible Breeding

- Build rare NFT collections through strategic breeding
- Hunt for high-rarity offspring
- Create family trees of NFTs

### Gaming Integration

- NFT stats based on rarity and generation
- Battle system using chimera attributes
- Evolution mechanics for character progression

### Art Projects

- Generative art based on parent traits
- Visual representation of genetic mixing
- Community-driven breeding experiments

## Integration

### VRF Service

Fusion uses VRF for provably fair randomness:

- Request sent to ServiceLayerGateway
- VRF service generates random bytes
- Callback processes result and creates NFT
- Rarity calculated from random seed

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Ownership verification
- VRF request routing
- Event monitoring

## Security Considerations

- Ownership validated before fusion
- VRF ensures unpredictable rarity
- Parent NFTs cannot be used in pending fusions
- Request-to-fusion mapping prevents replay attacks

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
