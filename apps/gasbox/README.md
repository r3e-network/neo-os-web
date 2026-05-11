# GASBOX — Spin the Chain, Win the Prize

> Drop 0.1 GAS. Spin the box. Win NEO, rare NFTs, or platform points. Every draw is provably fair.

## What is GASBOX?

GASBOX is the first fully on-chain gacha (blind box) experience on Neo N3. For as little as 0.1 GAS per spin, players can win prizes ranging from NEO tokens and rare NFTs to platform points — all powered by verifiable random functions (VRF) that make every draw provably fair and tamper-proof.

Think of it as a decentralized gachapon machine. Creators can set up custom machines with their own prize pools, rarity tiers, and pricing. Players spin and instantly see results, complete with fireworks animations for big wins. The gacha economy is transparent — every probability, every stock level, every payout is recorded on-chain for anyone to verify.

What makes GASBOX special is the transparency of the machine itself. Prize tables, stock levels, and machine configuration live on-chain. Keeper automation can still broadcast big wins across the platform, creating social proof and excitement.

## How to Play

1. **Browse Machines** — Explore available gacha machines, each with its own theme, prizes, and spin cost.
2. **Connect & Spin** — Connect your Neo N3 wallet. Pay the spin cost (starting at 0.1 GAS) to draw.
3. **See Your Prize** — The VRF generates a random seed on-chain. Your prize is determined instantly with a satisfying reveal animation.
4. **Collect Rewards** — NEO, GAS, NFTs, or points are credited to your account automatically.
5. **Go Again** — Start another draw whenever you want and keep chasing the legendary drop.

## Key Features

- **Provably Fair Draws**: Every spin uses on-chain VRF (Verifiable Random Function). The seed is public, the selection algorithm is deterministic — anyone can verify the result.
- **Tiered Rarity System**: Prizes span multiple rarity tiers. View exact probabilities and remaining stock before you spin.
- **Ultra-Low Entry**: Spins start at 0.1 GAS — accessible to everyone.
- **Creator Machines**: Anyone can create and stock a gacha machine with custom prizes, probabilities, and pricing.
- **Big Win Broadcasts**: Keeper automation detects legendary wins and broadcasts them platform-wide.
- **Machine Marketplace**: Machines can be listed for sale — buy a profitable machine from another creator.

## Technical Architecture

### Smart Contract

| Component         | Details                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Contract Name** | `MiniAppGASBox`                                                                            |
| **Language**      | C# (Neo N3 Smart Contract)                                                                   |
| **Blockchain**    | Neo N3                                                                                       |
| **Play Flow**     | `initiatePlay` → VRF seed → client selection simulation → `settlePlay` on-chain verification |
| **Asset Types**   | Fungible tokens (NEO/GAS, type 1) and NFTs (type 2)                                          |

### Service Layer Technologies

- **VRF (Verifiable Random Function)**: On-chain randomness ensures every draw is fair. The seed is generated during `initiatePlay` and used deterministically to select a prize.
- **Keeper (Automation)**: Monitors for big win events (`PlayResolved` with high-value prizes) and triggers platform-wide broadcast notifications and celebration effects.
- **Current wallet flow**: the live testnet app uses direct wallet transactions rather than AA session keys.

### Contract Methods

| Method              | Type   | Parameters                          | Description                                          |
| ------------------- | ------ | ----------------------------------- | ---------------------------------------------------- |
| `initiatePlay`      | Action | `player`, `machineId`               | Start a gacha draw after the user prepays GAS directly to the contract |
| `settlePlay`        | Action | `player`, `playId`, `selectedIndex` | Settle the draw — verify selection, distribute prize |
| `buyMachine`        | Action | `player`, `machineId`               | Purchase a machine listed for sale using direct prepaid GAS |
| `getMachineDetails` | Query  | `machineId`                         | Get machine info (items, prices, stock)              |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/gasbox

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
| Testnet | `0x740671b10330ef6669ab8b2724437eb8d5e7a34c` |
| Mainnet | `0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7` |

### Explorer Links

- **Testnet**: [View on Neo3Scan](https://www.neo3scan.com/contract/0x740671b10330ef6669ab8b2724437eb8d5e7a34c)
- **Mainnet**: [View on Neo3Scan](https://www.neo3scan.com/contract/0xa7840a8d5404bbe297a00756a29cc267d6fa6cc7)

## Domains

- Mainnet domain: `gasbox.miniapp.neo`

## Tech Stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Frontend        | Host-native React + TypeScript              |
| Smart Contract  | C# / Neo N3                               |
| Randomness      | VRF (On-chain Verifiable Random Function) |
| Interaction     | Direct wallet invocation                  |
| Social Features | Keeper (Big Win Broadcast)                |
| Payment         | Direct prepaid GAS to the miniapp contract |

## License

MIT License — R3E Network
