# Secret Poker

TEE Texas Hold'em - Hidden cards secured in Trusted Execution Environment.

## Overview

Secret Poker brings fair, trustless Texas Hold'em to Neo N3. Your hole cards are encrypted and stored in the TEE, ensuring no one can see them until showdown.

## Features

- **Hidden Hole Cards**: TEE encrypts your cards
- **Provable Fairness**: VRF deck shuffling
- **GAS Stakes**: Multiple table limits
- **Real-time Play**: WebSocket game updates
- **Hand History**: Review past hands

## How It Works

1. **Join Table**: Select stake level (0.1-10 GAS)
2. **Post Blinds**: Automatic blind posting
3. **Receive Cards**: TEE deals encrypted cards
4. **Play Rounds**: Bet, call, raise, or fold
5. **Showdown**: TEE reveals winner's cards

## Table Limits

| Table | Buy-in  | Blinds    |
| ----- | ------- | --------- |
| Micro | 0.5 GAS | 0.01/0.02 |
| Low   | 2 GAS   | 0.05/0.1  |
| Mid   | 10 GAS  | 0.25/0.5  |
| High  | 50 GAS  | 1/2       |

## Technical Details

### Platform Capabilities Used

| Capability   | Usage                   |
| ------------ | ----------------------- |
| **Payments** | Buy-ins and pot payouts |
| **RNG**      | VRF deck shuffling      |
| **Compute**  | TEE card encryption     |

### Game Flow

```
Join Table → Post Blinds → Deal Cards → Betting Rounds → Showdown
     ↓           ↓            ↓              ↓             ↓
  PayToApp   Auto-post    TEE encrypt    Player actions  TEE reveal
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "rng": true,
    "compute": true
  },
  "assets_allowed": ["GAS"]
}
```

## Development

```bash
npx serve miniapps/builtin/secret-poker
```

## Related Apps

- [Fog Chess](../fog-chess/) - TEE strategy game
- [Coin Flip](../coin-flip/) - Quick betting
