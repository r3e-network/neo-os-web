# Prediction Market 预测市场

Decentralized prediction markets on Neo N3 blockchain. Create and participate in prediction markets for real-world events with transparent on-chain resolution.

## Overview

Prediction Market allows users to create markets for future events and trade shares based on predicted outcomes. Markets are resolved through oracle-based outcome verification, ensuring fair and transparent results.

## Features

- **Create Markets**: Launch prediction markets for any verifiable event
- **Binary & Multi-outcome**: Support for Yes/No or multiple choice markets
- **Automated Resolution**: Oracle-based outcome verification
- **Liquidity Provision**: Provide liquidity to earn trading fees
- **Real-time Trading**: Buy and sell outcome shares dynamically
- **Transparent Odds**: Market prices reflect collective predictions
- **Leaderboards**: Track top predictors and market creators

## Usage

### Participating in Markets

1. **Browse Markets**: View all active prediction markets by category
2. **Select Market**: Choose a market you want to participate in
3. **Analyze Odds**: Current prices reflect market sentiment
4. **Buy Shares**: Purchase shares in your predicted outcome
5. **Track Position**: Monitor your holdings as market evolves
6. **Sell or Hold**: Trade shares before resolution or hold until end

### Creating Markets

1. **Define Event**: Describe the event clearly with verifiable outcome
2. **Set Categories**: Assign relevant categories for discoverability
3. **Configure Resolution**: Set resolution date and oracle source
4. **Add Liquidity**: Provide initial liquidity for trading
5. **Launch Market**: Publish market to the platform

### Claiming Winnings

1. **Wait for Resolution**: Market resolves after event occurs
2. **Oracle Verification**: Outcome verified by trusted oracle
3. **Claim Rewards**: Winning shares can be redeemed for payout

## How It Works

1. **Market Creation**: User creates market with defined outcomes and resolution criteria
2. **Trading Phase**: Participants buy and sell outcome shares based on predictions
3. **Price Discovery**: Share prices reflect probability of each outcome
4. **Event Occurs**: Real-world event takes place
5. **Oracle Resolution**: Trusted oracle reports actual outcome
6. **Payout Distribution**: Winning shares receive proportional payout

## Market Types

- **Binary Markets**: Yes/No outcomes (e.g., "Will it rain tomorrow?")
- **Categorical Markets**: Multiple discrete outcomes (e.g., "Who will win the election?")
- **Scalar Markets**: Numerical ranges (e.g., "What will the price be?")

## Architecture

- **Type**: Frontend-only application
- **Network**: Neo N3 Mainnet/Testnet
- **Resolution**: Oracle-based outcome verification
- **Trading**: Automated Market Maker (AMM) model
- **Data**: Market data from external APIs and blockchain

## Technical Details

- **Category**: Finance/DeFi
- **Network**: Neo N3 Mainnet
- **SDK**: @neo/uniapp-sdk
- **Permissions**: invoke:primary, read:blockchain

## Development

```bash
cd apps/prediction-market
pnpm install
pnpm dev
```

### Project Structure

- `src/pages/index/index.vue` - Main market interface
- `src/components/` - Market cards, trading interface, charts
- `src/composables/` - Market data, trading logic
- `src/static/` - Assets and branding

## Categories

- Politics
- Sports
- Finance
- Crypto
- Weather
- Entertainment
- Science
- Other

## Risk Disclaimer

Prediction markets involve financial risk. Only participate with funds you can afford to lose. Past performance does not guarantee future results.

## License

MIT License - R3E Network
