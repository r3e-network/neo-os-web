# GAS Circle

Daily Savings Circle with VRF Lottery - Community savings pool with random winner selection.

## Overview

GAS Circle is a decentralized savings circle (ROSCA) where participants deposit daily and one lucky member wins the pot each round. VRF ensures fair, verifiable winner selection.

## Features

- **Daily Deposits**: 0.1 GAS minimum daily contribution
- **VRF Lottery**: Provably fair winner selection
- **Automated Rounds**: 7-day or 30-day cycles
- **Community Pools**: Join or create savings groups
- **Streak Bonuses**: Extra entries for consistent deposits

## How It Works

1. **Join Circle**: Enter a savings group
2. **Daily Deposit**: Contribute 0.1+ GAS daily
3. **Build Streak**: Consecutive days = bonus entries
4. **Win Pot**: VRF selects winner at round end

## Streak Multipliers

| Consecutive Days | Lottery Entries |
| ---------------- | --------------- |
| 1-6 days         | 1x              |
| 7-13 days        | 2x              |
| 14-20 days       | 3x              |
| 21-27 days       | 4x              |
| 28+ days         | 5x              |

## Technical Details

### Platform Capabilities Used

| Capability     | Usage                      |
| -------------- | -------------------------- |
| **Payments**   | Daily deposits and payouts |
| **RNG**        | VRF winner selection       |
| **Automation** | Scheduled round completion |

### Circle Lifecycle

```
Create/Join → Daily Deposit → Track Streak → Round End → VRF Draw
     ↓             ↓              ↓             ↓           ↓
  Set params   PayToApp      Update count   Automation   Payout
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "rng": true,
    "automation": true
  },
  "assets_allowed": ["GAS"]
}
```

## Development

```bash
npx serve miniapps/builtin/gas-circle
```

## Related Apps

- [Red Envelope](../red-envelope/) - Social GAS distribution
- [Lottery](../lottery/) - Traditional lottery
