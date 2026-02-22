# MiniApp Classification Report

## Overview

This report classifies all 65 existing miniapps into template families and identifies migration paths to the new template-driven architecture.

## Template Families

### 1. Prediction Market (prediction)
**Template ID:** `prediction`
**Description:** Binary/multi-outcome prediction markets with trading interface

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Prediction Market | prediction-market | ✅ Yes | Reference implementation |
| Crypto Riddle | crypto-riddle | ✅ Yes | Riddle-based prediction |
| Neo Crash | neo-crash | ✅ Yes | Price crash prediction |
| Price Ticker | price-ticker | ⚠️ Partial | Needs price display customization |
| Doomsday Clock | doomsday-clock | ✅ Yes | Time-based prediction |

**Template Parameters:**
```json
{
  "oracle_type": "price_feed|manual|timelock",
  "outcome_type": "binary|multi",
  "settlement_delay": 3600,
  "fee_bps": 100
}
```

### 2. Voting (voting)
**Template ID:** `voting`
**Description:** On-chain voting with optional privacy features

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Candidate Vote | candidate-vote | ✅ Yes | Public voting |
| Secret Vote | secret-vote | ✅ Yes | Privacy-preserving voting |
| Masquerade DAO | masquerade-dao | ⚠️ Partial | Needs DAO features |

**Template Parameters:**
```json
{
  "voting_type": "public|secret|quadratic",
  "token_weighted": true,
  "proposal_threshold": 1000,
  "voting_period": 86400
}
```

### 3. Lottery/Gaming (lottery)
**Template ID:** `lottery`
**Description:** Chance-based games with random outcomes

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Lottery | lottery | ✅ Yes | Reference implementation |
| No-Loss Lottery | no-loss-lottery | ✅ Yes | Prize-linked savings |
| Scratch Card | scratch-card | ✅ Yes | Instant win game |
| Coin Flip | coin-flip | ✅ Yes | Simple binary game |
| Dice Game | dice-game | ✅ Yes | Multi-outcome game |
| Candle Wars | candle-wars | ⚠️ Partial | Needs trading features |

**Template Parameters:**
```json
{
  "draw_type": "instant|scheduled",
  "prize_distribution": "winner_takes_all|tiered",
  "ticket_price": 10,
  "max_tickets": 1000,
  "randomness_source": "on_chain|vrf"
}
```

### 4. Auction (auction)
**Template ID:** `auction`
**Description:** Competitive bidding mechanisms

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Dutch Auction | dutch-auction | ✅ Yes | Price discovery auction |

**Template Parameters:**
```json
{
  "auction_type": "dutch|english|sealed_bid",
  "starting_price": 1000,
  "reserve_price": 500,
  "duration": 86400,
  "price_decrement": 10
}
```

### 5. DeFi (defi)
**Template ID:** `defi`
**Description:** Financial primitives

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Neo Swap | neo-swap | ⚠️ Needs New Template | AMM |
| Quantum Swap | quantum-swap | ⚠️ Needs New Template | DEX |
| Flash Loan | flashloan | ✅ Yes | Reference implementation |
| Self Loan | self-loan | ⚠️ Needs New Template | Lending |
| Gas Circle | gas-circle | ✅ Yes | Reference implementation |
| Neoburger | neoburger | ⚠️ Needs New Template | Yield optimizer |
| Compound Capsule | compound-capsule | ⚠️ Needs New Template | Yield |
| IL Guard | il-guard | ⚠️ Needs New Template | Insurance |
| Grid Bot | grid-bot | ⚠️ Needs New Template | Trading bot |

**Template Parameters:**
```json
{
  "protocol_type": "lending|swap|yield|insurance",
  "fee_model": "dynamic|fixed",
  "collateral_ratio": 1.5
}
```

### 6. NFT (nft)
**Template ID:** `nft`
**Description:** Non-fungible token operations

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| NFT Chimera | nft-chimera | ⚠️ Needs New Template | NFT merging |
| NFT Evolve | nft-evolve | ⚠️ Needs New Template | NFT evolution |
| Schrodinger NFT | schrodinger-nft | ⚠️ Needs New Template | Mystery NFT |
| ZK Badge | zk-badge | ⚠️ Needs New Template | Verifiable credentials |
| Million Piece Map | million-piece-map | ⚠️ Needs New Template | Fractional ownership |

**Template Parameters:**
```json
{
  "mint_type": "single|collection|generative",
  "royalty_bps": 500,
  "max_supply": 10000,
  "evolution_enabled": false
}
```

### 7. Gaming (gaming)
**Template ID:** `gaming`
**Description:** On-chain games with complex logic

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Fog Chess | fog-chess | ⚠️ Needs New Template | Hidden info game |
| Secret Poker | secret-poker | ⚠️ Needs New Template | Card game with secrets |
| Fog Puzzle | fog-puzzle | ⚠️ Needs New Template | Puzzle game |
| Algo Battle | algo-battle | ⚠️ Needs New Template | Strategy game |

**Template Parameters:**
```json
{
  "game_type": "turn_based|real_time",
  "privacy_level": "none|partial|full",
  "max_players": 2,
  "wager_enabled": true
}
```

