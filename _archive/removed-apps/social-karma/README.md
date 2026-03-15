# Social Karma 社交因果

On-chain reputation and karma system for Neo N3.

## Overview

Social Karma tracks and rewards positive community contributions. Build your on-chain reputation through helpful actions and earn karma points.

## Features

- **Karma Points**: Earn points for positive actions
- **Reputation Scores**: Build verifiable on-chain reputation
- **Endorsements**: Give and receive peer endorsements
- **Badges**: Unlock achievement badges
- **Leaderboards**: Community rankings

## How It Works

1. Connect your wallet
2. Participate in community activities
3. Receive endorsements from peers
4. Build your karma score over time

## Usage

### Daily Check-in
- Click the daily check-in button to earn karma points
- Base reward: 10 karma + streak bonus (up to +7)
- Check-in cooldown: 20 hours

### Giving Karma
- Navigate to the "Give" tab
- Enter recipient address and karma amount (1-100)
- Add an optional reason
- Confirm the transaction

### Viewing Stats
- **Leaderboard**: See top community contributors
- **My Stats**: View your personal karma breakdown
- **Badges**: Track your earned achievements

### Badge System
| Badge | Requirement |
|-------|-------------|
| First Karma | Earn your first karma point |
| Karma 10 | Reach 10 total karma |
| Karma 100 | Reach 100 total karma |
| Karma 1000 | Reach 1000 total karma |
| Week Warrior | 7-day check-in streak |
| Monthly Master | 30-day check-in streak |
| First Gift | Give karma to someone |
| Generous Soul | Give karma 10 times |

## Technical Details

- **Category**: Social
- **Network**: Neo N3 Mainnet
- **Contract**: miniapp-social-karma
- **Permissions**: read:blockchain, invoke:primary

## Development

```bash
cd apps/social-karma
pnpm install
pnpm dev
```

## Testing

```bash
cd apps/social-karma
pnpm test
```

## License

MIT License - R3E Network
