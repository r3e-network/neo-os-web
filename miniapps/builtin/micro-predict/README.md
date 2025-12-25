# Micro Predict

60-Second Price Predictions - Ultra-fast binary options with instant settlement.

## Overview

Micro Predict offers rapid-fire price predictions with 60-second resolution. Predict whether the price will be higher or lower in one minute and win 1.85x your bet.

## Features

- **60-Second Rounds**: Quick prediction cycles
- **Multiple Assets**: BTC, ETH, NEO, GAS pairs
- **Instant Settlement**: Auto-resolve at expiry
- **Live Price Feed**: Real-time price display
- **History Tracking**: Win/loss statistics

## How It Works

1. **Select Asset**: Choose price pair to predict
2. **Pick Direction**: UP or DOWN
3. **Place Bet**: 0.05-1 GAS per prediction
4. **Wait 60s**: Watch countdown timer
5. **Auto-Settle**: Receive payout if correct

## Payout Structure

| Outcome   | Payout    |
| --------- | --------- |
| Correct   | 1.85x bet |
| Incorrect | 0         |

## Technical Details

### Platform Capabilities Used

| Capability   | Usage                |
| ------------ | -------------------- |
| **Payments** | Betting and payouts  |
| **Datafeed** | Price oracle queries |

### Prediction Flow

```
Select Asset → Pick Direction → Place Bet → Countdown → Settle
      ↓             ↓              ↓           ↓          ↓
  Show price    Store choice   PayToApp    60 seconds  Payout
```

## Manifest Permissions

```json
{
  "permissions": {
    "wallet": ["read-address"],
    "payments": true,
    "datafeed": true
  },
  "assets_allowed": ["GAS"]
}
```

## Development

```bash
npx serve miniapps/builtin/micro-predict
```

## Related Apps

- [Turbo Options](../turbo-options/) - 30s/60s options
- [Price Predict](../price-predict/) - Longer predictions
