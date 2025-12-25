# IL Guard

Impermanent Loss Protection Tool - Monitor LP positions and auto-withdraw on threshold breach.

## Overview

IL Guard helps liquidity providers protect their positions from excessive impermanent loss. Set your IL threshold, and the automation service will trigger withdrawal when your position's IL exceeds the limit.

## Features

- **Real-time IL Calculation**: Live impermanent loss percentage display
- **Customizable Thresholds**: Set IL limits from 1% to 50%
- **Auto-Withdraw**: Automation triggers exit when threshold breached
- **Multi-Pool Support**: Monitor multiple LP positions
- **Price Alerts**: Notifications when IL approaches threshold

## How It Works

1. **Add Position**: Enter pool address and entry price ratio
2. **Set Threshold**: Choose maximum acceptable IL (default: 5%)
3. **Enable Monitoring**: Activate automation service
4. **Auto-Protection**: System withdraws when IL exceeds threshold

## Impermanent Loss Formula

```
IL = 2 × √(price_ratio) / (1 + price_ratio) - 1

Where: price_ratio = current_price / entry_price
```

### IL Reference Table

| Price Change | Impermanent Loss |
| ------------ | ---------------- |
| ±25%         | 0.6%             |
| ±50%         | 2.0%             |
| ±75%         | 3.8%             |
| ±100% (2x)   | 5.7%             |
| ±200% (3x)   | 13.4%            |
| ±400% (5x)   | 25.5%            |

## Technical Details

### Platform Capabilities Used

| Capability     | Usage                                 |
| -------------- | ------------------------------------- |
| **Payments**   | Monitoring fee (0.01 GAS/day)         |
| **Datafeed**   | 0.1% sensitivity price oracle         |
| **Automation** | Scheduled IL checks and auto-withdraw |

### Monitoring Flow

```
Add Position → Set Threshold → Enable Monitor → Check IL → Auto-Withdraw
      ↓              ↓              ↓              ↓            ↓
  Store entry   Save config    Start cron    Datafeed     Trigger exit
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "datafeed": true,
    "automation": true
  },
  "assets_allowed": ["GAS"]
}
```

## Use Cases

- **Conservative LPs**: Set 2-3% threshold for stable pairs
- **Active Managers**: Set 5-10% for volatile pairs
- **Risk Hedgers**: Combine with options for full protection

## Development

```bash
# Serve locally
npx serve miniapps/builtin/il-guard

# Or run via host app
cd platform/host-app && npm run dev
```

## Related Apps

- [Turbo Options](../turbo-options/) - Hedge with binary options
- [Price Predict](../price-predict/) - Price movement predictions
- [Gov Booster](../gov-booster/) - Governance optimization
