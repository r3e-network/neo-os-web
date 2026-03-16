# Daily Check-in — Show Up, Stack Up

> Check in every day. Build your streak. Earn real GAS rewards. Consistency pays — literally.

## What is Daily Check-in?

Daily Check-in is the simplest way to earn GAS on Neo N3. Just show up once a day, tap a button, and start building a streak. Hit 7 consecutive days and earn 1 GAS. Keep going to 14 days and earn 2 GAS. Miss a day? Your streak resets and the challenge begins again.

It's a deceptively simple mechanic that drives powerful engagement. The psychology of loss aversion — not wanting to break a streak you've invested days into — keeps users coming back. Each check-in is recorded on-chain, making your streak verifiable and tamper-proof. As you build longer streaks, you earn escalating NFT badges as proof of your loyalty to the Neo ecosystem.

The live testnet flow keeps the mechanic straightforward: connect your Neo N3 wallet, check in once per UTC day, and claim rewards when you choose. Every action is recorded on-chain, so the streak remains verifiable and tamper-resistant.

## How to Use

1. **Open the App** — Launch Daily Check-in from the Neo MiniApps platform.
2. **Connect Wallet** — Link your Neo N3 wallet before checking in or claiming rewards.
3. **Tap Check-in** — Press the check-in button once per UTC day. The app shows a countdown to the next available check-in.
4. **Build Your Streak** — Check in every day without missing. Your current streak and highest streak are tracked.
5. **Earn Rewards** — At day 7 you earn 1 GAS, at day 14 you earn 2 GAS. Rewards accumulate and can be claimed anytime.
6. **Claim GAS** — Hit the claim button to withdraw your accumulated GAS rewards to your wallet.

## Key Features

- **Streak Rewards**: Escalating GAS rewards based on consecutive check-in days.
- **On-Chain Verification**: Every check-in is recorded on the blockchain — your streak is provable.
- **Simple Daily Flow**: One on-chain check-in per UTC day keeps the mechanic easy to understand.
- **Global Stats**: See how many users are checking in, total check-ins across the platform, and total GAS rewarded.
- **Check-in History**: Full history of your past check-ins with streak length and reward amounts.
- **UTC Day Reset**: Global countdown to UTC 00:00, same for all users worldwide.

## Reward Schedule

| Milestone             | Reward                 |
| --------------------- | ---------------------- |
| 7-day streak          | 1 GAS                  |
| 14-day streak         | 2 GAS                  |
| Streak resets on miss | Build again from day 1 |

## Technical Architecture

### Smart Contract

| Component           | Details                                |
| ------------------- | -------------------------------------- |
| **Contract Name**   | `MiniAppDailyCheckin`                  |
| **Language**        | C# (Neo N3 Smart Contract)             |
| **Blockchain**      | Neo N3                                 |
| **Check-in Window** | Once per UTC day (resets at 00:00 UTC) |
| **Check-in Fee**    | 0.001 GAS                              |

### Current Integration Boundary

- **Live today**: direct wallet invocation for check-in and reward claiming.
- **Not live yet**: AA session-key optimization.

### Contract Methods

| Method             | Type   | Parameters | Description                                                                                          |
| ------------------ | ------ | ---------- | ---------------------------------------------------------------------------------------------------- |
| `checkIn`          | Action | `player`   | Perform daily check-in                                                                               |
| `claimRewards`     | Action | `player`   | Claim accumulated GAS rewards                                                                        |
| `GetUserStats`     | Query  | `player`   | Returns streak, highest streak, last check-in day, unclaimed rewards, total claimed, total check-ins |
| `GetPlatformStats` | Query  | —          | Returns total users, total check-ins, total GAS rewarded                                             |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/daily-checkin

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
| Testnet | `0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528` |
| Mainnet | `0x908867b23ab551a598723ceeaaedd70c54e10c76` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x908867b23ab551a598723ceeaaedd70c54e10c76)

## Tech Stack

| Layer           | Technology                         |
| --------------- | ---------------------------------- |
| Frontend        | Vue 3 + TypeScript (uni-app)       |
| Smart Contract  | C# / Neo N3                        |
| Interaction     | Direct wallet invocation           |
| Payment         | GAS                                |

## License

MIT License — R3E Network
