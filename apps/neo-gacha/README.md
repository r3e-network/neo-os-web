# GASBOX — Spin the Chain, Win the Prize

> Drop 0.1 GAS. Spin the box. Win NEO, rare NFTs, or platform points. Every draw is provably fair.

## What is GASBOX?

GASBOX is the first fully on-chain gacha (blind box) experience on Neo N3. For as little as 0.1 GAS per spin, players can win prizes ranging from NEO tokens and rare NFTs to platform points — all powered by verifiable random functions (VRF) that make every draw provably fair and tamper-proof.

Think of it as a decentralized gachapon machine. Creators can set up custom machines with their own prize pools, rarity tiers, and pricing. Players spin and instantly see results, complete with fireworks animations for big wins. The gacha economy is transparent — every probability, every stock level, every payout is recorded on-chain for anyone to verify.

What makes GASBOX special is the seamless experience. Account Abstraction session keys let players do rapid consecutive draws without approving each transaction individually — it feels like tapping a physical gacha machine. Keeper automation broadcasts big win announcements across the platform, creating social proof and excitement.

## How to Play

1. **Browse Machines** — Explore available gacha machines, each with its own theme, prizes, and spin cost.
2. **Connect & Spin** — Log in with a social account or wallet. Pay the spin cost (starting at 0.1 GAS) to draw.
3. **See Your Prize** — The VRF generates a random seed on-chain. Your prize is determined instantly with a satisfying reveal animation.
4. **Collect Rewards** — NEO, GAS, NFTs, or points are credited to your account automatically.
5. **Go Again** — Session keys mean you can keep spinning without re-approving. Chase that legendary drop!

## Key Features

- **Provably Fair Draws**: Every spin uses on-chain VRF (Verifiable Random Function). The seed is public, the selection algorithm is deterministic — anyone can verify the result.
- **Tiered Rarity System**: Prizes span multiple rarity tiers. View exact probabilities and remaining stock before you spin.
- **Ultra-Low Entry**: Spins start at 0.1 GAS — accessible to everyone.
- **Creator Machines**: Anyone can create and stock a gacha machine with custom prizes, probabilities, and pricing.
- **Rapid-Fire Spins**: AA session keys enable consecutive draws without signing each transaction.
- **Big Win Broadcasts**: Keeper automation detects legendary wins and broadcasts them platform-wide.
- **Machine Marketplace**: Machines can be listed for sale — buy a profitable machine from another creator.

## Technical Architecture

### Smart Contract

| Component         | Details                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Contract Name** | `MiniAppNeoGacha`                                                                            |
| **Language**      | C# (Neo N3 Smart Contract)                                                                   |
| **Blockchain**    | Neo N3                                                                                       |
| **Play Flow**     | `initiatePlay` → VRF seed → client selection simulation → `settlePlay` on-chain verification |
| **Asset Types**   | Fungible tokens (NEO/GAS, type 1) and NFTs (type 2)                                          |

### Service Layer Technologies

- **VRF (Verifiable Random Function)**: On-chain randomness ensures every draw is fair. The seed is generated during `initiatePlay` and used deterministically to select a prize.
- **Account Abstraction (AA)**: Session keys for rapid consecutive draws — no wallet popup per spin. Gas sponsoring keeps the experience frictionless.
- **Keeper (Automation)**: Monitors for big win events (`PlayResolved` with high-value prizes) and triggers platform-wide broadcast notifications and celebration effects.

### Contract Methods

| Method              | Type   | Parameters                          | Description                                          |
| ------------------- | ------ | ----------------------------------- | ---------------------------------------------------- |
| `initiatePlay`      | Action | `player`, `machineId`, `receiptId`  | Start a gacha draw — pays, generates VRF seed        |
| `settlePlay`        | Action | `player`, `playId`, `selectedIndex` | Settle the draw — verify selection, distribute prize |
| `buyMachine`        | Action | `player`, `machineId`, `receiptId`  | Purchase a machine listed for sale                   |
| `getMachineDetails` | Query  | `machineId`                         | Get machine info (items, prices, stock)              |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/neo-gacha

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (H5)
npm run build
```

## Contract Addresses

| Network | Address                                      |
| ------- | -------------------------------------------- |
| Testnet | `0x0fe7031381647039025b1e06c12f0579069ed0bc` |
| Mainnet | `0xc9af7c9de5b0963e6514b6462b293f0179eb3798` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0x0fe7031381647039025b1e06c12f0579069ed0bc)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0xc9af7c9de5b0963e6514b6462b293f0179eb3798)

## Tech Stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Frontend        | Vue 3 + TypeScript (uni-app)              |
| Smart Contract  | C# / Neo N3                               |
| Randomness      | VRF (On-chain Verifiable Random Function) |
| UX Optimization | Account Abstraction (Session Keys)        |
| Social Features | Keeper (Big Win Broadcast)                |
| Payment         | PaymentHub (GAS)                          |

## License

MIT License — R3E Network
