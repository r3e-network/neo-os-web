# FogPlay — Instant On-Chain Coin Flip

> Pick heads or tails. Place your bet. Get results in under a second. No waiting, no commit-reveal — just pure, instant, provably fair action.

## What is FogPlay?

FogPlay is a lightning-fast on-chain coin flip game that feels like a native mobile app. Pick heads or tails, place your GAS bet (0.05–100 GAS), and get results instantly — no multi-second commit-reveal delays. The secret sauce is TEE (Trusted Execution Environment): bets are resolved inside a secure enclave that generates the result from a VRF seed, eliminating the need for the slow two-phase commit-reveal pattern used by most on-chain games.

What makes FogPlay stand out isn't just the speed — it's the feel. Account Abstraction session keys mean you can flip again and again without approving each transaction. Sound effects play on flip, win, and lose events. A dramatic coin animation builds suspense during the brief resolution window. It's designed to be addictive in the best way: simple mechanics, real stakes, instant gratification.

Every flip is provably fair. The VRF seed is generated on-chain during `initiateBet`, hashed deterministically to produce the outcome, and verified during `settleBet`. Anyone can replay the hash to confirm the result was not manipulated.

## How to Play

1. **Connect** — Open FogPlay and connect your wallet or sign in with a social account.
2. **Choose Your Side** — Tap Heads or Tails.
3. **Set Your Bet** — Enter an amount between 0.05 and 100 GAS.
4. **Flip!** — Hit the Flip button. The coin spins with a satisfying animation.
5. **Instant Result** — Within a second, see if you won. Winners get 2x their bet (minus platform fee). Losers see the coin land on the wrong side.
6. **Go Again** — Session keys mean no re-approval needed. Keep flipping!

## Key Features

- **Sub-Second Resolution**: TEE eliminates commit-reveal delays. Results arrive almost instantly.
- **Provably Fair**: VRF seed → SHA-256 hash → deterministic outcome. Every flip is verifiable.
- **Session Key Rapid Play**: AA session keys let you flip repeatedly without signing each bet.
- **Immersive UX**: Coin flip animation, sound effects for flip/win/lose, and a dramatic win overlay.
- **Win Tracking**: Total wins, losses, games played, and GAS won are tracked per session.
- **Flexible Bets**: Bet anywhere from 0.05 to 100 GAS per flip.
- **Retry on Failure**: If a transaction fails, you get a retry button — no lost bets.

## Technical Architecture

### Smart Contract

| Component           | Details                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| **Contract Name**   | `MiniAppCoinFlip`                                                       |
| **Language**        | C# (Neo N3 Smart Contract)                                              |
| **Blockchain**      | Neo N3                                                                  |
| **Bet Range**       | 0.05 – 100 GAS                                                          |
| **Resolution Flow** | `initiateBet` → VRF seed → SHA-256 hash → `settleBet` with verification |

### Service Layer Technologies

- **TEE (Trusted Execution Environment)**: Bets are resolved inside a TEE enclave. The VRF seed is hashed to determine the outcome — no commit-reveal needed. Instant resolution with cryptographic proof.
- **Account Abstraction (AA)**: Session keys enable rapid consecutive bets without wallet popup on each flip.
- **VRF (Verifiable Random Function)**: On-chain verifiable randomness generates the seed for each flip. The outcome is derived deterministically via SHA-256, making every result independently verifiable.

### Contract Methods

| Method                  | Type   | Parameters                             | Description                                         |
| ----------------------- | ------ | -------------------------------------- | --------------------------------------------------- |
| `initiateBet`           | Action | `player`, `amount`, `choice`           | Place a bet — pays GAS, generates VRF seed          |
| `settleBet`             | Action | `player`, `betId`, `won`, `scriptHash` | Settle the bet — verify result, distribute winnings |
| `getFlipScriptInfo`     | Query  | —                                      | Get the flip script hash for verification           |
| `GetBetDetails`         | Query  | `betId`                                | Get details of a specific bet                       |
| `GetPlayerStatsDetails` | Query  | `player`                               | Get player's win/loss statistics                    |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/coin-flip

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
| Testnet | `0xbd4c9203495048900e34cd9c4618c05994e86cc0` |
| Mainnet | `0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0xbd4c9203495048900e34cd9c4618c05994e86cc0)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1)

## Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Frontend           | Vue 3 + TypeScript (uni-app)              |
| Smart Contract     | C# / Neo N3                               |
| Instant Resolution | TEE (Trusted Execution Environment)       |
| Rapid Play         | Account Abstraction (Session Keys)        |
| Randomness         | VRF (On-chain Verifiable Random Function) |
| Payment            | PaymentHub (GAS)                          |

## License

MIT License — R3E Network
