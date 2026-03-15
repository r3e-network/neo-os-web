# 乌龟对对碰 (Turtle Match)

Turtle Match - Neo MiniApp Game

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-turtle-match` |
| **Category** | Gaming |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Blindbox matching with GAS rewards

Purchase blindboxes, auto-open turtles on a 3x3 grid, match pairs, and settle rewards on-chain. Rewards follow the contract odds and are paid after settlement. An engaging game of chance with transparent on-chain mechanics and instant payouts.

## Features

- **🎮 Interactive Gameplay**: Purchase blindboxes and watch turtles auto-open on a beautiful 3x3 grid
- **🔗 On-chain Sessions**: All sessions, matches, and payouts are recorded transparently on the blockchain
- **🎯 Deterministic Reveals**: Turtle colors are derived from a seeded hash for provably fair outcomes
- **⚡ Instant Settlement**: Complete the session and claim GAS rewards in a single settlement transaction
- **🎨 Stunning Visuals**: Immersive underwater theme with animated turtle sprites and particle effects
- **📊 Session Statistics**: Track your total sessions played and lifetime rewards earned
- **🎁 Reward Tiers**: Multiple matching combinations with different payout multipliers
- **📱 Mobile Optimized**: Smooth gameplay experience on mobile wallets and devices

## Usage

### Getting Started

1. **Launch the App**: Open Turtle Match from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet to participate
3. **View Stats**: Check the header to see total sessions played and rewards distributed
4. **Start Playing**: Purchase blindboxes to begin a new game session

### How to Play

1. **Connect Your Wallet**: Tap the "Connect Wallet" button and authorize the connection
2. **Select Box Count**: Choose how many blindboxes to purchase (3-20 boxes)
   - More boxes = more chances to match
   - Each box costs 0.1 GAS
3. **Start the Game**: Click "Start Game" and confirm the transaction
4. **Watch Auto-Opening**: Turtles appear on the 3x3 grid automatically
5. **Match Pairs**: Match 2 or more turtles of the same color to win prizes:
   - 2 matching turtles = Small prize
   - 3 matching turtles = Medium prize
   - 4+ matching turtles = Large prize
6. **Settle Rewards**: After all boxes are opened, click "Settle" to claim your GAS
7. **Play Again**: Start a new session anytime

### Understanding the Grid

The game uses a 3x3 grid (9 positions total):
```
┌───┬───┬───┐
│ 1 │ 2 │ 3 │
├───┼───┼───┤
│ 4 │ 5 │ 6 │
├───┼───┼───┤
│ 7 │ 8 │ 9 │
└───┴───┴───┘
```

- Turtles appear in random positions as boxes open
- Each position can hold one turtle
- Match colors across any positions to win

### Turtle Colors and Rarity

Different turtle colors have different rarities and reward values:

| Color | Rarity | Match Reward |
|-------|--------|--------------|
| 🟢 Green | Common | Base reward |
| 🔵 Blue | Uncommon | 1.5x base |
| 🟣 Purple | Rare | 2x base |
| 🟡 Gold | Legendary | 5x base |
| ⚪ White | Mythic | 10x base |

### Game Flow

1. **Purchase Phase**: Select 3-20 blindboxes (0.1 GAS each)
2. **Opening Phase**: Boxes open automatically with 2-second intervals
3. **Matching Phase**: Matching colors are highlighted with animations
4. **Settlement Phase**: Claim your total rewards
5. **Completion**: View final results and start a new game

### Winning Combinations

**Single Pair (2 matching):**
- Minimum win: 0.05 GAS
- Covers part of your entry cost

**Three of a Kind (3 matching):**
- Medium win: 0.15-0.30 GAS
- Profit potential begins

**Four of a Kind (4 matching):**
- Large win: 0.50-1.00 GAS
- Significant return on investment

**Full Grid Match (5+ matching):**
- Jackpot: 2.00+ GAS
- Rare but highly rewarding

### Strategies and Tips

1. **Box Count Strategy**:
   - 3-5 boxes: Low risk, budget-friendly
   - 6-10 boxes: Balanced approach
   - 11-20 boxes: Maximum matching potential

2. **Bankroll Management**:
   - Never spend more than you can afford to lose
   - Set a session limit before playing
   - Take breaks between sessions

3. **Understanding Odds**:
   - More boxes = higher chance of matches
   - Each box is an independent event
   - Past results don't affect future outcomes

4. **Best Practices**:
   - Play during low network congestion for faster settlements
   - Keep some GAS for transaction fees
   - Track your results over time

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Turtle Match Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                    Game Session                       │     │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │     │
│   │  │ Purchase │─►│  Reveal  │─►│   Settlement     │   │     │
│   │  │   Boxes  │  │  Turtles │  │   & Payout       │   │     │
│   │  └──────────┘  └──────────┘  └──────────────────┘   │     │
│   │        │            │                │              │     │
│   └────────┼────────────┼────────────────┼──────────────┘     │
│            │            │                │                     │
│            ▼            ▼                ▼                     │
│   ┌─────────────────────────────────────────────────────┐      │
│   │              Neo N3 Smart Contract                  │      │
│   │  - Session creation and tracking                    │      │
│   │  - Deterministic randomness (hashed seed)           │      │
│   │  - Match validation logic                           │      │
│   │  - Automatic reward calculation                     │      │
│   │  - GAS distribution to winners                      │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
│   Deterministic Randomness:                                     │
│   - Seed derived from block hash + session ID                   │
│   - Turtle colors = hash[0] % color_count                       │
│   - Positions = hash[1] % 9                                     │
│   - Provably fair and verifiable                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Contract Mechanics

**Session Creation:**
```solidity
function createSession(boxCount, payment) -> sessionId
```
- Validates payment (0.1 GAS per box)
- Generates unique session ID
- Records session parameters on-chain

**Deterministic Reveal:**
```solidity
function getTurtleColor(sessionId, boxIndex) -> color
```
- Uses keccak256(blockHash + sessionId + boxIndex)
- Same input always produces same output
- Results cannot be manipulated after session starts

**Match Detection:**
```solidity
function calculateReward(sessionId) -> rewardAmount
```
- Counts matching turtle colors
- Applies payout formula based on match count
- Ensures contract has sufficient balance

**Settlement:**
```solidity
function settleSession(sessionId) -> bool
```
- Transfers calculated rewards to player
- Closes session to prevent double-claims
- Emits event for frontend tracking

### Payout Formula

```
Base Reward = 0.05 GAS
Match Multiplier = (Match Count - 1) * Rarity Multiplier
Total Reward = Sum of all match rewards

