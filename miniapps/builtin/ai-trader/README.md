# AI Trader

Autonomous AI Trading Agent with TEE-secured strategy execution.

## Overview

AI Trader is a 24/7 autonomous trading agent that monitors markets and executes trades based on configurable strategies. All strategy logic runs in the TEE for privacy and tamper-proof execution.

## Features

- **24/7 Autonomous Trading**: Continuous market monitoring
- **Multiple Strategies**: Momentum, Mean Reversion, Breakout, Sentiment
- **TEE-Secured**: Strategy logic protected in trusted enclave
- **Risk Management**: Configurable position limits and risk levels
- **Performance Tracking**: Real-time P&L and win rate statistics

## How It Works

1. **Configure Strategy**: Select trading strategy and parameters
2. **Set Risk Level**: Choose risk tolerance (1-10)
3. **Start Agent**: Pay activation fee and begin trading
4. **Monitor Performance**: Track trades and P&L in real-time

## Strategies

| Strategy           | Description               |
| ------------------ | ------------------------- |
| **Momentum**       | Follow price trends       |
| **Mean Reversion** | Trade against extremes    |
| **Breakout**       | Trade on price breakouts  |
| **Sentiment**      | AI-based market sentiment |

## Technical Details

### Platform Capabilities

| Capability     | Usage                     |
| -------------- | ------------------------- |
| **Payments**   | Trade execution fees      |
| **Datafeed**   | Real-time price data      |
| **Automation** | Scheduled decision cycles |
| **Compute**    | TEE strategy execution    |

## Development

```bash
npx serve miniapps/builtin/ai-trader
```

## Related Apps

- [Grid Bot](../grid-bot/) - Grid trading
- [Turbo Options](../turbo-options/) - Binary options
