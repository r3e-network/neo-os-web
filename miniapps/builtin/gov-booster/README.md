# Gov Booster

NEO Governance Optimization Tool - Auto-compound rewards and smart vote switching.

## Overview

Gov Booster maximizes your NEO governance rewards through automated claiming, compounding, and intelligent vote switching based on candidate performance data.

## Features

- **Auto-Compound**: Automatically claim and restake GAS rewards
- **Vote Switching**: Optimize votes based on candidate APY
- **Performance Tracking**: Real-time candidate statistics
- **Reward Calculator**: Estimate earnings by candidate
- **Batch Operations**: Manage multiple NEO positions

## How It Works

1. **Connect Wallet**: Link your NEO holdings
2. **View Candidates**: See all candidates with APY data
3. **Set Strategy**: Choose auto-compound frequency
4. **Enable Automation**: Let the system optimize votes

## Candidate Metrics

| Metric          | Description             |
| --------------- | ----------------------- |
| **APY**         | Annual percentage yield |
| **Uptime**      | Node reliability score  |
| **Commission**  | Fee taken from rewards  |
| **Total Votes** | Current vote weight     |

## Technical Details

### Platform Capabilities Used

| Capability     | Usage                      |
| -------------- | -------------------------- |
| **Payments**   | Service fee (0.01 GAS)     |
| **Governance** | NEO voting operations      |
| **Datafeed**   | Candidate performance data |
| **Automation** | Scheduled claim/compound   |

### Optimization Flow

```
Analyze Candidates → Compare APY → Switch Votes → Claim Rewards → Compound
        ↓                ↓             ↓              ↓            ↓
   Datafeed query    Calculate    Vote TX      Claim GAS     Restake
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "governance": true,
    "datafeed": true,
    "automation": true
  },
  "governance_assets_allowed": ["NEO"]
}
```

## Development

```bash
npx serve miniapps/builtin/gov-booster
```

## Related Apps

- [Secret Vote](../secret-vote/) - Privacy voting
- [IL Guard](../il-guard/) - DeFi protection
