# Turbo Options

Ultra-fast 30s/60s binary options trading with 0.1% sensitivity datafeed.

## Overview

Turbo Options enables rapid binary options trading on cryptocurrency price movements. Users predict whether the price will go UP or DOWN within a short timeframe (30 or 60 seconds) and earn 1.85x payout on correct predictions.

## Features

- **Ultra-Fast Settlement**: 30-second and 60-second expiry options
- **High-Precision Datafeed**: 0.1% sensitivity price updates
- **Simple Binary Choice**: UP or DOWN predictions only
- **Instant Payouts**: Automatic settlement via automation service
- **Multiple Assets**: BTC, ETH, NEO, GAS price pairs

## How It Works

1. **Select Duration**: Choose 30s or 60s expiry
2. **Pick Direction**: Predict UP or DOWN
3. **Place Bet**: Minimum 0.1 GAS, maximum 10 GAS
4. **Wait for Expiry**: Countdown timer shows remaining time
5. **Auto-Settlement**: Position resolves automatically at expiry

## Payout Structure

| Outcome              | Payout           |
| -------------------- | ---------------- |
| Correct Prediction   | 1.85x bet amount |
| Incorrect Prediction | 0 (lose bet)     |

Platform fee: 7.5% (built into 1.85x payout vs theoretical 2x)

## Technical Details

### Platform Capabilities Used

| Capability     | Usage                               |
| -------------- | ----------------------------------- |
| **Payments**   | GAS betting and payout distribution |
| **Datafeed**   | 0.1% sensitivity price oracle       |
| **Automation** | Scheduled position settlement       |

### Price Feed Integration

```javascript
// Query current price
const price = await sdk.datafeed.getPrice("BTCUSD");

// Price updates every ~1 second with 0.1% sensitivity
// Only triggers update when price moves >= 0.1%
```

### Position Lifecycle

```
Open Position → Lock Entry Price → Countdown → Query Exit Price → Settle
     ↓              ↓                  ↓              ↓            ↓
  PayToApp    Store in state    UI countdown    Datafeed     PayoutToUser
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
  "assets_allowed": ["GAS"],
  "limits": {
    "max_per_tx": 10,
    "max_per_user_per_day": 100
  }
}
```

## Risk Disclosure

- Binary options are high-risk financial instruments
- Past performance does not guarantee future results
- Only trade with funds you can afford to lose
- Price feeds may experience latency during high volatility

## Development

```bash
# Serve locally
npx serve miniapps/builtin/turbo-options

# Or run via host app
cd platform/host-app && npm run dev
```

## Related Apps

- [Price Predict](../price-predict/) - Longer-term price predictions
- [Micro Predict](../micro-predict/) - 60-second predictions
- [Prediction Market](../prediction-market/) - Event-based predictions