Example:
- 2 Green turtles: 0.05 * 1 = 0.05 GAS
- 3 Purple turtles: 0.05 * 2 * 2 = 0.20 GAS
- Total: 0.25 GAS
```

### Fairness Guarantees

1. **Deterministic Outcomes**: Results derived from blockchain data, not server randomness
2. **Transparent Odds**: Smart contract code is open and auditable
3. **No House Edge**: All GAS paid in goes to player rewards
4. **Instant Verification**: Anyone can verify results using the same hash function
5. **Immutable History**: All sessions permanently recorded on-chain

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ❌ No (optional for viewing) |
| Payments | ✅ Yes |
| RNG | ❌ No (uses deterministic hashing) |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- Validates payments on-chain (PaymentHub receipts when enabled)
- All game sessions recorded with unique IDs
- Rewards calculated and distributed by smart contract
- Complete transparency of all game mechanics

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x795bb2b8be2ac574d17988937cdd27d12d5950d6` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://testnet.neotube.io/contract/0x795bb2b8be2ac574d17988937cdd27d12d5950d6) |
| **Network Magic** | `894710606` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0xac10b90f40c015da61c71e30533309760b75fec7` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | [View on NeoTube](https://neotube.io/contract/0xac10b90f40c015da61c71e30533309760b75fec7) |
| **Network Magic** | `860833102` |

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

## Assets

- **Allowed Assets**: NEO, GAS
- **Game Currency**: GAS only
- **Cost Per Box**: 0.1 GAS
- **Minimum Purchase**: 3 boxes (0.3 GAS)
- **Maximum Purchase**: 20 boxes (2.0 GAS)

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

### Project Structure

```
apps/turtle-match/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main game component
│   │   │   └── components/
│   │   │       ├── TurtleGrid.vue     # 3x3 game grid
│   │   │       ├── TurtleSprite.vue   # Animated turtle SVG
│   │   │       ├── BlindboxOpening.vue
│   │   │       ├── MatchCelebration.vue
│   │   │       ├── GameResult.vue
│   │   │       └── GameSplash.vue
│   │   └── docs/
│   │       └── index.vue              # Documentation view
│   ├── shared/
│   │   └── composables/
│   │       └── useTurtleMatch.ts      # Game logic
│   ├── composables/
│   │   └── useI18n.ts                 # Internationalization
│   └── static/
│       └── game.css                   # Game animations
├── package.json
└── README.md
```

### Component Details

- **TurtleGrid**: Displays the 3x3 grid with turtle positions
- **TurtleSprite**: SVG-based animated turtle with color variants
- **BlindboxOpening**: Animation for box opening reveal
- **MatchCelebration**: Winning match animation with reward display
- **GameResult**: Session summary modal with statistics
- **GameSplash**: Intro animation on app load

## Troubleshooting

**"Insufficient balance" error:**
- Ensure you have at least 0.3 GAS (minimum 3 boxes)
- Remember to keep some GAS for transaction fees

**Transaction failing:**
- Check network connectivity
- Ensure you're on the correct network (mainnet/testnet)
- Try refreshing the page and reconnecting wallet

**Game not starting:**
- Verify your wallet is properly connected
- Check that the transaction was confirmed on-chain
- Look for error messages in the UI

**Cannot settle rewards:**
- Ensure the session is complete (all boxes opened)
- Check that you haven't already settled this session
- Verify the contract has sufficient GAS balance

**Animations not showing:**
- Check your device's performance settings
- Try closing other apps to free up memory
- Ensure you're using a supported browser/wallet

## Responsible Gaming

Turtle Match is a game of chance. Please play responsibly:

- Set a budget and stick to it
- Never chase losses
- Take regular breaks
- Remember that outcomes are random
- Seek help if gambling affects your life negatively

## Support

For questions about game mechanics or smart contracts, visit the Neo MiniApp documentation.

For technical issues, contact the Neo MiniApp support team.

---

**Good luck and happy matching! 🐢🎮**