### 8. Social/Content (social)
**Template ID:** `social`
**Description:** Social and content applications

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| AI Soulmate | ai-soulmate | ⚠️ Needs New Template | AI chat |
| Dark Radio | dark-radio | ⚠️ Needs New Template | Audio streaming |
| Whisper Chain | whisper-chain | ⚠️ Needs New Template | Anonymous messaging |
| Ex Files | ex-files | ⚠️ Needs New Template | Social contract |
| Time Capsule | time-capsule | ⚠️ Needs New Template | Time-locked content |
| Graveyard | graveyard | ⚠️ Needs New Template | Memorial |
| Breakup Contract | breakup-contract | ⚠️ Needs New Template | Relationship contract |
| Heritage Trust | heritage-trust | ⚠️ Needs New Template | Inheritance |
| Dead Switch | dead-switch | ⚠️ Needs New Template | Emergency trigger |

### 9. Tipping/Rewards (tipping)
**Template ID:** `tipping`
**Description:** Payment and reward mechanisms

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Dev Tipping | dev-tipping | ✅ Yes | Reference implementation |
| Bounty Hunter | bounty-hunter | ⚠️ Needs New Template | Task rewards |
| Scream to Earn | scream-to-earn | ⚠️ Needs New Template | X-to-earn |
| Red Envelope | red-envelope | ✅ Yes | Reference implementation |

### 10. Governance (governance)
**Template ID:** `governance`
**Description:** DAO and governance tools

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Gov Booster | gov-booster | ✅ Yes | Reference implementation |
| Gov Merc | gov-merc | ⚠️ Needs New Template | Governance mercenary |
| Guardian Policy | guardian-policy | ✅ Yes | Reference implementation |

### 11. Utilities (utility)
**Template ID:** `utility`
**Description:** General utility applications

| App Name | App ID | Can Use Existing Template | Notes |
|----------|--------|---------------------------|-------|
| Bridge Guardian | bridge-guardian | ⚠️ Custom | Bridge monitoring |
| Burn League | burn-league | ⚠️ Custom | Burning competition |
| Canvas | canvas | ⚠️ Custom | Collaborative canvas |
| Explorer | explorer | ⚠️ Custom | Block explorer |
| Gas Sponsor | gas-sponsor | ⚠️ Custom | Gas sponsorship |
| Geo Spotlight | geo-spotlight | ⚠️ Custom | Location-based |
| Melting Asset | melting-asset | ⚠️ Custom | Decay mechanism |
| On-Chain Tarot | on-chain-tarot | ⚠️ Custom | Fortune telling |
| Parasite | parasite | ⚠️ Custom | Unique mechanism |
| Pay to View | pay-to-view | ⚠️ Custom | Content gating |
| Puzzle Mining | puzzle-mining | ⚠️ Custom | Mining game |
| Unbreakable Vault | unbreakable-vault | ⚠️ Custom | Time-lock vault |
| World Piano | world-piano | ⚠️ Custom | Music app |
| AI Trader | ai-trader | ⚠️ Custom | AI trading |
| Garden of Neo | garden-of-neo | ⚠️ Custom | Virtual garden |

## Migration Priority

### Phase 1: High-Value, Low-Effort (Immediate)
These apps can be migrated quickly using existing templates:

1. **prediction-market** → prediction template ✅
2. **lottery** → lottery template ✅
3. **coin-flip** → lottery template ✅
4. **dice-game** → lottery template ✅
5. **scratch-card** → lottery template ✅
6. **dutch-auction** → auction template ✅
7. **candidate-vote** → voting template ✅
8. **secret-vote** → voting template ✅
9. **red-envelope** → tipping template ✅
10. **dev-tipping** → tipping template ✅

### Phase 2: Template Extension (Short-term)
These apps need minor template extensions:

1. **no-loss-lottery** → lottery template + yield feature
2. **price-ticker** → prediction template + price display
3. **doomsday-clock** → prediction template + countdown
4. **crypto-riddle** → prediction template + riddle content
5. **gov-booster** → governance template
6. **guardian-policy** → governance template

### Phase 3: New Templates (Medium-term)
These apps need new template types:

1. **defi/** apps → defi template family
2. **nft/** apps → nft template family
3. **gaming/** apps → gaming template family
4. **social/** apps → social template family

### Phase 4: Custom Implementations (Long-term)
These apps have unique mechanisms that need custom contracts:

- fog-chess, secret-poker, fog-puzzle (hidden information games)
- bridge-guardian, explorer (infrastructure)
- canvas, world-piano (creative tools)

## Summary Statistics

| Template Family | Ready Apps | Need Extension | Need New Template | Custom |
|-----------------|------------|----------------|-------------------|--------|
| prediction | 4 | 1 | 0 | 0 |
| voting | 2 | 1 | 0 | 0 |
| lottery | 5 | 1 | 0 | 0 |
| auction | 1 | 0 | 0 | 0 |
| defi | 2 | 0 | 7 | 0 |
| nft | 0 | 0 | 5 | 0 |
| gaming | 0 | 0 | 4 | 0 |
| social | 0 | 0 | 9 | 0 |
| tipping | 2 | 2 | 0 | 0 |
| governance | 2 | 1 | 0 | 0 |
| utility | 0 | 0 | 0 | 15 |

**Total:**
- **Ready for immediate migration:** 18 apps (28%)
- **Need template extension:** 7 apps (11%)
- **Need new templates:** 25 apps (38%)
- **Custom implementations:** 15 apps (23%)

## Next Steps

1. **Create configuration files** for Phase 1 apps using existing templates
2. **Extend templates** to support Phase 2 apps
3. **Design new template families** for Phase 3 apps
4. **Document custom contract patterns** for Phase 4 apps
