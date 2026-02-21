# MiniAppSchrodingerNFT

## Overview

MiniAppSchrodingerNFT is a quantum-inspired NFT smart contract where pets exist in an unknown state until observed. Users adopt mystery boxes containing pets with hidden states, and observing them costs GAS and causes state collapse. Pets can be traded blindly before observation.

## 中文说明

薛定谔的 NFT - 量子态宠物盒

### 功能特点

- 领养未知状态的量子宠物盒
- 观察宠物导致状态坍缩
- 四种可能状态：存活/生病/变异/升天
- 盲盒交易：未观察前可交易
- 领养费用：0.5 GAS
- 观察费用：0.05 GAS

### 使用方法

1. 支付 0.5 GAS 领养量子宠物盒
2. 宠物状态未知（薛定谔状态）
3. 支付 0.05 GAS 观察宠物
4. VRF 决定状态坍缩结果
5. 可在观察前盲盒交易

### 状态分布

- **存活**：40% 概率（普通宠物）
- **生病**：30% 概率（需要照顾）
- **变异**：20% 概率（稀有形态）
- **升天**：10% 概率（传说形态）

## English

### Features

- Adopt quantum pet boxes with unknown state
- Observing pets causes state collapse
- Four possible states: Alive/Sick/Mutated/Ascended
- Blind trading: trade before observation
- Adoption fee: 0.5 GAS
- Observation fee: 0.05 GAS

### Usage

1. Pay 0.5 GAS to adopt quantum pet box
2. Pet state is unknown (Schrödinger state)
3. Pay 0.05 GAS to observe pet
4. VRF determines collapsed state
5. Can trade blindly before observation

### State Distribution

- **Alive**: 40% probability (normal pet)
- **Sick**: 30% probability (needs care)
- **Mutated**: 20% probability (rare form)
- **Ascended**: 10% probability (legendary form)

## Technical Details

### Contract Information

- **Contract**: MiniAppSchrodingerNFT
- **Category**: NFT / Gaming
- **Permissions**: Gateway integration
- **Assets**: GAS
- **Adoption Fee**: 0.5 GAS
- **Observation Fee**: 0.05 GAS

### Key Methods

#### User Methods

**Adopt(owner, receiptId)**

- Adopts new quantum pet box
- Cost: 0.5 GAS
- Initial state: UNKNOWN
- Returns: Pet ID via event

**Observe(owner, petId, receiptId)**

- Observes pet to collapse state
- Cost: 0.05 GAS
- Triggers VRF for state determination
- Marks pet as observed

**ListForSale(owner, petId, price)**

- Lists pet for blind trade
- Min price: 0.1 GAS
- Can sell before observation

**Buy(buyer, petId, receiptId)**

- Purchases listed pet
- Transfers ownership
- State remains unchanged

### Pet States

```
STATE_UNKNOWN = 0    // Before observation
STATE_ALIVE = 1      // 40% - Normal pet
STATE_SICK = 2       // 30% - Needs care
STATE_MUTATED = 3    // 20% - Rare form
STATE_ASCENDED = 4   // 10% - Legendary
```

### Events

**PetAdopted(owner, petId, timestamp)**

- Emitted when pet is adopted

**PetObserved(owner, petId, state, timestamp)**

- Emitted when state collapses

**PetTraded(seller, buyer, petId, price)**

- Emitted when pet is traded

## Game Mechanics

### Quantum Mechanics

**Before Observation**

- State is truly unknown (not predetermined)
- VRF generates randomness only when observed
- Can be traded as mystery box

**After Observation**

- State permanently fixed
- Cannot re-observe
- Value determined by revealed state

### Trading Strategy

**Sell Before Observation**

- Avoid bad outcomes
- Transfer risk to buyer
- Price reflects uncertainty

**Observe Then Sell**

- Prove high-value state
- Command premium price
- Risk revealing low value

## Use Cases

### Collectible Gaming

- Mystery box mechanics
- Risk-reward decision making
- Trading psychology experiments

### Quantum Experiments

- Schrödinger's cat analogy
- Observation effect demonstration
- Probability education

## Integration

### VRF Service

State determination:

- User triggers observation
- VRF generates random bytes
- Callback calculates state
- State permanently recorded

### Gateway Integration

All operations route through ServiceLayerGateway:

- Payment validation via PaymentHub
- Ownership verification
- VRF request routing
- Event monitoring

## Security Considerations

- State truly random until observation
- VRF prevents prediction
- Cannot re-observe to change state
- Ownership validated for all operations
- Birth time adds entropy to randomness

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
