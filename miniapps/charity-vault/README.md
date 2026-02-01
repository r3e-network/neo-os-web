# Charity Vault 慈善金库

Transparent charitable giving on Neo N3 blockchain. A frontend-only application for making and tracking charitable donations with full transparency.

## Overview

Charity Vault enables transparent, accountable charitable donations with full visibility into how funds are used. Donors can contribute to verified causes and track exactly how funds are distributed through the Neo N3 blockchain.

## Features

- **Transparent Donations**: All contributions recorded and visible on-chain
- **Fund Tracking**: Real-time visibility into fund allocation and usage
- **Verified Causes**: Curated list of legitimate charitable organizations
- **Campaign Categories**: Filter causes by category (Education, Healthcare, Environment, Disaster Relief, etc.)
- **Donation History**: Track your personal donation history and impact
- **Campaign Creation**: Ability to create new fundraising campaigns
- **Multi-Currency Support**: Accepts GAS and other NEP-17 tokens
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Usage

### For Donors

1. **Browse Campaigns**: View available charitable campaigns by category
2. **Select a Cause**: Choose a verified campaign that aligns with your values
3. **Make a Donation**: Enter donation amount and confirm via your Neo wallet
4. **Track Impact**: Monitor how your donation is used through on-chain tracking
5. **View History**: Access your complete donation history in "My Donations" tab

### For Campaign Creators

1. **Create Campaign**: Fill in campaign details, goal amount, and category
2. **Set Milestones**: Define funding milestones for transparency
3. **Share Campaign**: Distribute your campaign link to potential donors
4. **Manage Funds**: Withdraw funds as milestones are achieved
5. **Update Progress**: Keep donors informed with regular updates

## How It Works

Charity Vault operates as a frontend interface to Neo N3 blockchain:

1. **No Smart Contract Required**: This is a frontend-only application that interacts directly with Neo N3 blockchain for transparency
2. **On-Chain Tracking**: All donations are recorded as transactions on Neo N3
3. **Wallet Integration**: Connect your Neo wallet to make donations
4. **Transparent Ledger**: All fund movements are publicly visible on the blockchain

## Architecture

- **Type**: Frontend-only application (no backend smart contract)
- **Network**: Neo N3 Mainnet/Testnet
- **SDK**: @neo/uniapp-sdk for blockchain interaction
- **Storage**: Campaign data stored on-chain via transactions
- **Permissions**: invoke:primary, read:blockchain

## Development

```bash
cd apps/charity-vault
pnpm install
pnpm dev
```

### Project Structure

- `src/pages/index/index.vue` - Main application interface
- `src/pages/index/components/` - Campaign cards, forms, and views
- `src/composables/useI18n.ts` - Internationalization
- `src/static/` - Assets and images

## Security

- All transactions require wallet confirmation
- Campaigns are verified before listing
- Funds go directly to campaign addresses
- No custody of user funds by the application

## License

MIT License - R3E Network
