# FogPlay — Oracle-Backed On-Chain Coin Flip

> Pick heads or tails. Place your bet. Wait for the oracle callback. Lightweight, direct, and fully on-chain.

## What is FogPlay?

FogPlay is a fast on-chain coin flip game built on Neo N3. Pick heads or tails, place your GAS bet (0.05–100 GAS), and let the contract request randomness through the Morpheus Oracle flow. Once the callback lands, the result is finalized on-chain and emitted for payout/indexing.

What makes FogPlay stand out isn't just the speed, but the clarity of the flow. Sound effects play on flip, win, and lose events. A dramatic coin animation builds suspense during the resolution window. It's designed to be lightweight and repeatable: simple mechanics, real stakes, fast feedback.

Every flip is provably fair at the contract boundary. The bet is stored on-chain, a randomness request is issued through the configured oracle contract, and the callback resolves the wager on-chain.

## How to Play

1. **Connect** — Open FogPlay and connect your wallet or sign in with a social account.
2. **Choose Your Side** — Tap Heads or Tails.
3. **Set Your Bet** — Enter an amount between 0.05 and 100 GAS.
4. **Flip!** — Hit the Flip button. The coin spins with a satisfying animation.
5. **Fast Result** — Once the oracle callback lands, see if you won. Winners get 2x their bet (minus platform fee). Losers see the coin land on the wrong side.
6. **Go Again** — Start another round after settlement completes.

## Key Features

- **Direct Oracle Resolution**: The contract requests randomness directly and resolves the result on-chain after callback.
- **Provably Fair**: Each flip is tied to a concrete oracle request and recorded on-chain.
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
| **Resolution Flow** | `placeBet` → oracle request → `onOracleResult` callback                 |

### Integration Path

- **Morpheus Oracle**: Direct oracle randomness callback for each bet resolution.
- **On-Chain Settlement**: The contract stores the bet and resolves the result on callback, emitting a payout event.
- **PaymentHub**: GAS payment receipts are validated before the bet enters the oracle flow.

### Contract Methods

| Method                  | Type   | Parameters                             | Description                                         |
| ----------------------- | ------ | -------------------------------------- | --------------------------------------------------- |
| `placeBet`              | Action | `player`, `amount`, `choice`, `receiptId`             | Place a bet and trigger an oracle randomness request |
| `onOracleResult`        | Action | `requestId`, `requestType`, `success`, `result`, `error` | Oracle callback that resolves the bet |
| `getBet`                | Query  | `betId`                                             | Get details of a specific bet |
| `getPlayerDailyBet`     | Query  | `player`                                            | Get the player's daily wager total |
| `getPlayerBetCount`     | Query  | `player`                                            | Get the player's current consecutive bet count |

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
| Testnet | `0x43f953c00931ca38044bf0e5ca50d608aea7ae8b` |
| Mainnet | `0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0x43f953c00931ca38044bf0e5ca50d608aea7ae8b)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x0a39f71c274dc944cd20cb49e4a38ce10f3ceea1)

## Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Frontend           | Vue 3 + TypeScript (uni-app)              |
| Smart Contract     | C# / Neo N3                               |
| Result Path        | Direct Oracle callback                    |
| Randomness         | Morpheus Oracle                           |
| Payment            | PaymentHub (GAS)                          |

## License

MIT License — R3E Network
