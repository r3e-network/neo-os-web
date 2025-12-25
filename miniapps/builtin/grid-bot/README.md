# Grid Bot

Automated Grid Trading Market Maker with TEE strategy protection.

## Overview

Grid Bot automates grid trading strategy - placing buy and sell orders at preset price intervals. When price moves through grid levels, orders are filled and profits are captured.

## Features

- **Automated Grid Trading**: Set and forget market making
- **Visual Grid Display**: See active grid levels
- **Price-Triggered Orders**: Auto-execute on price movement
- **TEE Protection**: Strategy parameters secured
- **Profit Tracking**: Real-time grid profit display

## How It Works

1. **Set Price Range**: Define upper and lower bounds
2. **Configure Grid**: Set number of grid levels
3. **Fund Bot**: Deposit investment amount
4. **Start Trading**: Bot places orders automatically

## Technical Details

### Platform Capabilities

| Capability     | Usage                |
| -------------- | -------------------- |
| **Payments**   | Order execution      |
| **Datafeed**   | Price monitoring     |
| **Automation** | Order management     |
| **Compute**    | TEE grid calculation |

## Development

```bash
npx serve miniapps/builtin/grid-bot
```
