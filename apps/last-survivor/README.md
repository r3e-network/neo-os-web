# LastSurvivor — The Last One Standing Wins Everything

> Every second counts. Every contribution resets the clock. When the countdown hits zero, the last survivor takes it all.

## What is LastSurvivor?

LastSurvivor is a high-stakes social game built on Neo N3 where psychology meets game theory. Inspired by Reddit's legendary "The Button" experiment, LastSurvivor creates a simple yet electrifying premise: a 24-hour countdown ticks toward zero while a prize pool grows with every contribution. Each time someone buys keys, the timer resets — but the pot gets bigger. The last person to buy a key before the timer finally expires wins the entire jackpot.

The beauty lies in its simplicity. There are no complex rules, no hidden mechanics — just a timer, a growing prize pool, and the eternal question: _will someone else press the button, or is this my moment?_ The game creates a natural crescendo of tension as the pot swells and the timer winds down, turning every participant into both ally (growing the pot) and rival (competing for the final position).

Built as a Neo N3 MiniApp, LastSurvivor uses direct prepaid GAS transfers plus Keeper automation to guarantee fair, trustless prize distribution the instant the clock hits zero.

## How to Play

1. **Open the App** — Launch LastSurvivor from the Neo MiniApps platform. Sign in with your social account or connect a wallet.
2. **Check the Clock** — View the current countdown timer, prize pool size, and the last key buyer.
3. **Buy Keys** — Spend GAS to purchase keys. Each purchase resets the 24-hour countdown and adds to the prize pool. Key prices increase as the pot grows.
4. **Watch & Wait** — Monitor the timer. As it ticks closer to zero, tension builds. Will someone else reset it?
5. **Win the Pot** — If the timer reaches zero and you were the last key buyer, the entire prize pool is yours. A new round begins automatically.

## Key Features

- **Prize Pool Mechanics**: Every key purchase grows the pot. Key prices escalate with an arithmetic progression — early keys are cheap, late keys cost more.
- **24-Hour Reset**: Each key purchase resets the countdown to 24 hours, creating waves of tension and relief.
- **Winner Takes All**: The last key buyer when the timer expires claims the entire jackpot.
- **Round System**: After each round concludes, a new round starts automatically with a fresh timer and empty pot.
- **Live History Feed**: Real-time event stream showing key purchases, round starts, and winner declarations.
- **Strategy Depth**: Buying multiple keys increases your odds. Timing your purchases during the final moments is key.

## Technical Architecture

### Smart Contract

| Component           | Details                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| **Contract Name**   | `MiniAppLastSurvivor`                                                        |
| **Language**        | C# (Neo N3 Smart Contract)                                                    |
| **Blockchain**      | Neo N3                                                                        |
| **Key Price Model** | Arithmetic escalation — base price + (total keys × increment per basis point) |
| **Base Key Price**  | 0.1 GAS                                                                       |
| **Price Increment** | 0.1% (10 bps) per key sold                                                    |

### Service Layer Technologies

- **Keeper (Automation)**: Automatically triggers prize distribution when the 24-hour countdown expires. No manual intervention needed — the contract settles trustlessly.
- **Direct Prepaid GAS**: The wallet prepays the exact key cost directly to the MiniApp contract, then calls `buyKeysWithCost`. The `receiptId` argument is retained only for ABI compatibility and is passed as `0` in the live flow.

### Contract Methods

| Method            | Type   | Parameters                        | Description                                                                       |
| ----------------- | ------ | --------------------------------- | --------------------------------------------------------------------------------- |
| `getGameStatus`   | Query  | —                                 | Returns round ID, pot size, active status, last buyer, remaining time, total keys |
| `getPlayerKeys`   | Query  | `player`, `roundId`               | Returns key count for a specific player in a specific round                       |
| `getRoundDetails` | Query  | `roundId`                         | Returns detailed information about a specific round                               |
| `buyKeysWithCost` | Action | `player`, `keyCount`, `submittedCost`, `receiptId` | Purchase keys for the current round using direct prepaid GAS credit plus formula-verified price (`receiptId` is a placeholder in the live flow) |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/last-survivor

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
| Testnet | `0xf0914d411877c8393c029f48ec0c4c64d44f1b49` |
| Mainnet | `0x180a3a35c088eab4feded508c2ccb1556e07a840` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0xf0914d411877c8393c029f48ec0c4c64d44f1b49)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x180a3a35c088eab4feded508c2ccb1556e07a840)

## Domains

- Mainnet domain: `lastsurvivor.miniapp.neo`

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Frontend       | Vue 3 + TypeScript (uni-app)       |
| Smart Contract | C# / Neo N3                        |
| Interaction    | Direct wallet invocation           |
| Automation     | Keeper (Timer Expiry Trigger)      |
| Payment        | Direct prepaid GAS to the miniapp contract |

## License

MIT License — R3E Network
